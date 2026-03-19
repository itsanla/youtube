import { NextRequest, NextResponse } from 'next/server'
import { getOAuth2Client } from '@/lib/youtube-oauth'
import { redis } from '@/lib/redis'

const YOUTUBE_TOKENS_KEY = 'youtube:tokens'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=access_denied`)
  }

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=no_code`)
  }

  try {
    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=no_refresh_token`)
    }

    await redis.set(YOUTUBE_TOKENS_KEY, JSON.stringify(tokens))

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?success=connected`)
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=token_exchange_failed`)
  }
}
