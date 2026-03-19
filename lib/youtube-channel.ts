import { google } from 'googleapis'
import { getOAuth2Client } from './youtube-oauth'
import { redis } from './redis'

const YOUTUBE_TOKENS_KEY = 'youtube:tokens'
const YOUTUBE_CHANNEL_INFO_KEY = 'youtube:channel_info'

async function getAuthenticatedClient() {
  const oauth2Client = getOAuth2Client()
  
  const tokensStr = await redis.get<string>(YOUTUBE_TOKENS_KEY)
  if (!tokensStr) {
    throw new Error('YouTube belum terkoneksi')
  }

  const tokens = typeof tokensStr === 'string' ? JSON.parse(tokensStr) : tokensStr
  oauth2Client.setCredentials(tokens)

  return oauth2Client
}

export interface YouTubeChannelInfo {
  id: string
  title: string
  customUrl?: string
  thumbnailUrl?: string
  subscriberCount?: string
}

export async function getConnectedChannelInfo(): Promise<YouTubeChannelInfo | null> {
  try {
    // Cek cache dulu
    const cached = await redis.get(YOUTUBE_CHANNEL_INFO_KEY)
    if (cached) {
      return typeof cached === 'string' ? JSON.parse(cached) as YouTubeChannelInfo : cached as YouTubeChannelInfo
    }

    // Fetch dari YouTube API
    const oauth2Client = await getAuthenticatedClient()
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })

    const response = await youtube.channels.list({
      part: ['snippet', 'statistics'],
      mine: true,
    })

    const channel = response.data.items?.[0]
    if (!channel) {
      return null
    }

    const channelInfo: YouTubeChannelInfo = {
      id: channel.id || '',
      title: channel.snippet?.title || 'Unknown',
      customUrl: channel.snippet?.customUrl || undefined,
      thumbnailUrl: channel.snippet?.thumbnails?.default?.url || undefined,
      subscriberCount: channel.statistics?.subscriberCount || undefined,
    }

    // Simpan ke cache
    await redis.set(YOUTUBE_CHANNEL_INFO_KEY, JSON.stringify(channelInfo))

    return channelInfo
  } catch (error) {
    console.error('Error fetching channel info:', error)
    return null
  }
}

export async function clearChannelCache(): Promise<void> {
  await redis.del(YOUTUBE_CHANNEL_INFO_KEY)
}
