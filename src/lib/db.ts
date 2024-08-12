import Dexie, { type Table } from 'dexie';
import { logger } from './logger';
import { generateCsv } from './util';

interface HistoryItemBase {
  pid: number;
  userId?: number;
  user?: string;
  title?: string;
  comment?: string;
  tags?: string[];
}

type HistoryItem = HistoryItemBase & { page?: Uint8Array };

export type HistoryData = HistoryItemBase & { page?: number };

class HistoryDb extends Dexie {
  private history!: Table<HistoryItem, number>;
  private caches!: Map<number, Uint8Array | null>;

  constructor() {
    super('PdlHistory');
    this.version(2).stores({
      history: 'pid, userId, user, title, *tags'
    });

    logger.time('loadDb');
    this.history.toArray().then((datas) => {
      this.caches = new Map(datas.map((data) => [data.pid, data.page || null]));
      logger.timeEnd('loadDb');
    });
  }

  private throwIfInvalidNumber(num: number): void {
    if (!(Number.isSafeInteger(num) && num >= 0)) {
      logger.throw(`Invalid number:${num}, must be a non-negative integer.`);
    }
  }

  private async updatePageArray(page: number, pageArray?: Uint8Array): Promise<Uint8Array> {
    const byteIndex = Math.floor(page / 8);
    const bitIndex = page % 8;

    if (!pageArray) {
      const newArr = new Uint8Array(byteIndex + 1);
      newArr[byteIndex] |= 1 << bitIndex;

      return newArr;
    } else if (byteIndex > pageArray.length - 1) {
      const newArr = new Uint8Array(byteIndex + 1);
      newArr.set(pageArray);
      newArr[byteIndex] |= 1 << bitIndex;

      return newArr;
    } else {
      pageArray[byteIndex] |= 1 << bitIndex;
      return pageArray;
    }
  }

  public async add(historyData: HistoryData) {
    const { pid, page } = historyData;
    this.throwIfInvalidNumber(pid);

    return this.transaction('rw', this.history, async () => {
      if (page !== undefined) {
        this.throwIfInvalidNumber(page);

        const historyItem = await this.history.get(pid);

        if (historyItem?.page) {
          // not fully downloaded
          const u8arr = await this.updatePageArray(page, historyItem.page);
          this.history.put({ ...historyData, page: u8arr });
          this.caches.set(pid, u8arr);
        } else if (historyItem) {
          // fully downloaded
          delete historyData.page;
          this.history.put(historyData as HistoryItem);
        } else {
          // new download
          const u8arr = await this.updatePageArray(page);
          this.history.put({ ...historyData, page: u8arr });
          this.caches.set(pid, u8arr);
        }
      } else {
        this.history.put(historyData as HistoryItem);
        this.caches.set(pid, null);
      }
    });
  }

  // TODO: import history
  public bulkAdd(historyDatas: HistoryItem[]) {
    historyDatas.forEach((data) => {
      this.caches.set(data.pid, data.page || null);
    });
    return this.history.bulkPut(historyDatas);
  }

  public async has(pid: number | string): Promise<boolean> {
    if (typeof pid === 'string') pid = Number(pid);
    this.throwIfInvalidNumber(pid);

    if (this.caches) {
      return this.caches.has(pid);
    } else {
      return !!(await this.history.get(pid));
    }
  }

  /**
   * Returns `true` if the page has been downloaded, `false` if it hasn't,
   *
   * @param {number | string} pid
   * @param {number} page
   * @returns {boolean}
   */
  public async hasPage(pid: number | string, page: number): Promise<boolean> {
    if (typeof pid === 'string') pid = Number(pid);

    this.throwIfInvalidNumber(pid);
    this.throwIfInvalidNumber(page);

    const byteIndex = Math.floor(page / 8);
    const bitIndex = page % 8;

    if (this.caches) {
      const cachesData = this.caches.get(pid);
      if (cachesData === null) {
        return true;
      } else if (cachesData) {
        return (
          !(byteIndex > cachesData.length - 1) && (cachesData[byteIndex] & (1 << bitIndex)) !== 0
        );
      }

      return false;
    } else {
      const historyItem = await this.history.get(pid);
      if (!historyItem) {
        return false;
      } else if (!historyItem.page) {
        return true;
      }

      return (
        !(byteIndex > historyItem.page.length - 1) &&
        (historyItem.page[byteIndex] & (1 << bitIndex)) !== 0
      );
    }
  }

  public getAll(): Promise<HistoryItem[]> {
    return this.history.toArray();
  }

  public generateCsv(): Promise<Blob> {
    return this.getAll().then((datas) => {
      const csvData: string[][] = datas.map((historyData) => {
        const { pid, userId = '', user = '', title = '', tags = '', comment = '' } = historyData;
        return [String(pid), String(userId), user, title, comment, tags ? tags.join(',') : tags];
      });
      csvData.unshift(['id', 'userId', 'user', 'title', 'comment', 'tags']);

      return generateCsv(csvData);
    });
  }

  public clear() {
    this.caches && this.caches.clear();
    return this.history.clear();
  }
}

let instance: HistoryDb;
const SingletonHistoryDb = new Proxy(HistoryDb, {
  construct(target) {
    if (!instance) {
      return (instance = new target());
    }

    return instance;
  }
});

export const historyDb = new SingletonHistoryDb();
