import { NextResponse } from 'next/server'
import { removeYouTubeAccount } from '@/lib/youtube-accounts'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const accountId = typeof body.accountId === 'string' ? body.accountId : undefined

    await removeYouTubeAccount(accountId)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
