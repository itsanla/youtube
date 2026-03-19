import { NextResponse } from 'next/server'
import { getOneDriveAuthUrl } from '@/lib/onedrive-oauth'

export async function GET() {
  const authUrl = getOneDriveAuthUrl()
  return NextResponse.redirect(authUrl)
}
