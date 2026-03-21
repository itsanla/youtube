import { NextResponse } from 'next/server'
import { getYouTubeAccessToken } from '@/lib/youtube-accounts'

interface YouTubePlaylistItem {
  id: string
  snippet?: {
    title?: string
  }
  contentDetails?: {
    itemCount?: number
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const accountId = url.searchParams.get('accountId') || undefined

    const accessToken = await getYouTubeAccessToken(accountId)

    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const details = await response.text()
      return NextResponse.json(
        { error: `Failed to fetch playlists: ${details}` },
        { status: 500 }
      )
    }

    const data = (await response.json()) as { items?: YouTubePlaylistItem[] }

    const playlists = (data.items || []).map((playlist) => ({
      id: playlist.id,
      title: playlist.snippet?.title || 'Untitled Playlist',
      itemCount: playlist.contentDetails?.itemCount || 0,
    }))

    return NextResponse.json({ playlists })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch playlists' },
      { status: 500 }
    )
  }
}
