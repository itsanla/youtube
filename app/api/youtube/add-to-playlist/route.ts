import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getYouTubeOAuthClient } from '@/lib/youtube-accounts'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const accountId = typeof body.accountId === 'string' ? body.accountId : ''
    const videoId = typeof body.videoId === 'string' ? body.videoId : ''
    const playlistId = typeof body.playlistId === 'string' ? body.playlistId : ''

    if (!accountId || !videoId || !playlistId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const oauth2Client = await getYouTubeOAuthClient(accountId)
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })

    await youtube.playlistItems.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId,
          },
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add playlist' },
      { status: 500 }
    )
  }
}
