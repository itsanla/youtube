import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getYouTubeOAuthClient } from '@/lib/youtube-accounts'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const accountId = typeof body.accountId === 'string' ? body.accountId : ''
    const videoId = typeof body.videoId === 'string' ? body.videoId : ''
    const titleId = typeof body.titleId === 'string' ? body.titleId : ''
    const descriptionId = typeof body.descriptionId === 'string' ? body.descriptionId : ''
    const titleEn = typeof body.titleEn === 'string' ? body.titleEn : ''
    const descriptionEn = typeof body.descriptionEn === 'string' ? body.descriptionEn : ''

    if (!accountId || !videoId || !titleId || !titleEn) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const oauth2Client = await getYouTubeOAuthClient(accountId)
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })

    await youtube.videos.update({
      part: ['localizations'],
      requestBody: {
        id: videoId,
        localizations: {
          id: {
            title: titleId,
            description: descriptionId,
          },
          en: {
            title: titleEn,
            description: descriptionEn,
          },
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update localizations' },
      { status: 500 }
    )
  }
}
