import https from 'node:https'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { BaseDownloader } from './common.js'
import { DownloadError, retry } from '../utils.js'

export class HttpDownloader extends BaseDownloader {
  constructor(options = {}) {
    super(options)
    this.chunkSize = options.chunkSize || 10 * 1024 * 1024
  }

  async download(url, filepath, options = {}) {
    const dir = path.dirname(filepath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const tmpPath = filepath + '.part'
    let resumeBytes = 0

    if (fs.existsSync(tmpPath) && options.resume !== false) {
      resumeBytes = fs.statSync(tmpPath).size
    }

    const headers = { ...this._buildHeaders(options), 'Accept-Encoding': 'identity' }
    if (resumeBytes > 0) headers['Range'] = `bytes=${resumeBytes}-`

    const res = await this._makeRequest(url, headers)
    const statusCode = res.statusCode

    if (statusCode === 416) {
      if (fs.existsSync(tmpPath)) {
        fs.renameSync(tmpPath, filepath)
        return filepath
      }
    }

    if (statusCode >= 400) {
      throw new DownloadError(`HTTP ${statusCode} downloading ${url}`)
    }

    const isResume = statusCode === 206
    const contentLength = res.headers['content-length'] ? parseInt(res.headers['content-length'], 10) : null
    const totalBytes = contentLength ? (isResume ? resumeBytes + contentLength : contentLength) : null

    const flags = isResume ? 'a' : 'w'
    const fileStream = fs.createWriteStream(tmpPath, { flags })
    const startTime = Date.now()
    let downloaded = isResume ? resumeBytes : 0

    return new Promise((resolve, reject) => {
      res.on('data', (chunk) => {
        downloaded += chunk.length
        this._reportProgress({
          status: 'downloading',
          downloaded,
          total: totalBytes,
          speed: this._calcSpeed(startTime, downloaded - (isResume ? resumeBytes : 0)),
          eta: totalBytes ? this._calcEta(
            this._calcSpeed(startTime, downloaded - (isResume ? resumeBytes : 0)),
            totalBytes - downloaded
          ) : null,
          percent: totalBytes ? Math.round((downloaded / totalBytes) * 100) : null,
          phase: 'downloading'
        })
      })

      res.on('error', (err) => {
        fileStream.destroy()
        reject(new DownloadError(`Download failed: ${err.message}`))
      })

      fileStream.on('error', (err) => {
        reject(new DownloadError(`File write failed: ${err.message}`))
      })

      res.pipe(fileStream)

      fileStream.on('finish', () => {
        this._reportProgress({
          status: 'finished',
          downloaded,
          total: totalBytes,
          speed: this._calcSpeed(startTime, downloaded - (isResume ? resumeBytes : 0)),
          percent: 100,
          phase: 'downloading'
        })

        fs.renameSync(tmpPath, filepath)
        resolve(filepath)
      })
    })
  }

  async downloadToStream(url, options = {}) {
    const headers = { ...this._buildHeaders(options), 'Accept-Encoding': 'identity' }
    const res = await this._makeRequest(url, headers)

    if (res.statusCode >= 400) {
      throw new DownloadError(`HTTP ${res.statusCode}`)
    }

    const contentLength = res.headers['content-length'] ? parseInt(res.headers['content-length'], 10) : null
    const startTime = Date.now()
    let downloaded = 0

    res.on('data', (chunk) => {
      downloaded += chunk.length
      this._reportProgress({
        status: 'downloading',
        downloaded,
        total: contentLength,
        speed: this._calcSpeed(startTime, downloaded),
        eta: contentLength ? this._calcEta(this._calcSpeed(startTime, downloaded), contentLength - downloaded) : null,
        percent: contentLength ? Math.round((downloaded / contentLength) * 100) : null,
        phase: 'downloading'
      })
    })

    res.contentLength = contentLength
    return res
  }

  _buildHeaders(options = {}) {
    return {
      'User-Agent': options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ...(options.headers || {})
    }
  }

  _makeRequest(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? https : http
      const req = mod.get(url, { headers, timeout: 30000 }, resolve)
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new DownloadError('Connection timeout')) })
    })
  }
}
