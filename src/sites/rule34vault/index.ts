import { clientSetting } from '@/lib/store/clientSetting.svelte';
import { SiteInject } from '../base';
import { siteFeature } from '@/lib/store/siteFeature.svelte';
import { type TemplateData } from '../base/downloadConfig';
import { ThumbnailBtnType, ThumbnailButton } from '@/lib/components/Button/thumbnailButton';
import { Rule34VaultDownloadConfig } from './downloadConfig';
import {
  Rule34VaultApi,
  Rule34VaultPostType,
  TagSearchSortType,
  type SearchParamBase,
  type SubscriptionSearchParam,
  type TagAndBookmarkSearchParam
} from './api';
import { Rule34VaultParser } from './parser';
import { downloadSetting } from '@/lib/store/downloadSetting.svelte';
import { downloader } from '@/lib/downloader';
import { historyDb } from '@/lib/db';
import { BtnLengthUnit, buttonPosition } from '@/lib/store/buttonPosition.svelte';
import { t } from '@/lib/i18n.svelte';
import { regexp } from '@/lib/regExp';
import { logger } from '@/lib/logger';
import { ReactiveValue } from '@/lib/reactiveValue.svelte';
import { waitDom } from '@/lib/util';

export class Rule34Vault extends SiteInject {
  private api = new Rule34VaultApi();
  private parser = new Rule34VaultParser();

  private pageType = [
    'app-home-page',
    'app-post-page',
    'app-highest-posts-page',
    'app-hot-posts-page',
    'app-playlists-page',
    'app-playlist-page',
    'app-comments-page',
    'app-upgrade-to-premium-page',
    'app-user-page',
    'app-feed-page',
    'app-sign-in-page',
    'app-sign-up-page'
  ] as const;

  #currentPage: ReactiveValue<(typeof this.pageType)[number]>;
  #notifyPageChange?: () => void;

  constructor() {
    if (clientSetting.version === null) {
      downloadSetting.setDirectoryTemplate('Rule34Vault/{artist}');
      downloadSetting.setFilenameTemplate('{id}_{artist}_{character}');

      buttonPosition.$update((state) => {
        return {
          ...state,
          thumbnailBtnUnitY: BtnLengthUnit.PX,
          '--pdl-btn-left-percent': 100,
          '--pdl-btn-top-px': 40
        };
      });

      siteFeature.addBookmark ??= false;
    }

    super();

    this.#currentPage = new ReactiveValue<(typeof this.pageType)[number]>(
      () =>
        document
          .querySelector(this.pageType.join(','))!
          .tagName.toLowerCase() as (typeof this.pageType)[number],
      (update) => {
        this.#notifyPageChange = update;
        return () => {
          this.#notifyPageChange = undefined;
        };
      }
    );
  }

  static get hostname() {
    return 'rule34vault.com';
  }

  protected getSupportedTemplate(): Partial<TemplateData> {
    return Rule34VaultDownloadConfig.supportedTemplate;
  }

  #getCurrentSearchSetting(): Pick<TagAndBookmarkSearchParam, 'includeTags' | 'sortBy'> & {
    type?: Rule34VaultPostType;
  } {
    const searchParam = new URLSearchParams(location.search);
    const sort = searchParam.get('sort');
    const mediaType = searchParam.get('type');

    const sortBy =
      sort === 'likes'
        ? TagSearchSortType.TOP_RATED
        : sort === 'views'
          ? TagSearchSortType.MOST_VIEWED
          : TagSearchSortType.LATEST;

    const type =
      mediaType === 'image'
        ? Rule34VaultPostType.JPG
        : mediaType === 'video'
          ? Rule34VaultPostType.MP4
          : undefined;

    const encodedTag = location.pathname.slice(1);
    const includeTags: string[] = encodedTag
      ? decodeURIComponent(decodeURIComponent(encodedTag)).replaceAll('_', ' ').split('|')
      : [];

    return {
      includeTags,
      sortBy,
      type
    };
  }

  protected useBatchDownload = this.app.initBatchDownloader({
    avatar: async (url) => {
      try {
        let avatarEl: Element;

        if (/\/playlists\/view\/[0-9]+/.test(url)) {
          avatarEl = (await waitDom('app-playlist-page-content app-user-avatar div.img'))!;
        } else {
          avatarEl = document.body.querySelector('mat-sidenav app-user-avatar div.img')!;
        }

        const style = avatarEl.getAttribute('style')!;
        const avatarSrc = /(?<=url\(").+(?="\))/.exec(style)![0];

        return avatarSrc;
      } catch (error) {
        return '/assets/icons/icon-512x512.png';
      }
    },

    parseMetaByArtworkId: async (id: string) => {
      const postData = await this.api.getPostData(id);
      return this.parser.buildMeta(postData);
    },

    downloadArtworkByMeta: async (meta, signal) => {
      const downloadConfig = new Rule34VaultDownloadConfig(meta).create({
        ...downloadSetting
      });

      await downloader.download(downloadConfig, { signal });

      const { id, tagsToStore, artist, title, source } = meta;
      historyDb.add({
        pid: Number(id),
        user: artist,
        title,
        tags: tagsToStore,
        source
      });
    },

    filterOption: {
      filters: [
        {
          id: 'exclude_downloaded',
          type: 'exclude',
          name: () => t('downloader.category.filter.exclude_downloaded'),
          checked: false,
          fn(meta) {
            return !!meta.id && historyDb.has(meta.id);
          }
        },
        {
          id: 'allow_image',
          type: 'include',
          name: () => t('downloader.category.filter.image'),
          checked: true,
          fn(meta) {
            return !!meta.extendName && regexp.imageExt.test(meta.extendName);
          }
        },
        {
          id: 'allow_video',
          type: 'include',
          name: () => t('downloader.category.filter.video'),
          checked: true,
          fn(meta) {
            return !!meta.extendName && regexp.videoExt.test(meta.extendName);
          }
        }
      ],

      enableTagFilter: true
    },

    pageOption: {
      playlist: {
        name: 'Playlist',
        match: () => this.#currentPage.current === 'app-playlist-page',
        filterInGenerator: false,
        fn: (pageRange) => {
          const idMathch = /(?<=\/playlists\/view\/)[0-9]+/.exec(location.pathname);
          if (!idMathch) throw new Error('Cannot get playlist id.');

          const id = idMathch[0];
          const token = this.parser.getCurrentUserToken();
          let cursor: string | undefined;

          const getPostIdByPage = async (page: number) => {
            const POST_PER_PAGE = 30;
            const skip = (page - 1) * POST_PER_PAGE;

            const param: SearchParamBase = {
              checkHasMore: true,
              countTotal: false,
              skip,
              take: POST_PER_PAGE
            };

            if (cursor) param.cursor = cursor;

            const {
              cursor: nextCursor,
              hasMore,
              items
            } = await this.api.searchPlaylist(id, param, token);

            cursor = nextCursor;

            return {
              lastPage: !hasMore,
              data: items
            };
          };

          return this.parser.paginationGenerator(pageRange, getPostIdByPage, (item) =>
            String(item.id)
          );
        }
      },

      tagSearch: {
        name: 'All Posts',
        match: () => this.#currentPage.current === 'app-home-page',
        filterInGenerator: false,
        fn: (pageRange) => {
          const { includeTags, sortBy, type } = this.#getCurrentSearchSetting();
          const token = this.parser.getCurrentUserToken();

          let cursor: string | undefined;

          const getPostIdByPage = async (page: number) => {
            const POST_PER_PAGE = 30;
            const skip = (page - 1) * POST_PER_PAGE;

            const param: TagAndBookmarkSearchParam = {
              includeTags,
              sortBy,
              checkHasMore: true,
              countTotal: true,
              skip,
              take: POST_PER_PAGE
            };

            if (cursor) param.cursor = cursor;
            if (type !== undefined) param.type = type;

            const { cursor: nextCursor, hasMore, items } = await this.api.searchTags(param, token);

            cursor = nextCursor;

            return {
              lastPage: !hasMore,
              data: items
            };
          };

          return this.parser.paginationGenerator(pageRange, getPostIdByPage, (item) =>
            String(item.id)
          );
        }
      },

      bookmarkSearch: {
        name: 'Bookmarks',
        match: () => this.#currentPage.current === 'app-home-page',
        filterInGenerator: false,
        fn: (pageRange) => {
          const token = this.parser.getCurrentUserToken();
          const userId = this.parser.getCurrentUserProfile()?.id;
          if (!token || !userId) throw new Error('Please sign in.');

          const { includeTags, sortBy, type } = this.#getCurrentSearchSetting();

          let cursor: string | undefined;

          const getPostIdByPage = async (page: number) => {
            const POST_PER_PAGE = 30;
            const skip = (page - 1) * POST_PER_PAGE;

            const param: TagAndBookmarkSearchParam = {
              includeTags,
              sortBy,
              checkHasMore: true,
              countTotal: true,
              skip,
              take: POST_PER_PAGE
            };

            if (cursor) param.cursor = cursor;
            if (type !== undefined) param.type = type;

            const {
              cursor: nextCursor,
              hasMore,
              items
            } = await this.api.searchUserBookmark(String(userId), param, token);

            cursor = nextCursor;

            return {
              lastPage: !hasMore,
              data: items
            };
          };

          return this.parser.paginationGenerator(pageRange, getPostIdByPage, (item) =>
            String(item.id)
          );
        }
      },

      subscriptionSearch: {
        name: 'Subscriptions',
        match: () => this.#currentPage.current === 'app-home-page',
        filterInGenerator: false,
        fn: (pageRange) => {
          const token = this.parser.getCurrentUserToken();
          const userId = this.parser.getCurrentUserProfile()?.id;
          if (!token || !userId) throw new Error('Please sign in.');

          const { includeTags, type } = this.#getCurrentSearchSetting();

          let cursor: string | undefined;

          const getPostIdByPage = async (page: number) => {
            const POST_PER_PAGE = 30;
            const skip = (page - 1) * POST_PER_PAGE;

            const param: SubscriptionSearchParam = {
              includeTags,
              checkHasMore: true,
              countTotal: true,
              skip,
              take: POST_PER_PAGE
            };

            if (cursor) param.cursor = cursor;
            if (type !== undefined) param.type = type;

            const {
              cursor: nextCursor,
              hasMore,
              items
            } = await this.api.searchUserSubscriptions(String(userId), param, token);

            cursor = nextCursor;

            return {
              lastPage: !hasMore,
              data: items
            };
          };

          return this.parser.paginationGenerator(pageRange, getPostIdByPage, (item) =>
            String(item.id)
          );
        }
      }
    }
  });

  async #addBookmark(id: string) {
    try {
      const token = this.parser.getCurrentUserToken();
      if (!token) throw new Error('Token not found, please sign in');

      await this.api.addBookmark(id, token);
      this.toast({ message: 'You have favorited this post', timeout: 2000 });
    } catch (error) {
      logger.error(error);
      this.toast({ message: (error as Error).message, type: 'error' });
    }
  }

  async #downloadArtwork(btn: ThumbnailButton) {
    const id = btn.dataset.id!;

    const postData = await this.api.getPostData(id);
    const mediaMeta = this.parser.buildMeta(postData);
    const downloadConfig = new Rule34VaultDownloadConfig(mediaMeta).create({
      ...downloadSetting,
      setProgress: (progress: number) => {
        btn.setProgress(progress);
      }
    });

    if (siteFeature.addBookmark) {
      this.#addBookmark(id);
    }

    await downloader.download(downloadConfig, { priority: 1 });

    const { tagsToStore, artist, title, source } = mediaMeta;
    historyDb.add({
      pid: Number(id),
      user: artist,
      title,
      tags: tagsToStore,
      source
    });
  }

  #createOrUpdatePostActionButton() {
    const id = /(?<=\/post\/)[0-9]+/.exec(location.pathname)?.[0];
    if (!id) return;

    const container = document.querySelector('app-post-actions div.con');
    if (!container) return;

    const btn = container.querySelector<ThumbnailButton>(ThumbnailButton.tagNameLowerCase);
    if (btn) {
      btn.dataset.id = id;
    } else {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('style', 'margin-right: 8px;');
      wrapper.classList.add('chip');
      wrapper.appendChild(
        new ThumbnailButton({
          id,
          type: ThumbnailBtnType.Rule34VaultPostAction,
          onClick: (btn) => this.#downloadArtwork(btn)
        })
      );

      container.insertBefore(wrapper, container.firstElementChild);
    }
  }

  #createThumbnailButton(id: string, container: HTMLElement) {
    if (container.querySelector(ThumbnailButton.tagNameLowerCase)) return;

    container.appendChild(
      new ThumbnailButton({
        id,
        onClick: (btn) => this.#downloadArtwork(btn)
      })
    );
  }

  public inject(): void {
    super.inject();

    const root = document.querySelector('app-root');
    if (!root) return;

    new MutationObserver((records) => {
      const thumbnailBtnTagName = ThumbnailButton.tagNameLowerCase.toUpperCase();

      const addedElementNodes = records
        .filter((record) => record.type === 'childList' && record.addedNodes.length)
        .flatMap((record) => Array.from(record.addedNodes))
        .filter(
          (node) =>
            node.nodeType === Node.ELEMENT_NODE &&
            (node as HTMLElement).tagName !== thumbnailBtnTagName
        ) as HTMLElement[];

      if (!addedElementNodes.length) return;

      const getIdByAnchor = (el: HTMLAnchorElement) => {
        const id = /(?<=\/post\/)[0-9]+$/.exec(el.getAttribute('href')!)?.[0];
        return id ?? '';
      };

      addedElementNodes.forEach((el) => {
        switch (true) {
          // grid layout
          case el.matches('a[href^="/post/"].box'): {
            const id = getIdByAnchor(el as HTMLAnchorElement);
            if (!id) return;
            this.#createThumbnailButton(id, el.querySelector('div.box-inner')!);
            break;
          }
          // masonry layout
          case el.matches('a[href^="/post/"].masonry-item'): {
            const id = getIdByAnchor(el as HTMLAnchorElement);
            if (!id) return;
            this.#createThumbnailButton(id, el);
            break;
          }
          // comments
          case el.matches('div.post-con:has(a[href^="/post/"])'): {
            const anchor = el.querySelector<HTMLAnchorElement>('a[href^="/post/"]')!;
            const id = getIdByAnchor(anchor);
            if (!id) return;
            this.#createThumbnailButton(id, el.querySelector('div.con')!);
            break;
          }
          // create or update post action button
          case el.matches('app-post-page-content, app-tag-list'): {
            this.#createOrUpdatePostActionButton();
            break;
          }
          case el.matches(this.pageType.join(',')): {
            if (!this.#notifyPageChange) {
              throw new TypeError('Type of #notifyPageChange is undefined.');
            }
            this.#notifyPageChange();
            break;
          }
          default:
            break;
        }
      });
    }).observe(root, {
      subtree: true,
      childList: true
    });
  }
}
