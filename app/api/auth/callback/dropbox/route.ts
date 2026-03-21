import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken } from '@/lib/dropbox-oauth'
import { redis } from '@/lib/redis'

const DROPBOX_TOKENS_KEY = 'dropbox:tokens'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=dropbox_access_denied`)
  }

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=no_code`)
  }

  try {
    const tokens = await exchangeCodeForToken(code)

    if (!tokens.access_token) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=no_access_token`)
    }

    // Simpan dengan expires_at timestamp
    const tokensWithExpiry = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000),
    }

    await redis.set(DROPBOX_TOKENS_KEY, JSON.stringify(tokensWithExpiry))

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?success=dropbox_connected`)
  } catch (err) {
    console.error('Dropbox OAuth callback error:', err)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=token_exchange_failed`)
  }
}
