import type { PixivMeta } from './parser';
import { type DownloadConfig } from '@/lib/downloader';
import {
  MayBeMultiIllustsConfig,
  SupportedTemplate,
  type OptionBase,
  type TemplateData
} from '@/sites/base/downloadConfig';
import { IllustType, type UgoiraMeta } from './types';
import { converter } from '@/lib/converter';
import { GM_xmlhttpRequest } from '$';
import { historyDb } from '@/lib/db';
import type { QualityOption } from '@/lib/converter/adapter';

interface PixivOptionBase extends OptionBase {
  useTranslatedTags: boolean;
}

interface PixivIndexOption extends PixivOptionBase {
  index: number;
}

interface PixivConvertOption extends PixivOptionBase {
  qualityOption: QualityOption;
}

export class PixivDownloadConfig extends MayBeMultiIllustsConfig {
  protected ugoiraMeta: UgoiraMeta | undefined;
  protected illustType: IllustType;
  protected userId: string;
  protected comment: string;
  protected translatedTags: string[];
  protected bookmarkCount: number;

  constructor(mediaMeta: PixivMeta) {
    super(mediaMeta);

    this.ugoiraMeta = 'ugoiraMeta' in mediaMeta ? mediaMeta.ugoiraMeta : undefined;
    this.illustType = mediaMeta.illustType;
    this.userId = mediaMeta.userId;
    this.comment = mediaMeta.comment;
    this.translatedTags = mediaMeta.tagsTranslated;
    this.bookmarkCount = mediaMeta.bookmarkCount;
  }

  static get supportedTemplate() {
    return {
      [SupportedTemplate.ID]: '{id}',
      [SupportedTemplate.ARTIST]: '{artist}',
      [SupportedTemplate.ARTISTID]: '{artistID}',
      [SupportedTemplate.DATE]: '{date} {date(YYYY-MM-DD)}',
      [SupportedTemplate.PAGE]: '{page}',
      [SupportedTemplate.SCORE]: '{score}: bookmarkCount',
      [SupportedTemplate.TAGS]: '{tags}',
      [SupportedTemplate.TITLE]: '{title}'
    };
  }

  getHeaders() {
    return {
      referer: 'https://www.pixiv.net'
    };
  }

  protected getZipComment(): string | undefined {
    if (!this.ugoiraMeta) return this.comment;

    const delays = this.ugoiraMeta.frames.map(({ delay }) => delay);

    return this.comment + '\n' + JSON.stringify(delays);
  }

  protected getTemplateData(
    data: Partial<typeof PixivDownloadConfig.supportedTemplate> & { page: string }
  ): typeof PixivDownloadConfig.supportedTemplate {
    return {
      id: this.id,
      artist: this.normalizeString(this.artist) || this.userId,
      artistID: this.userId,
      date: this.createDate,
      score: String(this.bookmarkCount),
      title: this.normalizeString(this.title) || this.id,
      tags: this.tags.join('_'),
      ...data
    };
  }

  handleConvertFactory(qualityOption: QualityOption, setProgress?: (progress: number) => void) {
    return (this.handleBeforeSaveCb ??= async (
      imgBlob: Blob,
      config: DownloadConfig,
      signal?: AbortSignal
    ): Promise<Blob | void> => {
      signal?.throwIfAborted();

      const { taskId, src } = config;
      const index = (this.src as string[]).indexOf(src);
      if (index === -1) throw new Error('No src matches.');

      if (!this.ugoiraMeta) return;

      this.handleAbortCb ??= () => {
        converter.clearFrames(taskId);
      };

      signal?.addEventListener('abort', this.handleAbortCb as () => void, { once: true });

      converter.addFrame({
        id: taskId,
        frame: imgBlob,
        delay: this.ugoiraMeta.frames[index]['delay'],
        order: index
      });

      if (converter.framesCount(taskId) !== this.ugoiraMeta.frames.length) return;

      return await converter.convert({
        id: taskId,
        qualityOption,
        onProgress: setProgress,
        signal
      });
    });
  }

  handleSeasonalEffectFactory(
    qualityOption: QualityOption,
    onProgress?: (progress: number) => void
  ) {
    return (this.handleBeforeSaveCb ??= async (
      imgBlob: Blob,
      config: DownloadConfig,
      signal?: AbortSignal
    ): Promise<Blob | void> => {
      signal?.throwIfAborted();

      const effectId = 'pixivGlow2024';
      const url = 'https://source.pixiv.net/special/seasonal-effect-tag/pixiv-glow-2024/effect.png';

      const { taskId } = config;
      const effectData = await historyDb.getImageEffect(effectId);

      if (effectData && !('width' in effectData)) {
        const { data } = effectData;
        const blob = await converter.appendPixivEffect({
          id: taskId,
          qualityOption,
          illust: imgBlob,
          seasonalEffect: data,
          onProgress,
          signal
        });

        return blob;
      } else {
        const effctBlob = await new Promise<Blob>((resolve, reject) => {
          GM_xmlhttpRequest({
            url,
            headers: {
              referer: 'https://www.pixiv.net'
            },
            responseType: 'blob',
            onload(e) {
              resolve(e.response);
            },
            onerror: reject,
            ontimeout: () => reject(new Error('Timeout'))
          });
        });

        const blob = await converter.appendPixivEffect({
          id: taskId,
          qualityOption,
          illust: imgBlob,
          // seasonalEffect will be transfered to worker
          seasonalEffect: await effctBlob.arrayBuffer(),
          onProgress,
          signal
        });

        historyDb.addImageEffect({
          id: effectId,
          data: await effctBlob.arrayBuffer()
        });

        return blob;
      }
    });
  }

  create(option: PixivOptionBase | PixivIndexOption): DownloadConfig {
    const {
      filenameTemplate,
      directoryTemplate,
      setProgress,
      useTranslatedTags,
      useFileSystemAccessApi,
      filenameConflictAction
    } = option;
    const index = 'index' in option ? option.index : 0;
    const headers = this.getHeaders();

    const templateData = this.getTemplateData(
      useTranslatedTags
        ? {
            tags: this.translatedTags.join('_'),
            page: String(index)
          }
        : {
            page: String(index)
          }
    );

    return {
      headers,
      taskId: this.getTaskId(),
      src: this.getSrc(index),
      path: this.getSavePath(directoryTemplate, filenameTemplate, this.getExt(index), templateData),
      timeout: this.getDownloadTimeout(index),
      onProgress: setProgress,
      useFileSystemAccessApi,
      filenameConflictAction
    };
  }

  createMulti(option: PixivOptionBase): DownloadConfig[] {
    if (!this.isStringArray(this.src)) throw new Error(`Artwork ${this.id} only have one media.`);

    const {
      filenameTemplate,
      directoryTemplate,
      setProgress,
      useTranslatedTags,
      useFileSystemAccessApi,
      filenameConflictAction
    } = option;
    const taskId = this.getTaskId();
    const headers = this.getHeaders();

    const onFileSaved = setProgress ? this.getMultipleMediaDownloadCB(setProgress) : undefined;

    const overwriteData: Partial<TemplateData> = useTranslatedTags
      ? {
          tags: this.translatedTags.join('_')
        }
      : {};

    return this.src.map((src, i) => {
      return {
        headers,
        taskId,
        src,
        path: this.getSavePath(
          directoryTemplate,
          filenameTemplate,
          this.getExt(i),
          this.getTemplateData({
            ...overwriteData,
            page: String(i)
          })
        ),
        timeout: this.getDownloadTimeout(),
        onFileSaved,
        useFileSystemAccessApi,
        filenameConflictAction
      };
    });
  }

  createBundle(option: PixivOptionBase): DownloadConfig[] {
    if (!this.isStringArray(this.src)) throw new Error(`Artwork ${this.id} only have one media.`);

    const {
      filenameTemplate,
      directoryTemplate,
      setProgress,
      useTranslatedTags,
      useFileSystemAccessApi,
      filenameConflictAction
    } = option;

    const taskId = this.getTaskId();
    const headers = this.getHeaders();
    const onXhrLoaded = setProgress ? this.getMultipleMediaDownloadCB(setProgress) : undefined;

    const overwriteData: Partial<TemplateData> = useTranslatedTags
      ? {
          tags: this.translatedTags.join('_')
        }
      : {};

    const path = this.getSavePath(
      directoryTemplate,
      filenameTemplate,
      'zip',
      this.getTemplateData({ ...overwriteData, page: String(this.src.length) })
    );

    // always add {page} when bundling
    const filenameTemplateWithPage = filenameTemplate.includes(`{${SupportedTemplate.PAGE}}`)
      ? filenameTemplate
      : filenameTemplate + `_{${SupportedTemplate.PAGE}}`;

    const filenames = this.src.map((_, i) => {
      return this.getSavePath(
        '',
        filenameTemplateWithPage,
        this.getExt(i),
        this.getTemplateData({
          ...overwriteData,
          page: String(i)
        })
      );
    });

    return this.src.map((src, i) => {
      return {
        headers,
        taskId,
        src,
        path,
        timeout: this.getDownloadTimeout(i),
        onXhrLoaded,
        beforeFileSave: this.handleBundleFactory(filenames),
        onError: this.handleBundleErrorFactory(),
        onAbort: this.handleBundleAbortFactory(),
        useFileSystemAccessApi,
        filenameConflictAction
      };
    });
  }

  createConvert(option: PixivConvertOption): DownloadConfig[] {
    if (!this.isStringArray(this.src)) throw new Error(`Artwork ${this.id} only have one media.`);

    const {
      filenameTemplate,
      directoryTemplate,
      setProgress,
      qualityOption,
      useTranslatedTags,
      useFileSystemAccessApi,
      filenameConflictAction
    } = option;

    const taskId = this.getTaskId();
    const headers = this.getHeaders();
    const onXhrLoaded = setProgress ? this.getMultipleMediaDownloadCB(setProgress) : undefined;
    const beforeFileSave = this.handleConvertFactory(qualityOption, setProgress);

    const templateData = this.getTemplateData(
      useTranslatedTags
        ? {
            tags: this.translatedTags.join('_'),
            page: String(0)
          }
        : {
            page: String(0)
          }
    );

    const path = this.getSavePath(
      directoryTemplate,
      filenameTemplate,
      qualityOption.format,
      templateData
    );

    return this.src.map((src, i) => {
      return {
        headers,
        taskId,
        src,
        path,
        timeout: this.getDownloadTimeout(i),
        onXhrLoaded,
        beforeFileSave,
        useFileSystemAccessApi,
        filenameConflictAction
      };
    });
  }

  createSeasonalEffect(
    option: PixivConvertOption | (PixivConvertOption & { index: number })
  ): DownloadConfig {
    const {
      filenameTemplate,
      directoryTemplate,
      setProgress,
      qualityOption,
      useTranslatedTags,
      useFileSystemAccessApi,
      filenameConflictAction
    } = option;

    const index: number | undefined = 'index' in option ? option.index : 0;

    const templateData = this.getTemplateData(
      useTranslatedTags
        ? {
            tags: this.translatedTags.join('_'),
            page: String(index)
          }
        : {
            page: String(index)
          }
    );

    return {
      headers: this.getHeaders(),
      taskId: this.getTaskId(),
      src: this.getSrc(index),
      path: this.getSavePath(
        directoryTemplate,
        filenameTemplate,
        qualityOption.format,
        templateData
      ),
      timeout: this.getDownloadTimeout(index),
      onProgress: setProgress,
      beforeFileSave: this.handleSeasonalEffectFactory(qualityOption, setProgress),
      useFileSystemAccessApi,
      filenameConflictAction
    };
  }
}
