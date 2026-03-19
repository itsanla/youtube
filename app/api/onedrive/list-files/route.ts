import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

const ONEDRIVE_TOKENS_KEY = 'onedrive:tokens'

export async function GET() {
  try {
    const tokensData = await redis.get(ONEDRIVE_TOKENS_KEY)
    if (!tokensData) {
      return NextResponse.json({ error: 'OneDrive not connected' }, { status: 401 })
    }

    const tokens = typeof tokensData === 'string' ? JSON.parse(tokensData) : tokensData

    // Get files from OneDrive root
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/drive/root/children',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch files')
    }

    const data = await response.json()

    // Map to simpler format
    const files = data.value
      .filter((item: any) => item.file) // Only files, not folders
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        size: item.size,
      }))

    return NextResponse.json({ files })
  } catch (error) {
    console.error('List files error:', error)
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    )
  }
}
