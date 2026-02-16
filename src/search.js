import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ytSearch = require('yt-search')

export async function search(query, options = {}) {
  const result = await ytSearch(query)
  const videos = result.videos || []
  const limit = options.limit || 20
  return videos.slice(0, limit).map(v => ({
    videoId: v.videoId,
    title: v.title,
    url: v.url,
    duration: v.duration,
    views: v.views,
    author: v.author?.name || v.author || '',
    image: v.image || v.thumbnail,
    ago: v.ago,
    description: v.description || ''
  }))
}

export async function searchFirst(query) {
  const results = await search(query, { limit: 1 })
  return results.length > 0 ? results[0] : null
}
