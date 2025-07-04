export class RequestError extends Error {
  public url: string;
  public status: number;

  constructor(url: string, status: number) {
    super(status + ' ' + url);
    this.name = 'RequestError';
    this.url = url;
    this.status = status;
  }
}

export class CancelError extends Error {
  constructor() {
    super('User aborted.');
    this.name = 'CancelError';
  }
}

export class JsonDataError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'JsonDataError';
  }
}

export class TimoutError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'TimoutError';
  }
}

export class PermissionError extends Error {
  constructor() {
    super('Permission denied.');
    this.name = 'PermissionError';
  }
}

export class InvalidPostError extends Error {
  constructor(id: string) {
    super(`Invalid post id: ${id}.`);
    this.name = 'InvalidPostError';
  }
}
