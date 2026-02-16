import { URL } from 'node:url'
import path from 'node:path'

const VIDEO_ID_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/|live\/))([0-9A-Za-z_-]{11})/

const PLAYLIST_ID_RE = /[?&]list=((?:PL|LL|EC|UU|FL|RD|UL|TL|PU|OLAK5uy_)[0-9A-Za-z_-]{10,}|RDMM|WL|LL|LM)/

export function parseVideoId(url) {
  if (/^[0-9A-Za-z_-]{11}$/.test(url)) return url
  const m = url.match(VIDEO_ID_RE)
  return m ? m[1] : null
}

export function parsePlaylistId(url) {
  const m = url.match(PLAYLIST_ID_RE)
  return m ? m[1] : null
}

export function isPlaylistUrl(url) {
  return /[?&]list=/.test(url) && !/[?&]v=/.test(url)
}

export function sanitizeFilename(title) {
  return title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '-- B/s'
  return formatBytes(bytesPerSec) + '/s'
}

export function mimetype2ext(mimeType) {
  if (!mimeType) return null
  const base = mimeType.split(';')[0].trim()
  const map = {
    'audio/mp4': 'm4a',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/3gpp': '3gp',
    'application/x-mpegURL': 'm3u8',
    'application/dash+xml': 'mpd'
  }
  return map[base] || base.split('/')[1] || null
}

export function parseCodecs(mimeType) {
  if (!mimeType) return { vcodec: 'none', acodec: 'none' }
  const codecMatch = mimeType.match(/codecs="([^"]+)"/)
  if (!codecMatch) return { vcodec: 'none', acodec: 'none' }
  const codecs = codecMatch[1].split(',').map(c => c.trim())
  const videoCodecs = ['avc1', 'vp9', 'vp8', 'av01', 'hev1', 'hvc1']
  const audioCodecs = ['mp4a', 'opus', 'vorbis', 'ac-3', 'ec-3', 'flac']
  let vcodec = 'none'
  let acodec = 'none'
  for (const c of codecs) {
    const prefix = c.split('.')[0]
    if (videoCodecs.includes(prefix)) vcodec = c
    else if (audioCodecs.includes(prefix)) acodec = c
  }
  return { vcodec, acodec }
}

export function parseQs(urlStr) {
  try {
    const u = new URL(urlStr)
    return Object.fromEntries(u.searchParams.entries())
  } catch {
    const params = new URLSearchParams(urlStr)
    return Object.fromEntries(params.entries())
  }
}

export function updateUrlQuery(urlStr, params) {
  const u = new URL(urlStr)
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v)
  }
  return u.toString()
}

export function buildOutputPath(outputDir, title, ext) {
  const safe = sanitizeFilename(title)
  return path.join(outputDir || '.', `${safe}.${ext}`)
}

export class YtDlpError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'YtDlpError'
  }
}

export class ExtractionError extends YtDlpError {
  constructor(msg) {
    super(msg)
    this.name = 'ExtractionError'
  }
}

export class DownloadError extends YtDlpError {
  constructor(msg) {
    super(msg)
    this.name = 'DownloadError'
  }
}

export class PostProcessError extends YtDlpError {
  constructor(msg) {
    super(msg)
    this.name = 'PostProcessError'
  }
}

export class FormatError extends YtDlpError {
  constructor(msg) {
    super(msg)
    this.name = 'FormatError'
  }
}

export async function httpRequest(url, options = {}) {
  const mod = url.startsWith('https') ? await import('node:https') : await import('node:http')
  return new Promise((resolve, reject) => {
    const opts = {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 30000
    }
    const req = mod.default.request(url, opts, (res) => {
      if (options.stream) return resolve(res)
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString()
        resolve({ statusCode: res.statusCode, headers: res.headers, body })
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')) })
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
    req.end()
  })
}

export async function httpPost(url, body, headers = {}) {
  return httpRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body
  })
}

export async function httpGetJson(url, headers = {}) {
  const res = await httpRequest(url, { headers })
  return JSON.parse(res.body)
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export async function retry(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === maxRetries) throw err
      await sleep(baseDelay * Math.pow(2, i))
    }
  }
}
