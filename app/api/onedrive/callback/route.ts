import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken } from '@/lib/onedrive-oauth'
import { redis } from '@/lib/redis'

const ONEDRIVE_TOKENS_KEY = 'onedrive:tokens'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=onedrive_access_denied`)
  }

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=no_code`)
  }

  try {
    const tokens = await exchangeCodeForToken(code)

    if (!tokens.access_token) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=no_access_token`)
    }

    await redis.set(ONEDRIVE_TOKENS_KEY, JSON.stringify(tokens))

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?success=onedrive_connected`)
  } catch (err) {
    console.error('OneDrive OAuth callback error:', err)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=token_exchange_failed`)
  }
}
