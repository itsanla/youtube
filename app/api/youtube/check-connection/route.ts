import { NextResponse } from 'next/server'
import { checkYouTubeConnection } from '@/lib/youtube-upload'

export async function GET() {
  try {
    const connected = await checkYouTubeConnection()
    return NextResponse.json({ connected })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
