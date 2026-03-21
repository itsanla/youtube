import { NextResponse } from 'next/server'
import { getYouTubeAccessToken } from '@/lib/youtube-accounts'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const accountId = url.searchParams.get('accountId') || undefined
    const accessToken = await getYouTubeAccessToken(accountId)

    return NextResponse.json({
      accessToken,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get access token' },
      { status: 500 }
    )
  }
}
