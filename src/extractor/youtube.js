import vm from 'node:vm'
import {
  INNERTUBE_CLIENTS, CLIENT_PRIORITY,
  fetchPlayerResponse, fetchWebPage, extractPlayerUrl, extractSts,
  buildApiHeaders
} from './common.js'
import {
  parseVideoId, mimetype2ext, parseCodecs,
  ExtractionError, FormatError, httpRequest, retry
} from '../utils.js'

export class YouTubeExtractor {
  constructor() {
    this._playerCache = new Map()
  }

  async extract(urlOrId) {
    const videoId = parseVideoId(urlOrId)
    if (!videoId) throw new ExtractionError(`Cannot parse video ID from: ${urlOrId}`)

    let lastError = null
    for (const clientName of CLIENT_PRIORITY) {
      const client = INNERTUBE_CLIENTS[clientName]
      try {
        const response = await retry(() => fetchPlayerResponse(videoId, client), 1, 500)
        const info = this._parseResponse(response, clientName)
        if (info.formats.length > 0) return info
      } catch (err) {
        lastError = err
      }
    }

    if (lastError) throw lastError
    throw new ExtractionError(`Could not extract video info for ${videoId}`)
  }

  _parseResponse(data, clientName) {
    const details = data.videoDetails || {}
    const microformat = data.microformat?.playerMicroformatRenderer || {}
    const streaming = data.streamingData || {}

    const info = {
      id: details.videoId,
      title: details.title || microformat.title?.simpleText || 'Unknown',
      description: details.shortDescription || '',
      duration: parseInt(details.lengthSeconds, 10) || 0,
      viewCount: parseInt(details.viewCount, 10) || 0,
      author: details.author || microformat.ownerChannelName || '',
      channelId: details.channelId || '',
      isLive: details.isLiveContent === true,
      thumbnails: details.thumbnail?.thumbnails || [],
      formats: [],
      clientName
    }

    const allFormats = [
      ...(streaming.formats || []),
      ...(streaming.adaptiveFormats || [])
    ]

    for (const fmt of allFormats) {
      const parsed = this._parseFormat(fmt)
      if (parsed) info.formats.push(parsed)
    }

    return info
  }

  _parseFormat(fmt) {
    const url = fmt.url
    if (!url) return null

    const mimeType = fmt.mimeType || ''
    const ext = mimetype2ext(mimeType.split(';')[0].trim())
    const { vcodec, acodec } = parseCodecs(mimeType)
    const isAudioOnly = mimeType.startsWith('audio/')

    return {
      formatId: String(fmt.itag),
      itag: fmt.itag,
      url,
      ext: isAudioOnly ? (ext === 'mp4' ? 'm4a' : ext) : ext,
      mimeType,
      vcodec: isAudioOnly ? 'none' : vcodec,
      acodec,
      width: fmt.width || null,
      height: fmt.height || null,
      fps: fmt.fps || null,
      bitrate: fmt.bitrate || 0,
      audioBitrate: fmt.averageBitrate ? Math.round(fmt.averageBitrate / 1000) : (isAudioOnly ? Math.round((fmt.bitrate || 0) / 1000) : null),
      audioSampleRate: fmt.audioSampleRate ? parseInt(fmt.audioSampleRate, 10) : null,
      audioChannels: fmt.audioChannels || null,
      filesize: fmt.contentLength ? parseInt(fmt.contentLength, 10) : null,
      quality: fmt.quality || '',
      qualityLabel: fmt.qualityLabel || '',
      audioQuality: fmt.audioQuality || '',
      isAudioOnly,
      isVideoOnly: !isAudioOnly && acodec === 'none',
      approxDurationMs: fmt.approxDurationMs ? parseInt(fmt.approxDurationMs, 10) : null
    }
  }

  selectBestAudio(formats) {
    const audioFormats = formats.filter(f => f.isAudioOnly)
    if (audioFormats.length === 0) throw new FormatError('No audio-only formats available')

    return audioFormats.sort((a, b) => {
      const qualityOrder = { AUDIO_QUALITY_HIGH: 3, AUDIO_QUALITY_MEDIUM: 2, AUDIO_QUALITY_LOW: 1 }
      const qa = qualityOrder[a.audioQuality] || 0
      const qb = qualityOrder[b.audioQuality] || 0
      if (qa !== qb) return qb - qa
      return (b.bitrate || 0) - (a.bitrate || 0)
    })[0]
  }

  selectFastAudio(formats) {
    const audioFormats = formats.filter(f => f.isAudioOnly)
    if (audioFormats.length === 0) throw new FormatError('No audio-only formats available')

    const medium = audioFormats.filter(f =>
      f.audioQuality === 'AUDIO_QUALITY_MEDIUM' || (f.bitrate && f.bitrate < 200000)
    )
    const pool = medium.length > 0 ? medium : audioFormats

    return pool.sort((a, b) => {
      const sizeA = a.filesize || (a.bitrate || 0)
      const sizeB = b.filesize || (b.bitrate || 0)
      return sizeA - sizeB
    })[0]
  }

  selectBestVideo(formats) {
    const combined = formats.filter(f => !f.isAudioOnly && f.vcodec !== 'none' && f.acodec !== 'none')
    if (combined.length > 0) {
      return combined.sort((a, b) => (b.height || 0) - (a.height || 0) || (b.bitrate || 0) - (a.bitrate || 0))[0]
    }

    const videoOnly = formats.filter(f => !f.isAudioOnly && f.vcodec !== 'none')
    const audio = formats.filter(f => f.isAudioOnly)

    if (videoOnly.length === 0) throw new FormatError('No video formats available')

    const bestVideo = videoOnly.sort((a, b) => (b.height || 0) - (a.height || 0) || (b.bitrate || 0) - (a.bitrate || 0))[0]
    const bestAudio = audio.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] || null

    return { video: bestVideo, audio: bestAudio, needsMerge: true }
  }

  selectFormat(formats, options = {}) {
    if (options.audioOnly) {
      return options.fast !== false ? this.selectFastAudio(formats) : this.selectBestAudio(formats)
    }
    return this.selectBestVideo(formats)
  }
}

export class WebClientExtractor extends YouTubeExtractor {
  constructor() {
    super()
    this._sigFuncCache = new Map()
    this._nFuncCache = new Map()
  }

  async extract(urlOrId) {
    const videoId = parseVideoId(urlOrId)
    if (!videoId) throw new ExtractionError(`Cannot parse video ID from: ${urlOrId}`)

    let lastError = null

    for (const clientName of CLIENT_PRIORITY) {
      const client = INNERTUBE_CLIENTS[clientName]
      try {
        const response = await retry(() => fetchPlayerResponse(videoId, client), 1, 500)
        const info = this._parseResponse(response, clientName)
        if (info.formats.length > 0) return info
      } catch (err) {
        lastError = err
      }
    }

    try {
      const html = await fetchWebPage(videoId)
      const playerUrl = extractPlayerUrl(html)
      if (playerUrl) {
        const playerJs = await this._fetchPlayerJs(playerUrl)
        const sts = extractSts(playerJs)
        const client = INNERTUBE_CLIENTS.web
        const response = await fetchPlayerResponse(videoId, client, { sts })
        const info = this._parseResponseWithChallenges(response, playerJs, 'web')
        if (info.formats.length > 0) return info
      }
    } catch (err) {
      lastError = err
    }

    if (lastError) throw lastError
    throw new ExtractionError(`Could not extract video info for ${videoId}`)
  }

  _parseResponseWithChallenges(data, playerJs, clientName) {
    const info = this._parseResponse(data, clientName)
    const streaming = data.streamingData || {}
    const allRawFormats = [...(streaming.formats || []), ...(streaming.adaptiveFormats || [])]
    const resolvedFormats = []

    for (const fmt of allRawFormats) {
      let url = fmt.url
      if (!url && fmt.signatureCipher) {
        url = this._resolveSignatureCipher(fmt.signatureCipher, playerJs)
      }
      if (!url) continue

      url = this._resolveNParameter(url, playerJs)

      const mimeType = fmt.mimeType || ''
      const ext = mimetype2ext(mimeType.split(';')[0].trim())
      const { vcodec, acodec } = parseCodecs(mimeType)
      const isAudioOnly = mimeType.startsWith('audio/')

      resolvedFormats.push({
        formatId: String(fmt.itag),
        itag: fmt.itag,
        url,
        ext: isAudioOnly ? (ext === 'mp4' ? 'm4a' : ext) : ext,
        mimeType,
        vcodec: isAudioOnly ? 'none' : vcodec,
        acodec,
        width: fmt.width || null,
        height: fmt.height || null,
        fps: fmt.fps || null,
        bitrate: fmt.bitrate || 0,
        audioBitrate: fmt.averageBitrate ? Math.round(fmt.averageBitrate / 1000) : (isAudioOnly ? Math.round((fmt.bitrate || 0) / 1000) : null),
        audioSampleRate: fmt.audioSampleRate ? parseInt(fmt.audioSampleRate, 10) : null,
        audioChannels: fmt.audioChannels || null,
        filesize: fmt.contentLength ? parseInt(fmt.contentLength, 10) : null,
        quality: fmt.quality || '',
        qualityLabel: fmt.qualityLabel || '',
        audioQuality: fmt.audioQuality || '',
        isAudioOnly,
        isVideoOnly: !isAudioOnly && acodec === 'none',
        approxDurationMs: fmt.approxDurationMs ? parseInt(fmt.approxDurationMs, 10) : null
      })
    }

    info.formats = resolvedFormats
    return info
  }

  _resolveSignatureCipher(cipher, playerJs) {
    const params = new URLSearchParams(cipher)
    const url = params.get('url')
    const s = params.get('s')
    const sp = params.get('sp') || 'signature'

    if (!url || !s) return null

    try {
      const sigFunc = this._extractSigFunction(playerJs)
      const decoded = sigFunc(s)
      const sep = url.includes('?') ? '&' : '?'
      return `${url}${sep}${sp}=${encodeURIComponent(decoded)}`
    } catch {
      return null
    }
  }

  _resolveNParameter(url, playerJs) {
    try {
      const u = new URL(url)
      const n = u.searchParams.get('n')
      if (!n) return url

      const nFunc = this._extractNFunction(playerJs)
      const transformed = nFunc(n)
      if (transformed && transformed !== n) {
        u.searchParams.set('n', transformed)
        return u.toString()
      }
    } catch {}
    return url
  }

  _extractSigFunction(playerJs) {
    const cacheKey = playerJs.length
    if (this._sigFuncCache.has(cacheKey)) return this._sigFuncCache.get(cacheKey)

    const funcNameMatch = playerJs.match(
      /\b[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*encodeURIComponent\(([a-zA-Z0-9$]+)\(/
    ) || playerJs.match(
      /\b[a-zA-Z0-9]+\s*&&\s*[a-zA-Z0-9]+\.set\([^,]+\s*,\s*encodeURIComponent\(([a-zA-Z0-9$]+)\(/
    ) || playerJs.match(
      /\bm=([a-zA-Z0-9$]{2,})\(decodeURIComponent\(h\.s\)\)/
    ) || playerJs.match(
      /\bc\s*&&\s*d\.set\([^,]+\s*,\s*(?:encodeURIComponent\s*\()([a-zA-Z0-9$]+)\(/
    ) || playerJs.match(
      /\bc\s*&&\s*[a-z]\.set\([^,]+\s*,\s*([a-zA-Z0-9$]+)\(/
    ) || playerJs.match(
      /\bc\s*&&\s*[a-z]\.set\([^,]+\s*,\s*encodeURIComponent\(([a-zA-Z0-9$]+)\(/
    )

    if (!funcNameMatch) throw new ExtractionError('Could not extract signature function name')

    const funcName = funcNameMatch[1]
    const escaped = funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const funcBodyMatch = playerJs.match(
      new RegExp(`(?:var\\s+)?${escaped}\\s*=\\s*function\\s*\\(([^)]+)\\)\\s*\\{([^}]+(?:\\{[^}]*\\}[^}]*)*)\\}`)
    ) || playerJs.match(
      new RegExp(`function\\s+${escaped}\\s*\\(([^)]+)\\)\\s*\\{([^}]+(?:\\{[^}]*\\}[^}]*)*)\\}`)
    )

    if (!funcBodyMatch) throw new ExtractionError('Could not extract signature function body')

    const helperMatch = funcBodyMatch[2].match(/;([a-zA-Z0-9$]{2,})\./)
    let helperObj = ''
    if (helperMatch) {
      const helperName = helperMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const helperObjMatch = playerJs.match(
        new RegExp(`var\\s+${helperName}\\s*=\\s*\\{([\\s\\S]*?)\\};`)
      )
      if (helperObjMatch) {
        helperObj = `var ${helperMatch[1]}={${helperObjMatch[1]}};`
      }
    }

    const code = `${helperObj}var ${funcName}=function(${funcBodyMatch[1]}){${funcBodyMatch[2]}};${funcName}(sig);`
    const fn = (sig) => {
      const ctx = vm.createContext({ sig })
      return vm.runInContext(code, ctx, { timeout: 5000 })
    }

    this._sigFuncCache.set(cacheKey, fn)
    return fn
  }

  _extractNFunction(playerJs) {
    const cacheKey = 'n_' + playerJs.length
    if (this._nFuncCache.has(cacheKey)) return this._nFuncCache.get(cacheKey)

    const nFuncMatch = playerJs.match(
      /\.get\("n"\)\)&&\(b=([a-zA-Z0-9$]+)(?:\[(\d+)\])?\(b\)/
    ) || playerJs.match(
      /\(b=([a-zA-Z0-9$]+)(?:\[(\d+)\])?\(b\)/
    )

    if (!nFuncMatch) {
      const identity = (n) => n
      this._nFuncCache.set(cacheKey, identity)
      return identity
    }

    let funcName = nFuncMatch[1]
    const arrayIdx = nFuncMatch[2]

    if (arrayIdx !== undefined) {
      const arrMatch = playerJs.match(
        new RegExp(`var\\s+${funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*\\[([^\\]]+)\\]`)
      )
      if (arrMatch) {
        const items = arrMatch[1].split(',').map(s => s.trim())
        funcName = items[parseInt(arrayIdx, 10)] || funcName
      }
    }

    const escaped = funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const nBodyMatch = playerJs.match(
      new RegExp(`${escaped}\\s*=\\s*function\\s*\\(([^)]+)\\)\\s*\\{((?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*)\\}`)
    )

    if (!nBodyMatch) {
      const identity = (n) => n
      this._nFuncCache.set(cacheKey, identity)
      return identity
    }

    const code = `var ${funcName}=function(${nBodyMatch[1]}){${nBodyMatch[2]}};${funcName}(nval);`

    const fn = (n) => {
      try {
        const ctx = vm.createContext({ nval: n })
        return vm.runInContext(code, ctx, { timeout: 5000 })
      } catch {
        return n
      }
    }

    this._nFuncCache.set(cacheKey, fn)
    return fn
  }

  async _fetchPlayerJs(url) {
    if (this._playerCache.has(url)) return this._playerCache.get(url)
    const res = await httpRequest(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' }
    })
    this._playerCache.set(url, res.body)
    return res.body
  }
}
