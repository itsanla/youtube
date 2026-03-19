import { google } from 'googleapis'
import { getOAuth2Client } from './youtube-oauth'
import { redis } from './redis'

const YOUTUBE_TOKENS_KEY = 'youtube:tokens'

async function getAuthenticatedClient() {
  const oauth2Client = getOAuth2Client()
  
  const tokensData = await redis.get(YOUTUBE_TOKENS_KEY)
  if (!tokensData) {
    throw new Error('YouTube belum terkoneksi. Silakan hubungkan akun YouTube terlebih dahulu.')
  }

  const tokens = typeof tokensData === 'string' ? JSON.parse(tokensData) : tokensData
  oauth2Client.setCredentials(tokens)

  return oauth2Client
}

export async function checkYouTubeConnection(): Promise<boolean> {
  try {
    const tokensStr = await redis.get<string>(YOUTUBE_TOKENS_KEY)
    return !!tokensStr
  } catch {
    return false
  }
}

export interface UploadVideoParams {
  title: string
  description: string
  filePath: string
  thumbnailPath?: string
  privacyStatus?: 'private' | 'public' | 'unlisted'
  categoryId?: string
}

export async function uploadVideo(params: UploadVideoParams) {
  const oauth2Client = await getAuthenticatedClient()
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client })

  const { title, description, filePath, thumbnailPath, privacyStatus = 'private', categoryId = '22' } = params

  const fs = await import('fs')
  
  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        categoryId,
      },
      status: {
        privacyStatus,
      },
    },
    media: {
      body: fs.createReadStream(filePath),
    },
  })

  const videoId = response.data.id

  // Upload thumbnail jika ada
  if (thumbnailPath && videoId) {
    await youtube.thumbnails.set({
      videoId,
      media: {
        body: fs.createReadStream(thumbnailPath),
      },
    })
  }

  return response.data
}
