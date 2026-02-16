import { INNERTUBE_CLIENTS, fetchBrowseData } from './common.js'
import { ExtractionError, retry } from '../utils.js'

export class PlaylistExtractor {
  async extract(playlistId) {
    const client = INNERTUBE_CLIENTS.web
    const browseId = playlistId.startsWith('VL') ? playlistId : `VL${playlistId}`

    const data = await retry(() => fetchBrowseData(browseId, client), 2, 500)
    const title = this._extractTitle(data)
    const entries = []

    const initialItems = this._findPlaylistItems(data)
    entries.push(...this._parseItems(initialItems))

    let continuation = this._extractContinuation(initialItems)
    while (continuation) {
      const contData = await retry(
        () => fetchBrowseData(browseId, client, { continuation }),
        2, 500
      )
      const contItems = this._findContinuationItems(contData)
      entries.push(...this._parseItems(contItems))
      continuation = this._extractContinuation(contItems)
    }

    return { id: playlistId, title, entries }
  }

  _extractTitle(data) {
    return data?.header?.playlistHeaderRenderer?.title?.simpleText
      || data?.metadata?.playlistMetadataRenderer?.title
      || 'Unknown Playlist'
  }

  _findPlaylistItems(data) {
    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || []
    for (const tab of tabs) {
      const content = tab?.tabRenderer?.content
      const section = content?.sectionListRenderer?.contents?.[0]
      const items = section?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents
      if (items) return items
    }
    return []
  }

  _findContinuationItems(data) {
    const actions = data?.onResponseReceivedActions || []
    for (const action of actions) {
      const items = action?.appendContinuationItemsAction?.continuationItems
      if (items) return items
    }
    return []
  }

  _parseItems(items) {
    const entries = []
    for (const item of items) {
      const renderer = item?.playlistVideoRenderer
      if (!renderer) continue

      const videoId = renderer.videoId
      if (!videoId) continue

      entries.push({
        videoId,
        title: renderer.title?.runs?.[0]?.text || renderer.title?.simpleText || videoId,
        duration: renderer.lengthSeconds ? parseInt(renderer.lengthSeconds, 10) : null,
        index: renderer.index?.simpleText ? parseInt(renderer.index.simpleText, 10) : null
      })
    }
    return entries
  }

  _extractContinuation(items) {
    if (!items || items.length === 0) return null
    for (const item of items) {
      const token = item?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token
      if (token) return token
    }
    return null
  }
}
