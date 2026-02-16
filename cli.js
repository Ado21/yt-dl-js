#!/usr/bin/env node

import { YoutubeDL } from './src/YoutubeDL.js'
import { WebClientExtractor } from './src/extractor/youtube.js'
import { parseVideoId, parsePlaylistId, isPlaylistUrl, formatBytes, formatSpeed, formatDuration } from './src/utils.js'
import { search, searchFirst } from './src/search.js'

function isUrlLike(input) {
  if (/^[0-9A-Za-z_-]{11}$/.test(input)) return true
  if (/^https?:\/\//.test(input)) return true
  if (/youtu\.?be/.test(input)) return true
  return false
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const options = { urls: [], queries: [] }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--audio-only' || arg === '--audio' || arg === '-x') options.audioOnly = true
    else if (arg === '--info' || arg === '-i') options.infoOnly = true
    else if (arg === '--verbose' || arg === '-v') options.verbose = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--url-only' || arg === '-u') options.urlOnly = true
    else if (arg === '--search' || arg === '-s') {
      const query = args[++i]
      if (query) options.queries.push(query)
    }
    else if (arg === '--output' || arg === '-o') options.output = args[++i]
    else if (arg === '--format' || arg === '-f') options.format = args[++i]
    else if (arg === '--quality' || arg === '-q') options.quality = parseInt(args[++i], 10)
    else if (arg.startsWith('--output=')) options.output = arg.split('=').slice(1).join('=')
    else if (arg.startsWith('--format=')) options.format = arg.split('=').slice(1).join('=')
    else if (arg.startsWith('--quality=')) options.quality = parseInt(arg.split('=')[1], 10)
    else if (arg.startsWith('--search=')) options.queries.push(arg.split('=').slice(1).join('='))
    else if (!arg.startsWith('-')) {
      if (isUrlLike(arg)) {
        options.urls.push(arg)
      } else {
        options.queries.push(arg)
      }
    }
  }

  return options
}

function showHelp() {
  const help = `
yt-dl-js - YouTube downloader (JavaScript ESM)

Usage:
  yt-dl-js <URL> [opciones]          Descargar por URL
  yt-dl-js <titulo> [opciones]       Buscar y descargar por titulo
  yt-dl-js --search "query"          Buscar videos en YouTube

Options:
  -x, --audio-only    Descargar solo audio y convertir a MP3
      --audio         Alias de --audio-only
  -i, --info          Mostrar info del video sin descargar
  -u, --url-only      Mostrar solo la URL directa de descarga
  -s, --search <q>    Buscar videos en YouTube por titulo
  -o, --output <dir>  Directorio de salida (default: actual)
  -f, --format <fmt>  Formato preferido (best, mp3, mp4)
  -q, --quality <n>   Calidad de audio 0-9 (0=mejor, default: 2)
  -v, --verbose       Mostrar salida detallada
  -h, --help          Mostrar esta ayuda

Ejemplos:
  yt-dl-js "https://youtube.com/watch?v=dQw4w9WgXcQ"
  yt-dl-js "https://youtube.com/watch?v=dQw4w9WgXcQ" -x
  yt-dl-js "https://youtube.com/watch?v=dQw4w9WgXcQ" -u
  yt-dl-js "https://youtube.com/watch?v=dQw4w9WgXcQ" -u --audio
  yt-dl-js "Never Gonna Give You Up" -x
  yt-dl-js --search "lofi hip hop"
  yt-dl-js "https://youtube.com/playlist?list=PLxxxxxx" -x
  yt-dl-js "https://youtube.com/watch?v=dQw4w9WgXcQ" -i
`
  process.stdout.write(help.trim() + '\n')
}

function progressBar(info) {
  if (info.phase === 'converting') {
    if (info.status === 'started') process.stderr.write('\rConvirtiendo a MP3...')
    if (info.status === 'finished') process.stderr.write('\rConversion exitosa :D\n')
    return
  }

  const percent = info.percent != null ? info.percent : 0
  const speed = info.speed ? formatSpeed(info.speed) : '-- B/s'
  const downloaded = info.downloaded ? formatBytes(info.downloaded) : '0 B'
  const total = info.total ? formatBytes(info.total) : '?'
  const eta = info.eta != null ? `ETA ${info.eta}s` : ''

  const barWidth = 30
  const filled = Math.round((percent / 100) * barWidth)
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled)

  process.stderr.write(`\r[${bar}] ${percent}% ${downloaded}/${total} ${speed} ${eta}  `)

  if (info.status === 'finished' && info.phase === 'downloading') {
    process.stderr.write('\n')
  }
}

async function showInfo(url, ydl) {
  const info = await ydl.getInfo(url)
  process.stdout.write(`Title:    ${info.title}\n`)
  process.stdout.write(`Author:   ${info.author}\n`)
  process.stdout.write(`Duration: ${formatDuration(info.duration)}\n`)
  process.stdout.write(`ID:       ${info.id}\n`)
  process.stdout.write(`Client:   ${info.clientName}\n`)
  process.stdout.write(`Formats:  ${info.formats.length}\n`)
  process.stdout.write('\n')

  const audioFmts = info.formats.filter(f => f.isAudioOnly)
  const videoFmts = info.formats.filter(f => !f.isAudioOnly)

  if (audioFmts.length > 0) {
    process.stdout.write('Audio formats:\n')
    for (const f of audioFmts) {
      const size = f.filesize ? formatBytes(f.filesize) : '?'
      process.stdout.write(`  ${f.formatId.padEnd(4)} ${f.ext.padEnd(5)} ${String(f.audioBitrate || '?').padEnd(4)}kbps ${f.audioQuality.padEnd(22)} ${size}\n`)
    }
  }

  if (videoFmts.length > 0) {
    process.stdout.write('\nVideo formats:\n')
    for (const f of videoFmts) {
      const size = f.filesize ? formatBytes(f.filesize) : '?'
      const res = f.qualityLabel || `${f.width}x${f.height}` || f.quality
      process.stdout.write(`  ${f.formatId.padEnd(4)} ${f.ext.padEnd(5)} ${String(res).padEnd(10)} ${size}\n`)
    }
  }
}

async function showUrlOnly(url, ydl, opts) {
  const info = await ydl.getInfo(url)
  const extractor = new WebClientExtractor()
  const audioOnly = opts.audioOnly || opts.format === 'mp3'
  const format = extractor.selectFormat(info.formats, { audioOnly })

  process.stdout.write(`Title: ${info.title}\n`)
  if (format.needsMerge) {
    process.stdout.write(`Video URL: ${format.video.url}\n`)
    if (format.audio) process.stdout.write(`Audio URL: ${format.audio.url}\n`)
    process.stdout.write(`(Necesita merge de video + audio)\n`)
  } else {
    process.stdout.write(`URL: ${format.url}\n`)
    process.stdout.write(`Format: ${format.ext} ${format.qualityLabel || format.audioQuality || ''}\n`)
  }
}

async function handleSearch(query, opts, ydl) {
  if (!opts.audioOnly && !opts.urlOnly && !opts.output && !opts.format) {
    const results = await search(query, { limit: 10 })
    if (results.length === 0) {
      process.stdout.write(`No se encontraron resultados para: "${query}"\n`)
      return null
    }
    process.stdout.write(`\nResultados para: "${query}"\n\n`)
    for (let i = 0; i < results.length; i++) {
      const v = results[i]
      const dur = typeof v.duration === 'object' ? v.duration.timestamp : v.duration
      process.stdout.write(`  ${String(i + 1).padStart(2)}. ${v.title}\n`)
      process.stdout.write(`      ${v.author} | ${dur || '?'} | ${v.views ? v.views.toLocaleString() + ' vistas' : ''}\n`)
      process.stdout.write(`      ${v.url}\n\n`)
    }
    return null
  }

  process.stderr.write(`Buscando: "${query}"...\n`)
  const first = await searchFirst(query)
  if (!first) {
    process.stderr.write(`No se encontraron resultados para: "${query}"\n`)
    process.exitCode = 1
    return null
  }
  process.stderr.write(`Encontrado: ${first.title} (${first.url})\n`)
  return first.url
}

async function main() {
  const opts = parseArgs(process.argv)

  if (opts.help || (opts.urls.length === 0 && opts.queries.length === 0)) {
    showHelp()
    process.exit(opts.help ? 0 : 1)
  }

  const ydl = new YoutubeDL({
    output: opts.output || '.',
    verbose: opts.verbose || false,
    quality: opts.quality || 2,
    onProgress: progressBar
  })

  const resolvedUrls = [...opts.urls]
  for (const query of opts.queries) {
    try {
      const url = await handleSearch(query, opts, ydl)
      if (url) resolvedUrls.push(url)
    } catch (err) {
      process.stderr.write(`\nError buscando "${query}": ${err.message}\n`)
      if (opts.verbose) process.stderr.write(err.stack + '\n')
      process.exitCode = 1
    }
  }

  for (const url of resolvedUrls) {
    try {
      if (opts.urlOnly) {
        await showUrlOnly(url, ydl, opts)
        continue
      }

      if (opts.infoOnly) {
        await showInfo(url, ydl)
        continue
      }

      const startTime = Date.now()

      const result = await ydl.download(url, {
        audioOnly: opts.audioOnly || opts.format === 'mp3',
        output: opts.output || '.',
        quality: opts.quality
      })

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

      if (result.playlist) {
        process.stdout.write(`\nPlaylist: ${result.playlist.title}\n`)
        process.stdout.write(`Downloaded: ${result.success}/${result.total}\n`)
        if (result.failed > 0) process.stdout.write(`Failed: ${result.failed}\n`)
      } else {
        process.stdout.write(`\nSaved: ${result.filepath}\n`)
        process.stdout.write(`Time: ${elapsed}s\n`)
      }
    } catch (err) {
      process.stderr.write(`\nError: ${err.message}\n`)
      if (opts.verbose) process.stderr.write(err.stack + '\n')
      process.exitCode = 1
    }
  }
}

main()
