<h1 align="center">
  <span style="color:#FF0000;">yt</span>-<span style="color:#00BFFF;">dl</span>-<span style="color:#FFD700;">js</span>
</h1>

<p align="center">
  <strong>Descargador de YouTube moderno, escrito en JavaScript puro (ESM)</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-FF0000?style=for-the-badge&logo=github&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Modulo-ESM-FFD700?style=for-the-badge&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/FFmpeg-Requerido-FF6600?style=for-the-badge&logo=ffmpeg&logoColor=white" />
  <img src="https://img.shields.io/badge/Licencia-MIT-9370DB?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Estado-Activo-00C2FF?style=for-the-badge" />
</p>

---

`yt-dl-js` es un descargador de YouTube completo escrito en JavaScript usando modulos ESM nativos de Node.js. Solo depende de [`yts`](https://github.com/Ado21/yts) para busqueda por titulo — el resto esta construido enteramente sobre modulos nativos de Node.js (`node:https`, `node:fs`, `node:path`, `node:stream`, `node:child_process`).

Soporta descarga de:
- **Videos** (MP4, WebM)
- **Audio** (MP3, M4A, Opus, FLAC, WAV, OGG)
- **Playlists** completas
- **Shorts**, **Lives** y **URLs embebidas**
- **Busqueda por titulo** — descarga directamente buscando el nombre del video

Ofrece tanto una **interfaz CLI** como una **API programatica** para integrarlo en tus proyectos.

> [!IMPORTANT]
> Este proyecto es solo con fines educativos. El scraping de YouTube puede violar sus Terminos de Servicio. Usalo bajo tu propia responsabilidad. No nos hacemos responsables del uso que se le de a esta herramienta. Respeta los derechos de autor y las leyes de tu pais.

---

## Tabla de Contenidos

1. [Requisitos](#requisitos)
2. [Instalacion](#instalacion)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Uso CLI](#uso-cli)
5. [Ejemplos de Uso (API)](#ejemplos-de-uso-api)
6. [Referencia de API](#referencia-de-api)
7. [URLs Soportadas](#urls-soportadas)
8. [Formatos Soportados](#formatos-soportados)
9. [Tipos de Error](#tipos-de-error)
10. [Notas](#notas)
11. [Autor](#autor)
12. [Licencia](#licencia)

---

<h2 align="center"><span style="color:#FF6347;">Requisitos</span></h2>

- **Node.js** `>= 18.0.0`
- **FFmpeg** (necesario para conversion de audio y merge de video+audio)

### Instalar FFmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg

# Windows (con Chocolatey)
choco install ffmpeg
```

---

<h2 align="center"><span style="color:#00BFFF;">Instalacion</span></h2>

### Desde GitHub

```bash
npm install github:Ado21/yt-dl-js
```

Tambien puedes declararlo directo en tu `package.json`:

```json
{
  "type": "module",
  "dependencies": {
    "yt-dl-js": "github:Ado21/yt-dl-js"
  }
}
```

> [!NOTE]
> Este paquete es **ESM-only**. Tu proyecto debe tener `"type": "module"` en su `package.json` o usar la extension `.mjs` en tus archivos.

---

<h2 align="center"><span style="color:#FFD700;">Estructura del Proyecto</span></h2>

```
yt-dl-js/
├── cli.js                      # Punto de entrada CLI
├── index.js                    # Exportaciones principales del modulo
├── package.json                # Configuracion del paquete
└── src/
    ├── YoutubeDL.js            # Clase principal orquestadora
    ├── utils.js                # Utilidades, parsers, errores
    ├── search.js               # Busqueda de videos (yt-search)
    ├── extractor/
    │   ├── common.js           # Clientes InnerTube y API
    │   ├── youtube.js          # Extractor de videos YouTube
    │   └── playlist.js         # Extractor de playlists
    ├── downloader/
    │   ├── common.js           # Clase base de descarga
    │   └── http.js             # Descargador HTTP con progreso
    └── postprocessor/
        ├── common.js           # Clase base de post-procesado
        └── ffmpeg.js           # Conversion FFmpeg (MP3, merge)
```

---

<h2 align="center"><span style="color:#FF4500;">Uso CLI</span></h2>

```bash
npx yt-dl-js <URL> [opciones]          # Descargar por URL
npx yt-dl-js <titulo> [opciones]       # Buscar y descargar por titulo
npx yt-dl-js --search "query"          # Buscar videos en YouTube
```

### Opciones disponibles

| Bandera | Alias | Descripcion | Valor por defecto |
|---------|-------|-------------|-------------------|
| `--audio-only` | `-x` | Descargar solo audio y convertir a MP3 | `false` |
| `--audio` | — | Alias de `--audio-only` | `false` |
| `--info` | `-i` | Mostrar info del video sin descargar | `false` |
| `--url-only` | `-u` | Mostrar solo la URL directa de descarga | `false` |
| `--search <q>` | `-s` | Buscar videos en YouTube por titulo | — |
| `--output <dir>` | `-o` | Directorio de salida | `.` (directorio actual) |
| `--format <fmt>` | `-f` | Formato preferido (`best`, `mp3`, `mp4`) | `best` |
| `--quality <n>` | `-q` | Calidad de audio 0-9 (0 = mejor) | `2` |
| `--verbose` | `-v` | Mostrar salida detallada | `false` |
| `--help` | `-h` | Mostrar ayuda | — |

> [!NOTE]
> Si el argumento no parece una URL de YouTube, se trata automaticamente como una busqueda por titulo. Puedes usar `--search` para ser explicito.

### Ejemplos CLI

```bash
# Descargar video en mejor calidad
npx yt-dl-js "https://youtube.com/watch?v=dQw4w9WgXcQ"

# Descargar solo audio (MP3)
npx yt-dl-js "https://youtube.com/watch?v=dQw4w9WgXcQ" -x
npx yt-dl-js "https://youtube.com/watch?v=dQw4w9WgXcQ" --audio

# Descargar playlist completa como audio
npx yt-dl-js "https://youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI" -x

# Ver informacion del video sin descargar
npx yt-dl-js "https://youtube.com/watch?v=dQw4w9WgXcQ" -i

# Obtener solo la URL directa de descarga (sin descargar)
npx yt-dl-js "https://youtube.com/watch?v=dQw4w9WgXcQ" -u

# Obtener URL directa de audio
npx yt-dl-js "https://youtube.com/watch?v=dQw4w9WgXcQ" -u --audio

# Buscar videos por titulo
npx yt-dl-js --search "lofi hip hop"

# Buscar y descargar audio directamente por titulo (auto-deteccion)
npx yt-dl-js "Never Gonna Give You Up" -x

# Buscar y obtener URL directa
npx yt-dl-js "Never Gonna Give You Up" -u

# Descargar con calidad maxima en directorio personalizado
npx yt-dl-js "https://youtube.com/watch?v=dQw4w9WgXcQ" -x -q 0 -o ./musica

# Modo verbose para depuracion
npx yt-dl-js "https://youtube.com/watch?v=dQw4w9WgXcQ" -v
```

---

<h2 align="center"><span style="color:#32CD32;">Ejemplos de Uso (Módulo)</span></h2>

### 1) Descarga basica de video

```js
import { download } from 'yt-dl-js'

const resultado = await download('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
console.log('Guardado en:', resultado.filepath)
console.log('Titulo:', resultado.info.title)
console.log('Formato:', resultado.info.format)
```

### 2) Descargar solo audio (MP3)

```js
import { downloadAudio } from 'yt-dl-js'

const resultado = await downloadAudio('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
console.log('MP3 guardado en:', resultado.filepath)
console.log('Duracion:', resultado.info.duration, 'segundos')
```

### 3) Obtener informacion del video

```js
import { extractInfo } from 'yt-dl-js'

const info = await extractInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
console.log('Titulo:', info.title)
console.log('Autor:', info.author)
console.log('Duracion:', info.duration, 'segundos')
console.log('Vistas:', info.viewCount)
console.log('Formatos disponibles:', info.formats.length)
```

### 4) Descargar playlist completa

```js
import { YoutubeDL } from 'yt-dl-js'

const ydl = new YoutubeDL({ verbose: true })
const resultado = await ydl.downloadPlaylist(
  'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI'
)

console.log('Playlist:', resultado.playlist.title)
console.log('Descargados:', resultado.success, '/', resultado.total)
console.log('Fallidos:', resultado.failed)
```

### 5) Directorio de salida personalizado

```js
import { download } from 'yt-dl-js'

const resultado = await download('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
  output: './mis-videos'
})
console.log('Guardado en:', resultado.filepath)
```

### 6) Configurar calidad de audio

```js
import { downloadAudio } from 'yt-dl-js'

// Calidad 0 = mejor calidad (~245 kbps, archivo mas grande)
// Calidad 2 = calidad por defecto (~190 kbps)
// Calidad 9 = menor calidad (~65 kbps, archivo mas pequeno)

const resultado = await downloadAudio('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
  quality: 0
})
console.log('Audio en maxima calidad:', resultado.filepath)
```

### 7) Modo verbose

```js
import { download } from 'yt-dl-js'

const resultado = await download('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
  verbose: true
})
// Muestra informacion detallada: cliente usado, formato seleccionado, progreso, etc.
```

### 8) Listar formatos disponibles

```js
import { extractInfo } from 'yt-dl-js'

const info = await extractInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

// Formatos de audio
const audioFormats = info.formats.filter(f => f.isAudioOnly)
console.log('--- Audio ---')
for (const fmt of audioFormats) {
  console.log(`  ${fmt.formatId} | ${fmt.ext} | ${fmt.audioBitrate}kbps | ${fmt.audioQuality}`)
}

// Formatos de video
const videoFormats = info.formats.filter(f => !f.isAudioOnly)
console.log('--- Video ---')
for (const fmt of videoFormats) {
  console.log(`  ${fmt.formatId} | ${fmt.ext} | ${fmt.qualityLabel} | ${fmt.width}x${fmt.height}`)
}
```

### 9) Obtener URL directa de descarga (sin descargar)

```js
import { getUrl } from 'yt-dl-js'

// Obtener URL directa de video
const resultado = await getUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
if (resultado.needsMerge) {
  console.log('Video URL:', resultado.videoUrl)
  console.log('Audio URL:', resultado.audioUrl)
  console.log('(Necesita merge con FFmpeg)')
} else {
  console.log('URL directa:', resultado.url)
  console.log('Formato:', resultado.format.ext, resultado.format.qualityLabel || '')
}

// Obtener URL directa de audio
const audio = await getUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { audioOnly: true })
console.log('Audio URL:', audio.url)
console.log('Formato:', audio.format.ext, audio.format.audioBitrate + 'kbps')
```

### 10) Obtener URLs de formatos manualmente

```js
import { extractInfo } from 'yt-dl-js'

const info = await extractInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

// Cada formato tiene una propiedad `url` con la URL directa de descarga
for (const fmt of info.formats) {
  if (fmt.isAudioOnly) {
    console.log(`Audio ${fmt.ext} ${fmt.audioBitrate}kbps: ${fmt.url}`)
  } else {
    console.log(`Video ${fmt.ext} ${fmt.qualityLabel}: ${fmt.url}`)
  }
}

// Obtener la URL del mejor audio
const mejorAudio = info.formats
  .filter(f => f.isAudioOnly)
  .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]
console.log('Mejor audio URL:', mejorAudio.url)
```

### 11) Buscar videos por titulo

```js
import { search, searchFirst } from 'yt-dl-js'

// Buscar videos
const resultados = await search('lofi hip hop radio')
for (const video of resultados) {
  console.log(`${video.title} - ${video.author}`)
  console.log(`  ${video.url}`)
  console.log(`  ${video.views} vistas | ${video.duration}`)
}

// Obtener solo el primer resultado (el mas relevante)
const primero = await searchFirst('Never Gonna Give You Up')
console.log('Primer resultado:', primero.title, primero.url)
```

### 12) Buscar y descargar por titulo

```js
import { searchAndDownload, searchFirst, downloadAudio } from 'yt-dl-js'

// Manera rapida: buscar y descargar en un solo paso
const resultado = await searchAndDownload('Never Gonna Give You Up')
console.log('Guardado:', resultado.filepath)

// Manera manual: buscar primero, luego descargar
const video = await searchFirst('lofi hip hop chill beats')
if (video) {
  const descarga = await downloadAudio(video.url)
  console.log('Audio guardado:', descarga.filepath)
}
```

### 13) Descargar video con todas las opciones

```js
import { download } from 'yt-dl-js'

const resultado = await download('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
  output: './descargas',
  verbose: true
})

console.log('ID:', resultado.info.id)
console.log('Titulo:', resultado.info.title)
console.log('Autor:', resultado.info.author)
console.log('Duracion:', resultado.info.duration)
console.log('Formato:', resultado.info.format)
console.log('Archivo:', resultado.filepath)
```

### 14) Descargar audio con todas las opciones

```js
import { downloadAudio } from 'yt-dl-js'

const resultado = await downloadAudio('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
  output: './musica',
  quality: 0,
  verbose: true
})

console.log('Titulo:', resultado.info.title)
console.log('Duracion:', resultado.info.duration, 'segundos')
console.log('Archivo:', resultado.filepath)
```

### 15) Usar la clase YoutubeDL directamente

```js
import { YoutubeDL } from 'yt-dl-js'

const ydl = new YoutubeDL({
  output: './descargas',
  verbose: true,
  quality: 2
})

// Obtener informacion sin descargar
const info = await ydl.getInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
console.log('Titulo:', info.title)
console.log('Formatos:', info.formats.length)

// Descargar video
const video = await ydl.download('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
console.log('Video guardado:', video.filepath)

// Descargar solo audio
const audio = await ydl.download('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
  audioOnly: true
})
console.log('Audio guardado:', audio.filepath)
```

### 16) Callback de progreso

```js
import { YoutubeDL } from 'yt-dl-js'

const ydl = new YoutubeDL({
  onProgress: (info) => {
    if (info.phase === 'downloading') {
      const pct = info.percent ?? 0
      const speed = info.speed
        ? (info.speed / 1024 / 1024).toFixed(1) + ' MB/s'
        : '-- MB/s'
      const eta = info.eta != null ? `ETA ${info.eta}s` : ''
      console.log(`Descargando: ${pct}% | ${speed} ${eta}`)
    }

    if (info.phase === 'converting') {
      if (info.status === 'started') console.log('Convirtiendo a MP3...')
      if (info.status === 'finished') console.log('Conversion completada!')
    }
  }
})

await ydl.download('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
  audioOnly: true
})
```

### 17) Manejo de errores

```js
import {
  download,
  YtDlpError,
  ExtractionError,
  DownloadError,
  PostProcessError,
  FormatError
} from 'yt-dl-js'

try {
  await download('https://www.youtube.com/watch?v=VIDEO_INVALIDO')
} catch (error) {
  if (error instanceof ExtractionError) {
    console.error('Error de extraccion:', error.message)
    // URL invalida, video privado, video eliminado, etc.
  } else if (error instanceof DownloadError) {
    console.error('Error de descarga:', error.message)
    // Timeout, error de red, HTTP 403/404, etc.
  } else if (error instanceof PostProcessError) {
    console.error('Error de post-procesado:', error.message)
    // FFmpeg no instalado, error de conversion, etc.
  } else if (error instanceof FormatError) {
    console.error('Error de formato:', error.message)
    // No se encontro un formato adecuado
  } else if (error instanceof YtDlpError) {
    console.error('Error general de yt-dlp:', error.message)
  } else {
    console.error('Error inesperado:', error)
  }
}
```

> [!TIP]
> Todos los errores del paquete heredan de `YtDlpError`. Puedes usar `error instanceof YtDlpError` para capturar cualquier error del paquete de forma generica.

### 18) Usar extractores directamente

```js
import { WebClientExtractor } from 'yt-dl-js'

const extractor = new WebClientExtractor()
const info = await extractor.extract('dQw4w9WgXcQ')

console.log('Titulo:', info.title)
console.log('Cliente usado:', info.clientName)
console.log('Total formatos:', info.formats.length)

// Seleccionar formato manualmente
const mejorAudio = extractor.selectFormat(info.formats, { audioOnly: true })
console.log('Mejor audio:', mejorAudio.formatId, mejorAudio.ext)

const mejorVideo = extractor.selectFormat(info.formats, { audioOnly: false })
if (mejorVideo.needsMerge) {
  console.log('Video:', mejorVideo.video.qualityLabel, '(necesita merge con audio)')
} else {
  console.log('Video:', mejorVideo.qualityLabel, mejorVideo.ext)
}
```

### 19) Utilidades de parsing

```js
import {
  parseVideoId,
  parsePlaylistId,
  isPlaylistUrl,
  formatBytes,
  formatDuration,
  sanitizeFilename
} from 'yt-dl-js'

// Parsear video ID desde diferentes formatos de URL
console.log(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))  // 'dQw4w9WgXcQ'
console.log(parseVideoId('https://youtu.be/dQw4w9WgXcQ'))                 // 'dQw4w9WgXcQ'
console.log(parseVideoId('https://youtube.com/shorts/dQw4w9WgXcQ'))       // 'dQw4w9WgXcQ'
console.log(parseVideoId('https://youtube.com/embed/dQw4w9WgXcQ'))        // 'dQw4w9WgXcQ'
console.log(parseVideoId('https://youtube.com/live/dQw4w9WgXcQ'))         // 'dQw4w9WgXcQ'
console.log(parseVideoId('dQw4w9WgXcQ'))                                  // 'dQw4w9WgXcQ'

// Parsear playlist ID
console.log(parsePlaylistId('https://youtube.com/playlist?list=PLxxxxxxxx'))  // 'PLxxxxxxxx'

// Verificar si es URL de playlist
console.log(isPlaylistUrl('https://youtube.com/playlist?list=PLxxxxxxxx'))    // true
console.log(isPlaylistUrl('https://youtube.com/watch?v=dQw4w9WgXcQ'))        // false

// Utilidades de formato
console.log(formatBytes(0))          // '0 B'
console.log(formatBytes(1536000))    // '1.5 MB'
console.log(formatBytes(1073741824)) // '1.0 GB'

console.log(formatDuration(65))      // '1:05'
console.log(formatDuration(3661))    // '1:01:01'

console.log(sanitizeFilename('Mi Video: "Titulo" <cool>'))  // 'Mi Video Titulo cool'
```

### 20) Descarga de YouTube Shorts

```js
import { download, downloadAudio } from 'yt-dl-js'

// Los Shorts se descargan exactamente igual que cualquier video
const video = await download('https://www.youtube.com/shorts/dQw4w9WgXcQ', {
  output: './shorts'
})
console.log('Short guardado:', video.filepath)

// Tambien como audio
const audio = await downloadAudio('https://www.youtube.com/shorts/dQw4w9WgXcQ', {
  output: './shorts-audio'
})
console.log('Audio del short:', audio.filepath)
```

---

<h2 align="center"><span style="color:#9370DB;">Referencia de API</span></h2>

### Funciones de conveniencia

| Funcion | Parametros | Retorno | Descripcion |
|---------|-----------|---------|-------------|
| `extractInfo(url, opts?)` | `url: string`, `opts: object` | `Promise<VideoInfo>` | Obtener info del video sin descargar |
| `download(url, opts?)` | `url: string`, `opts: object` | `Promise<Result>` | Descargar video |
| `downloadAudio(url, opts?)` | `url: string`, `opts: object` | `Promise<Result>` | Descargar solo audio como MP3 |
| `getUrl(url, opts?)` | `url: string`, `opts: object` | `Promise<UrlResult>` | Obtener URL directa sin descargar |
| `search(query, opts?)` | `query: string`, `opts: object` | `Promise<Array>` | Buscar videos por titulo |
| `searchFirst(query)` | `query: string` | `Promise<object\|null>` | Obtener el primer resultado de busqueda |
| `searchAndDownload(query, opts?)` | `query: string`, `opts: object` | `Promise<Result>` | Buscar y descargar en un paso |

### Constructor `new YoutubeDL(options)`

| Opcion | Tipo | Default | Descripcion |
|--------|------|---------|-------------|
| `output` | `string` | `'.'` | Directorio de salida |
| `verbose` | `boolean` | `false` | Salida detallada en stderr |
| `quality` | `number` | `2` | Calidad audio MP3 (0-9, 0 = mejor) |
| `onProgress` | `function` | `null` | Callback de progreso |

### Metodos de `YoutubeDL`

| Metodo | Parametros | Retorno | Descripcion |
|--------|-----------|---------|-------------|
| `getInfo(url)` | `url: string` | `Promise<VideoInfo>` | Obtener info del video |
| `download(url, opts?)` | `url: string`, `opts: object` | `Promise<Result>` | Descargar video o audio |
| `downloadPlaylist(url, opts?)` | `url: string`, `opts: object` | `Promise<PlaylistResult>` | Descargar playlist completa |

### Opciones de descarga

| Opcion | Tipo | Descripcion |
|--------|------|-------------|
| `audioOnly` | `boolean` | Descargar solo audio y convertir a MP3 |
| `output` | `string` | Directorio de salida |
| `quality` | `number` | Calidad de audio 0-9 |

### Objetos de retorno

**`Result`** (video o audio individual):
```js
{
  filepath: '/ruta/al/archivo.mp4',
  info: {
    id: 'dQw4w9WgXcQ',
    title: 'Titulo del video',
    duration: 212,
    author: 'Nombre del canal',
    format: 'mp4'
  }
}
```

**`PlaylistResult`**:
```js
{
  playlist: { id: 'PLxxxxxxxx', title: 'Nombre de la playlist' },
  results: [ /* array de Result */ ],
  errors: [ /* array de { videoId, title, error } */ ],
  total: 25,
  success: 23,
  failed: 2
}
```

**`VideoInfo`** (de `getInfo` / `extractInfo`):
```js
{
  id: 'dQw4w9WgXcQ',
  title: 'Titulo del video',
  description: 'Descripcion completa...',
  duration: 212,
  viewCount: 1500000000,
  author: 'Nombre del canal',
  channelId: 'UCxxxxxxxx',
  isLive: false,
  thumbnails: [ /* array de URLs */ ],
  formats: [ /* array de formatos disponibles */ ],
  clientName: 'web'
}
```

**`UrlResult`** (de `getUrl`):
```js
// Cuando no necesita merge (formato combinado):
{
  url: 'https://...url-directa-de-descarga',
  needsMerge: false,
  info: { /* VideoInfo */ },
  format: { /* formato seleccionado */ }
}

// Cuando necesita merge (video + audio separados):
{
  videoUrl: 'https://...url-del-video',
  audioUrl: 'https://...url-del-audio',
  needsMerge: true,
  info: { /* VideoInfo */ },
  format: { /* formato seleccionado */ }
}
```

**`SearchResult`** (de `search` / `searchFirst`):
```js
{
  videoId: 'dQw4w9WgXcQ',
  title: 'Never Gonna Give You Up',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  duration: { seconds: 212, timestamp: '3:32' },
  views: 1500000000,
  author: 'Rick Astley',
  image: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
  ago: '14 years ago',
  description: 'Descripcion del video...'
}
```

---

<h2 align="center"><span style="color:#FF1493;">URLs Soportadas</span></h2>

| Tipo | Patron | Ejemplo |
|------|--------|---------|
| Estandar | `youtube.com/watch?v={ID}` | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` |
| Corta | `youtu.be/{ID}` | `https://youtu.be/dQw4w9WgXcQ` |
| Embebida | `youtube.com/embed/{ID}` | `https://www.youtube.com/embed/dQw4w9WgXcQ` |
| Shorts | `youtube.com/shorts/{ID}` | `https://www.youtube.com/shorts/dQw4w9WgXcQ` |
| En vivo | `youtube.com/live/{ID}` | `https://www.youtube.com/live/dQw4w9WgXcQ` |
| Playlist | `youtube.com/playlist?list={ID}` | `https://www.youtube.com/playlist?list=PLxxxxxxxx` |

---

<h2 align="center"><span style="color:#20B2AA;">Formatos Soportados</span></h2>

### Codecs de audio

| Codec | Descripcion |
|-------|-------------|
| `mp4a` | AAC (Advanced Audio Coding) |
| `opus` | Opus |
| `vorbis` | Vorbis |
| `ac-3` | Dolby Digital |
| `flac` | FLAC (sin perdida) |

### Codecs de video

| Codec | Descripcion |
|-------|-------------|
| `avc1` | H.264 / AVC |
| `vp9` | VP9 |
| `vp8` | VP8 |
| `av01` | AV1 |
| `hev1` | H.265 / HEVC |

### Contenedores

| Formato | Extension | Tipo |
|---------|-----------|------|
| MP4 | `.mp4` | Video |
| WebM | `.webm` | Video / Audio |
| 3GP | `.3gp` | Video |
| MP3 | `.mp3` | Audio |
| M4A | `.m4a` | Audio |
| OGG | `.ogg` | Audio |
| WAV | `.wav` | Audio |
| FLAC | `.flac` | Audio |

---

<h2 align="center"><span style="color:#FF8C00;">Tipos de Error</span></h2>

| Clase | Hereda de | Cuando se lanza |
|-------|-----------|-----------------|
| `YtDlpError` | `Error` | Error base del paquete |
| `ExtractionError` | `YtDlpError` | No se puede extraer info del video (URL invalida, video privado, eliminado) |
| `DownloadError` | `YtDlpError` | Fallo en la descarga HTTP (timeout, error de red, HTTP 403/404) |
| `PostProcessError` | `YtDlpError` | Fallo en FFmpeg (no instalado, error de conversion) |
| `FormatError` | `YtDlpError` | No se encontro un formato adecuado para la descarga |

> [!TIP]
> Todos los errores heredan de `YtDlpError`. Usa `error instanceof YtDlpError` para capturar cualquier error del paquete de forma generica, o usa las clases especificas para un manejo mas granular.

---

<h2 align="center"><span style="color:#778899;">Notas</span></h2>

- **FFmpeg** solo es necesario para conversion de audio (MP3) y para merge de streams de video + audio separados.
- El extractor usa multiples clientes de la API InnerTube de YouTube (`android_vr`, `ios`, `android`, `tv`, `web`) con fallback automatico.
- La calidad de audio (`-q`) usa LAME VBR: `0` es la mas alta (~245 kbps), `9` es la mas baja (~65 kbps), default `2` (~190 kbps).
- Las descargas de playlists crean un subdirectorio con el nombre de la playlist.
- El descargador soporta resume: si existe un archivo `.part`, intentara continuar la descarga.
- Si aparece `EAI_AGAIN` o `ENOTFOUND`, es un problema de red/DNS al resolver `www.youtube.com`.
- Algunas respuestas de YouTube pueden variar por pais e idioma segun los clientes InnerTube utilizados.
- **Busqueda por titulo**: usa la dependencia `yt-search` que hace scraping de YouTube. La disponibilidad depende de la conectividad y posibles bloqueos regionales.
- **URLs directas de descarga**: las URLs de los formatos son temporales (~6 horas). Si necesitas la URL para usarla despues, extraela justo antes de usarla.

---

<h2 align="center"><span style="color:#00BFFF;">Autor</span></h2>

<p align="center">
  <a href="https://github.com/Ado21">
    <img src="https://github.com/Ado21.png" width="120" height="120" alt="Ado21" style="border-radius: 50%;" />
  </a>
</p>

<p align="center">
  <strong>Ado21</strong><br>
  <a href="https://github.com/Ado21/yt-dl-js">github.com/Ado21/yt-dl-js</a>
</p>

---

<h2 align="center"><span style="color:#9370DB;">Licencia</span></h2>

<p align="center">
  Este proyecto esta licenciado bajo la <strong>MIT License</strong>.<br>
  Consulta el archivo <a href="LICENSE">LICENSE</a> para mas detalles.
</p>
