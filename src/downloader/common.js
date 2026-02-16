export class BaseDownloader {
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

  _calcSpeed(startTime, downloaded) {
    const elapsed = (Date.now() - startTime) / 1000
    return elapsed > 0 ? downloaded / elapsed : 0
  }

  _calcEta(speed, remaining) {
    return speed > 0 ? Math.round(remaining / speed) : null
  }
}
