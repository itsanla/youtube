import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { getDownloadUrl } from '@/lib/onedrive-oauth'

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
    const downloadUrl = await getDownloadUrl(tokens.access_token, itemId)

    return NextResponse.json({ downloadUrl })
  } catch (error) {
    console.error('Get download URL error:', error)
    return NextResponse.json(
      { error: 'Failed to get download URL' },
      { status: 500 }
    )
  }
}
