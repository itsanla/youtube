import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export async function POST() {
  try {
    await redis.del('onedrive:tokens')
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
