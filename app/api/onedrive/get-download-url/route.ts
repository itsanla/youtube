import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { getDownloadUrl, getValidAccessToken } from '@/lib/onedrive-oauth'

const ONEDRIVE_TOKENS_KEY = 'onedrive:tokens'

export async function POST(request: NextRequest) {
  try {
    const { itemId } = await request.json()

    if (!itemId) {
      return NextResponse.json({ error: 'Missing itemId' }, { status: 400 })
    }

    const tokensData = await redis.get(ONEDRIVE_TOKENS_KEY)
    if (!tokensData) {
      return NextResponse.json({ error: 'OneDrive not connected' }, { status: 401 })
    }

    const tokens = typeof tokensData === 'string' ? JSON.parse(tokensData) : tokensData
    
    // Auto-refresh jika token expired
    const validToken = await getValidAccessToken(tokens)
    if (typeof validToken === 'object') {
      await redis.set(ONEDRIVE_TOKENS_KEY, JSON.stringify(validToken))
      var accessToken = validToken.access_token
    } else {
      var accessToken = validToken
    }
    
    const downloadUrl = await getDownloadUrl(accessToken, itemId)

    return NextResponse.json({ downloadUrl })
  } catch (error) {
    console.error('Get download URL error:', error)
    return NextResponse.json(
      { error: 'Failed to get download URL' },
      { status: 500 }
    )
  }
}
