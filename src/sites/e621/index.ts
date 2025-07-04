import { ThumbnailButton } from '@/lib/components/Button/thumbnailButton';
import { SiteInject } from '../base';
import { ArtworkButton } from '@/lib/components/Button/artworkButton';
import { DanbooruPoolButton } from '@/lib/components/Danbooru/danbooruPoolButton';
import { E621ngApi, type E621FullCurrentUser, type E621Post } from './api';
import { downloader } from '@/lib/downloader';
import { E621ngParser, type E621ngMeta } from './parser';
import { historyDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import { PostValidState } from '../base/parser';
import { BooruDownloadConfig, type TemplateData } from '../base/downloadConfig';
import { t } from '@/lib/i18n.svelte';
import { downloadSetting } from '@/lib/store/downloadSetting.svelte';
import { siteFeature } from '@/lib/store/siteFeature.svelte';
import { userAuthentication } from '@/lib/store/auth.svelte';
import { clientSetting } from '@/lib/store/clientSetting.svelte';
import { legacyConfig } from '@/lib/store/legacyConfig';
import { toStore } from 'svelte/store';

export class E621ng extends SiteInject {
  protected api: E621ngApi = new E621ngApi({
    rateLimit: 2,
    authorization: [userAuthentication.username ?? '', userAuthentication.apiKey ?? '']
  });
  protected parser: E621ngParser = new E621ngParser();
  protected profile: E621FullCurrentUser | null = null;

  constructor() {
    if (clientSetting.version === null) {
      downloadSetting.setDirectoryTemplate(legacyConfig.folderPattern ?? 'e621/{artist}');
      downloadSetting.setFilenameTemplate(
        legacyConfig.filenamePattern ?? '{id}_{artist}_{character}'
      );

      siteFeature.addBookmark ??= false;

      userAuthentication.$update((state) => {
        return {
          ...state,
          apiKey: '',
          username: ''
        };
      });
    }

    super();

    toStore(() => [userAuthentication.username, userAuthentication.apiKey]).subscribe(
      ([username, apiKey]) => {
        this.api.username = username!;
        this.api.apiKey = apiKey!;
      }
    );
  }

  static get hostname(): string[] {
    return ['e621.net', 'e926.net', 'e6ai.net'];
  }

  protected getSupportedTemplate(): Partial<TemplateData> {
    return BooruDownloadConfig.supportedTemplate;
  }

  #isPoolGallery() {
    return location.pathname === '/pools/gallery';
  }

  #isPoolView() {
    return /\/pools\/[0-9]+/.test(location.pathname);
  }

  #isPostView() {
    return /\/posts\/[0-9]+/.test(location.pathname);
  }

  #isFavoritesPage() {
    return location.pathname === '/favorites';
  }

  #isPostsPage() {
    return location.pathname === '/posts';
  }

  #isAuthorized() {
    return this.api.username && this.api.apiKey;
  }

  #throwIfNotAuthorized() {
    if (!this.#isAuthorized()) {
      const message = 'Please input your username and apiKey in setting.';
      this.toast({ message, type: 'error' });
      throw new Error(message);
    }
  }

  #validityCallbackFactory(
    checkValidity: (meta: Partial<E621ngMeta>) => Promise<boolean>
  ): (data: E621Post) => Promise<PostValidState> {
    return async (data) => {
      const { id, file, tags: fullTags } = data;
      const tags: string[] = [];

      for (const tagArr of Object.values(fullTags)) {
        tagArr.forEach((tag) => {
          tags.push(tag);
        });
      }

      return (await checkValidity({
        id: String(id),
        extendName: file.ext,
        tags
      }))
        ? PostValidState.VALID
        : PostValidState.INVALID;
    };
  }

  protected useBatchDownload = this.app.initBatchDownloader({
    avatar: '/packs/static/main-logo-2653c015c5870ec4ff08.svg',

    parseMetaByArtworkId: async (id) => {
      const { post } = await this.api.getPost(+id);
      return this.parser.buildMeta(post);
    },

    downloadArtworkByMeta: async (meta, signal) => {
      const downloadConfig = new BooruDownloadConfig(meta).create({
        ...downloadSetting
      });

      await downloader.download(downloadConfig, { priority: 1, signal });

      const { tags, artist, title, comment, source, rating } = meta;
      historyDb.add({
        pid: Number(meta.id),
        user: artist,
        title,
        comment,
        tags,
        source,
        rating
      });
    },

    beforeDownload: async () => {
      this.#throwIfNotAuthorized();

      const userId = this.parser.parseCurrentUserId();
      if (!userId) throw new Error('Cannot get user id.');
      this.profile = await this.api.getCurrentUserProfile(+userId);
    },

    afterDownload: () => {
      this.profile = null;
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
            return (
              // https://e621.net/help/supported_filetypes
              !!meta.extendName && /bmp|jp(e)?g|png|tif|gif|exif|svg|webp/i.test(meta.extendName)
            );
          }
        },
        {
          id: 'allow_video',
          type: 'include',
          name: () => t('downloader.category.filter.video'),
          checked: true,
          fn(meta) {
            return (
              !!meta.extendName &&
              /mp4|avi|mov|mkv|flv|wmv|webm|mpeg|mpg|m4v/i.test(meta.extendName)
            );
          }
        }
      ],

      enableTagFilter: true
    },

    pageOption: {
      pool: {
        name: 'Pool',
        match: () => this.#isPoolView(),
        filterInGenerator: true,
        fn: (pageRange, checkValidity) => {
          const poolId = /(?<=\/pools\/)[0-9]+/.exec(location.pathname)?.[0];
          if (!poolId) throw new Error('Invalid pool id');

          const postsPerPage = this.profile!.per_page;

          const getPostsMetaByPage = async (page: number) => {
            const data = (
              await this.api.getPosts({
                limit: postsPerPage,
                page,
                tags: `pool:${poolId} order:id`
              })
            ).posts;

            return {
              lastPage: data.length < postsPerPage,
              data
            };
          };

          return this.parser.paginationGenerator(
            pageRange,
            getPostsMetaByPage,
            (data) => this.parser.buildMeta(data),
            this.#validityCallbackFactory(checkValidity)
          );
        }
      },

      post_list: {
        name: 'Posts',
        match: () => this.#isPostsPage(),
        filterInGenerator: true,
        fn: (pageRange, checkValidity) => {
          const searchParam = new URLSearchParams(new URL(location.href).search);
          const tags = searchParam.get('tags') || '';
          const limit = +(searchParam.get('limit') || this.profile!.per_page);

          const getPostsMetaByPage = async (page: number) => {
            const data = (
              await this.api.getPosts({
                limit: limit,
                page,
                tags
              })
            ).posts;

            return {
              lastPage: data.length < limit,
              data
            };
          };

          return this.parser.paginationGenerator(
            pageRange,
            getPostsMetaByPage,
            (data) => this.parser.buildMeta(data),
            this.#validityCallbackFactory(checkValidity)
          );
        }
      },

      favorites: {
        name: 'Favorites',
        match: () => this.#isFavoritesPage(),
        filterInGenerator: true,
        fn: (pageRange, checkValidity) => {
          const searchParam = new URLSearchParams(new URL(location.href).search);
          const limit = +(searchParam.get('limit') || this.profile!.per_page);
          const userId = +(searchParam.get('user_id') || this.profile!.id);
          if (!userId) throw new Error('Cannot get user id.');

          const getPostsMetaByPage = async (page: number) => {
            const data = (
              await this.api.getFavorites({
                limit,
                page,
                user_id: userId
              })
            ).posts;

            return {
              lastPage: data.length < limit,
              data
            };
          };

          return this.parser.paginationGenerator(
            pageRange,
            getPostsMetaByPage,
            (data) => this.parser.buildMeta(data),
            this.#validityCallbackFactory(checkValidity)
          );
        }
      },

      pool_gallery_button: {
        name: 'pool_gallery_button',
        match: () => false,
        filterInGenerator: true,
        fn: (pageRange, checkValidity, poolId: string) => {
          if (!poolId) throw new Error('Invalid pool id');

          const getPostsMetaByPage = async (page: number) => {
            const limit = this.profile!.per_page;
            const data = (
              await this.api.getPosts({
                limit,
                page,
                tags: `pool:${poolId}`
              })
            ).posts;

            return {
              lastPage: data.length < limit,
              data
            };
          };

          return this.parser.paginationGenerator(
            pageRange,
            getPostsMetaByPage,
            (data) => this.parser.buildMeta(data),
            this.#validityCallbackFactory(checkValidity)
          );
        }
      },

      show_downloader_in_pool_gallery: {
        name: 'pool_gallery',
        match: /\/pools\/gallery/
      }
    }
  });

  async #addFavorites(id: number) {
    try {
      const csrfToken = this.parser.parseCsrfToken();
      if (!csrfToken) throw new Error('Cannot get csrf-token.');

      await this.api.addFavorites(id, csrfToken);
      this.toast({ message: 'You have favorited this post', timeout: 2000 });
    } catch (error) {
      logger.error(error);
      this.toast({ message: (error as Error).message, type: 'error' });
    }
  }

  protected async downloadArtwork(btn: ThumbnailButton) {
    this.#throwIfNotAuthorized();

    const id = +btn.dataset.id!;
    const { post } = await this.api.getPost(id);
    const mediaMeta = this.parser.buildMeta(post);
    const downloadConfig = new BooruDownloadConfig(mediaMeta).create({
      ...downloadSetting,
      setProgress: (progress: number) => {
        btn.setProgress(progress);
      }
    });

    if (siteFeature.addBookmark && !post.is_favorited) {
      this.#addFavorites(id);
    }

    await downloader.download(downloadConfig, { priority: 1 });

    const { tags, artist, title, comment, source, rating } = mediaMeta;

    historyDb.add({
      pid: id,
      user: artist,
      title,
      comment,
      tags,
      source,
      rating
    });
  }

  protected createArtworkBtn() {
    // blacklist can be diabled by 'Disable All Filters' button, so always append download button for post.
    const btnContainer = document.querySelector<HTMLElement>('#image-container');
    if (!btnContainer) return;

    btnContainer.style.width = 'fit-content';
    btnContainer.style.position = 'relative';

    const id = btnContainer.dataset.id as string;

    btnContainer.appendChild(
      new ArtworkButton({
        id,
        site: btnContainer.querySelector('video') ? 'native_video' : undefined,
        onClick: this.downloadArtwork
      })
    );
  }

  protected createPoolThumbnailBtn() {
    const btnContainers = document.querySelectorAll<HTMLAnchorElement>('article.thumbnail > a');
    if (!btnContainers.length) return;

    btnContainers.forEach((el) => {
      const poolId = /(?<=\/pools\/)[0-9]+/.exec(el.href)?.[0];
      if (!poolId) return;

      const { downloading, batchDownload } = this.useBatchDownload();
      const onClick = (btn: ThumbnailButton) => {
        const poolId = btn.dataset.id!;
        return batchDownload('pool_gallery_button', poolId);
      };

      const btn = new DanbooruPoolButton({ id: poolId, downloading, onClick });

      el.style.position = 'relative';
      el.appendChild(btn);
    });
  }

  protected createThumbnailBtn() {
    const btnContainers = document.querySelectorAll<HTMLAnchorElement>('article.thumbnail > a');
    if (!btnContainers.length) return;

    btnContainers.forEach((el) => {
      const id = /(?<=\/posts\/)[0-9]+/.exec(el.href)?.[0];
      if (!id) return;

      el.style.position = 'relative';

      const btn = new ThumbnailButton({
        id,
        onClick: this.downloadArtwork
      });

      el.appendChild(btn);
    });
  }

  public inject(): void {
    super.inject();

    this.downloadArtwork = this.downloadArtwork.bind(this);

    if (this.#isPostView()) {
      this.createArtworkBtn();
    } else if (this.#isPoolGallery()) {
      this.createPoolThumbnailBtn();
    } else {
      this.createThumbnailBtn();
    }
  }
}
