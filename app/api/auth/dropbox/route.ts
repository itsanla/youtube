import { NextResponse } from 'next/server'
import { getDropboxAuthUrl } from '@/lib/dropbox-oauth'

export async function GET() {
  const authUrl = getDropboxAuthUrl()
  return NextResponse.redirect(authUrl)
}
