import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'
import { getYouTubeOAuthClient } from '@/lib/youtube-accounts'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const accountId = formData.get('accountId')
    const videoId = formData.get('videoId')
    const subtitle = formData.get('subtitle')
    const subtitleLanguage = formData.get('subtitleLanguage')
    const subtitleName = formData.get('subtitleName')

    if (
      typeof accountId !== 'string' ||
      typeof videoId !== 'string' ||
      !subtitle ||
      typeof subtitle === 'string'
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const oauth2Client = await getYouTubeOAuthClient(accountId)
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })

    const subtitleFile = subtitle as File
    const subtitleBuffer = Buffer.from(await subtitleFile.arrayBuffer())

    await youtube.captions.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          videoId,
          language:
            typeof subtitleLanguage === 'string' && subtitleLanguage
              ? subtitleLanguage
              : 'id',
          name:
            typeof subtitleName === 'string' && subtitleName
              ? subtitleName
              : 'Subtitle Indonesia',
          isDraft: false,
        },
      },
      media: {
        mimeType: subtitleFile.type || 'application/octet-stream',
        body: Readable.from(subtitleBuffer),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload subtitle' },
      { status: 500 }
    )
  }
}
