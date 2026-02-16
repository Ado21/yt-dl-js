export { YoutubeDL } from './src/YoutubeDL.js'
export { YouTubeExtractor, WebClientExtractor } from './src/extractor/youtube.js'
export { PlaylistExtractor } from './src/extractor/playlist.js'
export { HttpDownloader } from './src/downloader/http.js'
export { FFmpegPostProcessor } from './src/postprocessor/ffmpeg.js'
export {
  parseVideoId, parsePlaylistId, isPlaylistUrl,
  sanitizeFilename, formatBytes, formatDuration,
  YtDlpError, ExtractionError, DownloadError, PostProcessError, FormatError
} from './src/utils.js'
export { search, searchFirst } from './src/search.js'

export async function extractInfo(url, options = {}) {
  const { YoutubeDL: YDL } = await import('./src/YoutubeDL.js')
  const ydl = new YDL(options)
  return ydl.getInfo(url)
}

export async function download(url, options = {}) {
  const { YoutubeDL: YDL } = await import('./src/YoutubeDL.js')
  const ydl = new YDL(options)
  return ydl.download(url, options)
}

export async function downloadAudio(url, options = {}) {
  const { YoutubeDL: YDL } = await import('./src/YoutubeDL.js')
  const ydl = new YDL(options)
  return ydl.download(url, { ...options, audioOnly: true })
}

export async function getUrl(url, options = {}) {
  const { YoutubeDL: YDL } = await import('./src/YoutubeDL.js')
  const ydl = new YDL(options)
  const info = await ydl.getInfo(url)
  const format = ydl.extractor.selectFormat(info.formats, {
    audioOnly: options.audioOnly || false
  })

  if (format.needsMerge) {
    return {
      videoUrl: format.video.url,
      audioUrl: format.audio?.url || null,
      needsMerge: true,
      info,
      format
    }
  }

  return {
    url: format.url,
    needsMerge: false,
    info,
    format
  }
}

export async function searchAndDownload(query, options = {}) {
  const { searchFirst: sf } = await import('./src/search.js')
  const result = await sf(query)
  if (!result) throw new Error(`No se encontraron resultados para: "${query}"`)
  return download(result.url, options)
}
