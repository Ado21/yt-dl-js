export class BasePostProcessor {
  constructor(options = {}) {
    this._progressCallbacks = []
    this.verbose = options.verbose || false
  }

  onProgress(callback) {
    this._progressCallbacks.push(callback)
    return this
  }

  _reportProgress(info) {
    for (const cb of this._progressCallbacks) {
      cb(info)
    }
  }

  async run(info) {
    return info
  }
}
