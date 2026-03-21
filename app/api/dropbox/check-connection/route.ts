import { NextResponse } from 'next/server'
import { checkDropboxConnection } from '@/lib/dropbox-connection'

export async function GET() {
  try {
    const connected = await checkDropboxConnection()
    return NextResponse.json({ connected })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
