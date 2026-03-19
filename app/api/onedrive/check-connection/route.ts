import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

const ONEDRIVE_TOKENS_KEY = 'onedrive:tokens'

export async function GET() {
  try {
    const tokens = await redis.get(ONEDRIVE_TOKENS_KEY)
    return NextResponse.json({ connected: !!tokens })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
