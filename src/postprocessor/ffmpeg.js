import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { BasePostProcessor } from './common.js'
import { PostProcessError } from '../utils.js'

const ACODECS = {
  mp3: { ext: 'mp3', encoder: 'libmp3lame', opts: [] },
  aac: { ext: 'm4a', encoder: 'aac', opts: ['-f', 'adts'] },
  m4a: { ext: 'm4a', encoder: 'aac', opts: ['-bsf:a', 'aac_adtstoasc'] },
  opus: { ext: 'opus', encoder: 'libopus', opts: [] },
  vorbis: { ext: 'ogg', encoder: 'libvorbis', opts: [] },
  flac: { ext: 'flac', encoder: 'flac', opts: [] },
  wav: { ext: 'wav', encoder: null, opts: ['-f', 'wav'] }
}

export class FFmpegPostProcessor extends BasePostProcessor {
  constructor(options = {}) {
    super(options)
    this.ffmpegPath = options.ffmpegPath || this._findFfmpeg()
    this.quality = options.quality || 2
  }

  _findFfmpeg() {
    const names = ['ffmpeg']
    for (const name of names) {
      try {
        execFileSync(name, ['-version'], { stdio: 'pipe' })
        return name
      } catch {}
    }
    try {
      const which = execFileSync('which', ['ffmpeg'], { encoding: 'utf8', stdio: 'pipe' }).trim()
      if (which) return which
    } catch {}
    throw new PostProcessError('ffmpeg not found. Install ffmpeg to convert audio/video.')
  }

  async convertToMp3(inputPath, outputPath, options = {}) {
    const quality = options.quality ?? this.quality
    if (!outputPath) {
      const dir = path.dirname(inputPath)
      const name = path.basename(inputPath, path.extname(inputPath))
      outputPath = path.join(dir, `${name}.mp3`)
    }

    const args = [
      '-y', '-loglevel', 'error',
      '-i', inputPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-q:a', String(quality),
      outputPath
    ]

    await this._runFfmpeg(args)
    return outputPath
  }

  async convertStreamToMp3(inputStream, outputPath, options = {}) {
    const quality = options.quality ?? this.quality

    const args = [
      '-y', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-vn',
      '-acodec', 'libmp3lame',
      '-q:a', String(quality),
      outputPath
    ]

    this._reportProgress({ status: 'started', phase: 'converting', output: outputPath })

    return new Promise((resolve, reject) => {
      const proc = spawn(this.ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })
      let stderr = ''

      proc.stderr.on('data', (data) => { stderr += data.toString() })

      proc.on('close', (code) => {
        if (code === 0) {
          this._reportProgress({ status: 'finished', phase: 'converting', output: outputPath })
          resolve(outputPath)
        } else {
          reject(new PostProcessError(`ffmpeg exited with code ${code}: ${stderr.slice(0, 500)}`))
        }
      })

      proc.on('error', (err) => {
        reject(new PostProcessError(`ffmpeg process error: ${err.message}`))
      })

      proc.stdin.on('error', () => {})

      inputStream.pipe(proc.stdin)
    })
  }

  async mergeVideoAudio(videoPath, audioPath, outputPath) {
    const args = [
      '-y', '-loglevel', 'error',
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      outputPath
    ]

    await this._runFfmpeg(args)

    try {
      if (videoPath !== outputPath) fs.unlinkSync(videoPath)
      if (audioPath !== outputPath) fs.unlinkSync(audioPath)
    } catch {}

    return outputPath
  }

  async convertToFormat(inputPath, outputPath, format) {
    const codec = ACODECS[format]
    if (!codec) throw new PostProcessError(`Unsupported format: ${format}`)

    const args = [
      '-y', '-loglevel', 'error',
      '-i', inputPath,
      '-vn'
    ]

    if (codec.encoder) {
      args.push('-acodec', codec.encoder)
    }
    if (format === 'mp3') {
      args.push('-q:a', String(this.quality))
    }
    args.push(...codec.opts, outputPath)

    await this._runFfmpeg(args)
    return outputPath
  }

  _runFfmpeg(args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })
      let stderr = ''

      proc.stderr.on('data', (data) => { stderr += data.toString() })

      proc.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new PostProcessError(`ffmpeg exited with code ${code}: ${stderr.slice(0, 500)}`))
      })

      proc.on('error', (err) => {
        reject(new PostProcessError(`ffmpeg process error: ${err.message}`))
      })
    })
  }
}
