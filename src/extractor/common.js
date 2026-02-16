import { httpPost, httpRequest, ExtractionError } from '../utils.js'

export const INNERTUBE_CLIENTS = {
  android_vr: {
    INNERTUBE_HOST: 'www.youtube.com',
    INNERTUBE_CONTEXT: {
      client: {
        clientName: 'ANDROID_VR',
        clientVersion: '1.71.26',
        deviceMake: 'Oculus',
        deviceModel: 'Quest 3',
        androidSdkVersion: 32,
        userAgent: 'com.google.android.apps.youtube.vr.oculus/1.71.26 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
        osName: 'Android',
        osVersion: '12L',
        hl: 'en'
      }
    },
    INNERTUBE_CONTEXT_CLIENT_NAME: 28,
    REQUIRE_JS_PLAYER: false
  },
  web: {
    INNERTUBE_HOST: 'www.youtube.com',
    INNERTUBE_CONTEXT: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20260114.08.00',
        hl: 'en'
      }
    },
    INNERTUBE_CONTEXT_CLIENT_NAME: 1,
    REQUIRE_JS_PLAYER: true
  },
  ios: {
    INNERTUBE_HOST: 'www.youtube.com',
    INNERTUBE_CONTEXT: {
      client: {
        clientName: 'IOS',
        clientVersion: '21.02.3',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        userAgent: 'com.google.ios.youtube/21.02.3 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
        osName: 'iPhone',
        osVersion: '18.3.2.22D82',
        hl: 'en'
      }
    },
    INNERTUBE_CONTEXT_CLIENT_NAME: 5,
    REQUIRE_JS_PLAYER: false
  },
  android: {
    INNERTUBE_HOST: 'www.youtube.com',
    INNERTUBE_CONTEXT: {
      client: {
        clientName: 'ANDROID',
        clientVersion: '21.02.35',
        androidSdkVersion: 30,
        userAgent: 'com.google.android.youtube/21.02.35 (Linux; U; Android 11) gzip',
        osName: 'Android',
        osVersion: '11',
        hl: 'en'
      }
    },
    INNERTUBE_CONTEXT_CLIENT_NAME: 3,
    REQUIRE_JS_PLAYER: false
  },
  tv: {
    INNERTUBE_HOST: 'www.youtube.com',
    INNERTUBE_CONTEXT: {
      client: {
        clientName: 'TVHTML5',
        clientVersion: '7.20260114.12.00',
        userAgent: 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/25.lts.30.1034943-gold (unlike Gecko)',
        hl: 'en'
      }
    },
    INNERTUBE_CONTEXT_CLIENT_NAME: 7,
    REQUIRE_JS_PLAYER: true
  }
}

export const CLIENT_PRIORITY = ['android_vr', 'ios', 'android', 'tv', 'web']

export function buildApiHeaders(client) {
  const ctx = client.INNERTUBE_CONTEXT.client
  return {
    'Content-Type': 'application/json',
    'X-YouTube-Client-Name': String(client.INNERTUBE_CONTEXT_CLIENT_NAME),
    'X-YouTube-Client-Version': ctx.clientVersion,
    'Origin': `https://${client.INNERTUBE_HOST}`,
    'User-Agent': ctx.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  }
}

export function buildPlayerRequest(videoId, client, options = {}) {
  const body = {
    context: client.INNERTUBE_CONTEXT,
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
    playbackContext: {
      contentPlaybackContext: {
        html5Preference: 'HTML5_PREF_WANTS'
      }
    }
  }
  if (options.sts) {
    body.playbackContext.contentPlaybackContext.signatureTimestamp = options.sts
  }
  if (options.params) {
    body.params = options.params
  }
  return body
}

export function buildBrowseRequest(browseId, client, options = {}) {
  const body = {
    context: client.INNERTUBE_CONTEXT,
    browseId
  }
  if (options.params) body.params = options.params
  if (options.continuation) body.continuation = options.continuation
  return body
}

export async function callApi(endpoint, body, client) {
  const host = client.INNERTUBE_HOST || 'www.youtube.com'
  const url = `https://${host}/youtubei/v1/${endpoint}?prettyPrint=false`
  const headers = buildApiHeaders(client)
  const res = await httpPost(url, body, headers)
  if (res.statusCode >= 400) {
    throw new ExtractionError(`API ${endpoint} returned ${res.statusCode}`)
  }
  try {
    return JSON.parse(res.body)
  } catch {
    throw new ExtractionError(`Failed to parse API response for ${endpoint}`)
  }
}

export async function fetchPlayerResponse(videoId, client, options = {}) {
  const body = buildPlayerRequest(videoId, client, options)
  const data = await callApi('player', body, client)
  const status = data?.playabilityStatus?.status
  if (status === 'ERROR' || status === 'LOGIN_REQUIRED') {
    const reason = data.playabilityStatus.reason || data.playabilityStatus.messages?.[0] || status
    throw new ExtractionError(`Video ${videoId}: ${reason}`)
  }
  return data
}

export async function fetchBrowseData(browseId, client, options = {}) {
  const body = buildBrowseRequest(browseId, client, options)
  return callApi('browse', body, client)
}

export async function fetchWebPage(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}&hl=en`
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
  }
  const res = await httpRequest(url, { headers })
  return res.body
}

export function extractPlayerUrl(html) {
  const m = html.match(/\/s\/player\/([a-zA-Z0-9_-]{8,})\/[^\s"]*?(?:player_ias\.vflset\/[^\s"]*?)?base\.js/)
  return m ? `https://www.youtube.com${m[0]}` : null
}

export function extractSts(playerJs) {
  const m = playerJs.match(/(?:signatureTimestamp|sts)\s*:\s*(\d{5})/)
  return m ? parseInt(m[1], 10) : null
}
