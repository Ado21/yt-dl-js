import path from 'node:path'
import fs from 'node:fs'
import { YouTubeExtractor, WebClientExtractor } from './extractor/youtube.js'
import { PlaylistExtractor } from './extractor/playlist.js'
import { HttpDownloader } from './downloader/http.js'
import { FFmpegPostProcessor } from './postprocessor/ffmpeg.js'
import {
  parseVideoId, parsePlaylistId, isPlaylistUrl,
  sanitizeFilename, buildOutputPath, formatBytes, formatDuration,
  ExtractionError, DownloadError, FormatError
} from './utils.js'

export class YoutubeDL {
  constructor(options = {}) {
    this.output = options.output || '.'
    this.verbose = options.verbose || false
    this.quality = options.quality || 2
    this.onProgress = options.onProgress || null
    this.extractor = new WebClientExtractor()
    this.playlistExtractor = new PlaylistExtractor()
    this.downloader = new HttpDownloader({ verbose: this.verbose })
    this.ffmpeg = null
    this._ffmpegChecked = false

    if (this.onProgress) {
      this.downloader.onProgress(this.onProgress)
    }
  }

  _ensureFfmpeg() {
    if (!this._ffmpegChecked) {
      this.ffmpeg = new FFmpegPostProcessor({ quality: this.quality, verbose: this.verbose })
      if (this.onProgress) this.ffmpeg.onProgress(this.onProgress)
      this._ffmpegChecked = true
    }
    return this.ffmpeg
  }

  async getInfo(url) {
    const videoId = parseVideoId(url)
    if (!videoId) throw new ExtractionError(`Cannot parse video URL: ${url}`)
    return this.extractor.extract(videoId)
  }

  async download(url, options = {}) {
    if (isPlaylistUrl(url) && !parseVideoId(url)) {
      return this.downloadPlaylist(url, options)
    }

    const info = await this.getInfo(url)
    const audioOnly = options.audioOnly || false
    const outputDir = options.output || this.output

    if (audioOnly) {
      return this._downloadAudio(info, outputDir, options)
    }
    return this._downloadVideo(info, outputDir, options)
  }

  async _downloadAudio(info, outputDir, options = {}) {
    const format = this.extractor.selectFormat(info.formats, { audioOnly: true, fast: true })

    if (this.verbose) {
      this._log(`Audio: ${format.formatId} ${format.ext} ${format.audioBitrate || '?'}kbps`)
    }

    const tmpPath = buildOutputPath(outputDir, info.title, format.ext)
    const mp3Path = buildOutputPath(outputDir, info.title, 'mp3')

    const ffmpeg = this._ensureFfmpeg()

    if (options.streamPipe !== false) {
      const stream = await this.downloader.downloadToStream(format.url)
      await ffmpeg.convertStreamToMp3(stream, mp3Path, { quality: options.quality || this.quality })
    } else {
      await this.downloader.download(format.url, tmpPath)
      await ffmpeg.convertToMp3(tmpPath, mp3Path, { quality: options.quality || this.quality })
      try { fs.unlinkSync(tmpPath) } catch {}
    }

    return {
      filepath: mp3Path,
      info: {
        id: info.id,
        title: info.title,
        duration: info.duration,
        author: info.author,
        format: 'mp3'
      }
    }
  }

  async _downloadVideo(info, outputDir, options = {}) {
    const selected = this.extractor.selectFormat(info.formats, { audioOnly: false })

    if (selected.needsMerge) {
      return this._downloadMerged(info, selected, outputDir, options)
    }

    const filepath = buildOutputPath(outputDir, info.title, selected.ext || 'mp4')

    if (this.verbose) {
      this._log(`Video: ${selected.formatId} ${selected.ext} ${selected.qualityLabel || selected.quality}`)
    }

    await this.downloader.download(selected.url, filepath)

    return {
      filepath,
      info: {
        id: info.id,
        title: info.title,
        duration: info.duration,
        author: info.author,
        format: selected.ext
      }
    }
  }

  async _downloadMerged(info, selected, outputDir, options = {}) {
    const videoFmt = selected.video
    const audioFmt = selected.audio
    const ffmpeg = this._ensureFfmpeg()

    const videoTmp = buildOutputPath(outputDir, `${info.title}_video`, videoFmt.ext || 'mp4')
    const audioTmp = buildOutputPath(outputDir, `${info.title}_audio`, audioFmt?.ext || 'm4a')
    const outputPath = buildOutputPath(outputDir, info.title, 'mp4')

    if (this.verbose) {
      this._log(`Video: ${videoFmt.formatId} ${videoFmt.qualityLabel || videoFmt.quality}`)
      if (audioFmt) this._log(`Audio: ${audioFmt.formatId} ${audioFmt.audioBitrate || '?'}kbps`)
    }

    if (audioFmt) {
      await Promise.all([
        this.downloader.download(videoFmt.url, videoTmp),
        this.downloader.download(audioFmt.url, audioTmp)
      ])
      await ffmpeg.mergeVideoAudio(videoTmp, audioTmp, outputPath)
    } else {
      await this.downloader.download(videoFmt.url, outputPath)
    }

    return {
      filepath: outputPath,
      info: {
        id: info.id,
        title: info.title,
        duration: info.duration,
        author: info.author,
        format: 'mp4'
      }
    }
  }

  async downloadPlaylist(url, options = {}) {
    const playlistId = parsePlaylistId(url)
    if (!playlistId) throw new ExtractionError(`Cannot parse playlist URL: ${url}`)

    const playlist = await this.playlistExtractor.extract(playlistId)
    const outputDir = options.output || path.join(this.output, sanitizeFilename(playlist.title))
    const results = []
    const errors = []

    this._log(`Playlist: ${playlist.title} (${playlist.entries.length} videos)`)

    for (let i = 0; i < playlist.entries.length; i++) {
      const entry = playlist.entries[i]
      this._log(`[${i + 1}/${playlist.entries.length}] ${entry.title}`)

      try {
        const result = await this.download(
          `https://www.youtube.com/watch?v=${entry.videoId}`,
          { ...options, output: outputDir }
        )
        results.push(result)
      } catch (err) {
        errors.push({ videoId: entry.videoId, title: entry.title, error: err.message })
        this._log(`  Error: ${err.message}`)
      }
    }

    return {
      playlist: { id: playlist.id, title: playlist.title },
      results,
      errors,
      total: playlist.entries.length,
      success: results.length,
      failed: errors.length
    }
  }

  _log(msg) {
    if (this.verbose || this.onProgress) {
      process.stderr.write(msg + '\n')
    }
  }
}
