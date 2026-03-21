import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { getValidAccessToken } from '@/lib/onedrive-oauth'

const ONEDRIVE_TOKENS_KEY = 'onedrive:tokens'

export async function GET() {
  try {
    const tokensData = await redis.get(ONEDRIVE_TOKENS_KEY)
    
    if (!tokensData) {
      return NextResponse.json(
        { error: 'OneDrive belum terkoneksi' },
        { status: 401 }
      )
    }

    const tokens = typeof tokensData === 'string' ? JSON.parse(tokensData) : tokensData

    // Auto-refresh jika token expired
    const validToken = await getValidAccessToken(tokens)
    if (typeof validToken === 'object') {
      await redis.set(ONEDRIVE_TOKENS_KEY, JSON.stringify(validToken))
      return NextResponse.json({
        accessToken: validToken.access_token,
      })
    }

    return NextResponse.json({
      accessToken: validToken,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get access token' },
      { status: 500 }
    )
  }
}
