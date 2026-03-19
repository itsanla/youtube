import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

const YOUTUBE_TOKENS_KEY = 'youtube:tokens'

export async function GET() {
  try {
    const tokensData = await redis.get(YOUTUBE_TOKENS_KEY)
    
    if (!tokensData) {
      return NextResponse.json(
        { error: 'YouTube belum terkoneksi' },
        { status: 401 }
      )
    }

    const tokens = typeof tokensData === 'string' ? JSON.parse(tokensData) : tokensData

    return NextResponse.json({
      accessToken: tokens.access_token,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get access token' },
      { status: 500 }
    )
  }
}
