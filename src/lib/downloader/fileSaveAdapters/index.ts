import { env } from '@/lib/env';
import { FilenameConflictAction, saveFile as saveFileByFSA } from './fileSystemAccess';
import { gmDownload } from './gmDownload';
import { logger } from '@/lib/logger';
import { aDownload } from './aDownload';
import { GM_info } from '$';
import { gmDownloadDataUrl } from './gmDownloadDataUrl';

type FileSaveFn =
  | ((blob: Blob, path: string, signal?: AbortSignal) => Promise<void>)
  | ((blob: Blob, path: string) => void);

let saveFile: FileSaveFn;

const blobAvailable = env.isBlobDlAvaliable();
const subPathAvailable = env.isSupportSubpath();

if (subPathAvailable) {
  if (!blobAvailable) {
    // firefox + Tampermonkey
    // 将动图格式转换至dataUrl以实现保存到子文件夹
    saveFile = gmDownloadDataUrl;
  } else {
    saveFile = gmDownload;
  }
} else {
  // Violentmonkey 不支持子路径
  saveFile = aDownload;
  logger.warn('Download function is not fully supported:', GM_info.scriptHandler, GM_info.version);
}

export const fileSaveAdapters = {
  isFileSystemAccessAvailable: env.isFileSystemAccessAvaliable(),

  getAdapter(
    useFileSystemAccessApi: boolean,
    filenameConflictAction: FilenameConflictAction = FilenameConflictAction.UNIQUIFY
  ): FileSaveFn {
    if (this.isFileSystemAccessAvailable && useFileSystemAccessApi) {
      return saveFileByFSA.bind(undefined, filenameConflictAction);
    } else {
      return saveFile;
    }
  }
};
