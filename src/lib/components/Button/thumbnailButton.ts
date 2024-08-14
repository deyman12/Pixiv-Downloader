import { historyDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import btnStyle from '@/assets/styles/thumbnailButton.scss?inline';
import svgGroup from '@/assets/thumbnailButtonIcon.svg?src';

const iconTypeMap: Record<string, string> = {
  init: '#pdl-download',
  loading: '#pdl-loading',
  progress: '#pdl-progress',
  complete: '#pdl-complete',
  error: '#pdl-error'
};

export const enum ThumbnailBtnStatus {
  Init = 'init',
  Loading = 'loading',
  Progress = 'progress',
  Complete = 'complete',
  Error = 'error'
}

export const enum ThumbnailBtnType {
  Gallery = 'gallery',
  PixivMyBookmark = 'pixiv-my-bookmark',
  PixivHistory = 'pixiv-history',
  PixivPresentation = 'pixiv-presentation',
  PixivToolbar = 'pixiv-toolbar',
  PixivMangaViewer = 'pixiv-manga-viewer',
  DanbooruPool = 'danbooru-pool',
  YandeBrowse = 'yande-browse'
}

interface ThumbnailBtnProp {
  id: string | number;
  page?: number;
  type?: ThumbnailBtnType;
  onClick: (btn: ThumbnailButton) => any;
}

export class ThumbnailButton extends HTMLElement {
  private status: ThumbnailBtnStatus;
  private mediaId: number;
  private page?: number;
  private type?: ThumbnailBtnType;
  private onClick: ThumbnailBtnProp['onClick'];

  constructor(props: ThumbnailBtnProp) {
    super();
    this.status = ThumbnailBtnStatus.Init;
    this.mediaId = this.checkNumberValidity(props.id);
    props.page !== undefined && (this.page = this.checkNumberValidity(props.page));
    this.type = props.type;
    this.onClick = props.onClick;

    this.render();
  }

  private checkNumberValidity(num: number | string): number {
    if (typeof num === 'string') {
      if (num !== '') {
        num = +num;
      } else {
        throw new RangeError('Argument can not be "".');
      }
    }

    if (num < 0 || !Number.isSafeInteger(num)) {
      throw new RangeError(`Invalid number: ${num}, must be a non-negative integer.`);
    }

    return num;
  }

  static get observedAttributes() {
    return ['data-id', 'data-status', 'data-page', 'disabled'];
  }

  private attributeChangedCallback(
    name: 'data-id' | 'data-status' | 'data-page' | 'disabled',
    oldValue: string | null,
    newValue: string | null
  ) {
    switch (name) {
      case 'data-id':
        this.updateId(newValue);
        break;
      case 'data-status':
        this.updateIcon(newValue);
        break;
      case 'data-page':
        this.updatePage(newValue);
        break;
      case 'disabled':
        this.updateDisableStatus(newValue);
        break;
      default:
        break;
    }
  }

  private updateId(id: string | null) {
    try {
      if (id === null) throw new Error('Attribute "data-id" is required.');
      this.mediaId = this.checkNumberValidity(id);
    } catch (error) {
      logger.error(error);
      this.dataset.id = String(this.mediaId);
    }
  }

  private updateDisableStatus(val: string | null) {
    const btn = this.shadowRoot!.querySelector('button')!;
    if (typeof val === 'string') {
      btn.setAttribute('disabled', '');
    } else {
      btn.removeAttribute('disabled');
    }
  }

  private updatePage(page: string | null) {
    try {
      if (page === null) {
        this.page = undefined;
      } else {
        this.page = this.checkNumberValidity(page);
      }
    } catch (error) {
      logger.error(error);
      if (this.page === undefined) {
        delete this.dataset.page;
      } else {
        this.dataset.page = String(this.page);
      }
    }
  }

  private updateIcon(status: string | null) {
    if (status === null) {
      status = ThumbnailBtnStatus.Init;
    } else if (!(status in iconTypeMap)) {
      this.dataset.status = this.status;
      return;
    }

    const useEl = this.shadowRoot!.querySelector('use')!;

    this.status = status as ThumbnailBtnStatus;
    useEl.setAttribute('xlink:href', iconTypeMap[status]);

    useEl.animate(
      [
        {
          opacity: 0.5
        },
        {
          opactiy: 1
        }
      ],
      {
        duration: 200
      }
    );
  }

  private render() {
    const shadowRoot = this.attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = `    <style>${btnStyle}</style>${svgGroup}<button part="button" class="pdl-thumbnail">
      <svg xmlns="http://www.w3.org/2000/svg" class="pdl-icon">
        <use xlink:href="#pdl-download"></use>
      </svg>
      <span></span>
    </button>`;

    // Danbooru pool的id不作记录
    this.type !== ThumbnailBtnType.DanbooruPool &&
      historyDb.has(this.mediaId).then((downloaded: boolean) => {
        downloaded && this.setStatus(ThumbnailBtnStatus.Complete);
      });

    this.dataset.id = String(this.mediaId);
    this.page !== undefined && !Number.isNaN(this.page) && (this.dataset.page = String(this.page));
    this.type && (this.dataset.type = this.type);
  }

  private connectedCallback() {
    this.shadowRoot!.lastElementChild!.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();

      this.setAttribute('disabled', '');
      this.setStatus(ThumbnailBtnStatus.Loading);

      Promise.resolve(this.onClick(this))
        .then(
          () => {
            this.setStatus(ThumbnailBtnStatus.Complete);
          },
          (err: any) => {
            if (err) logger.error(err);
            this.setStatus(ThumbnailBtnStatus.Error);
          }
        )
        .finally(() => {
          this.removeAttribute('disabled');
        });
    });
  }

  public setProgress(progress: number, updateProgressbar = true) {
    if (progress < 0 || progress > 100) throw new RangeError('Value "progress" must between 0-100');

    const shadowRoot = this.shadowRoot!;
    const span = shadowRoot.querySelector('span')!;

    if (this.status !== ThumbnailBtnStatus.Progress) {
      this.dataset.status = ThumbnailBtnStatus.Progress;
      span.classList.toggle('show');
    }

    span.textContent = String(Math.floor(progress));

    if (!updateProgressbar) return;
    const svg = shadowRoot.querySelector<SVGElement>('svg.pdl-icon')!;

    // circle半径
    const radius = 224;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    svg.style.strokeDashoffset = String(offset);
  }

  public removeProgress() {
    const shadowRoot = this.shadowRoot!;
    const span = shadowRoot.querySelector('span')!;
    const svg = shadowRoot.querySelector<SVGElement>('svg.pdl-icon')!;

    span.classList.toggle('show');
    span.addEventListener(
      'transitionend',
      () => {
        span.textContent = '';
      },
      { once: true }
    );

    svg.style.removeProperty('stroke-dashoffset');
    if (this.status === ThumbnailBtnStatus.Progress) this.dataset.status = ThumbnailBtnStatus.Init;
  }

  public setStatus(status: ThumbnailBtnStatus) {
    if (status !== this.status) {
      if (status === ThumbnailBtnStatus.Progress) {
        this.setProgress(0);
        return;
      }

      if (this.status === ThumbnailBtnStatus.Progress) {
        this.removeProgress();
      }

      this.dataset.status = status;
    }
  }
}

customElements.define('pdl-button', ThumbnailButton);
