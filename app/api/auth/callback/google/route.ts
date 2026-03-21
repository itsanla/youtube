import { NextRequest, NextResponse } from 'next/server'
import { getOAuth2Client } from '@/lib/youtube-oauth'
import { addOrUpdateYouTubeAccount, YouTubeChannelNotFoundError } from '@/lib/youtube-accounts'

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

    const normalizedTokens = {
      access_token: tokens.access_token ?? undefined,
      refresh_token: tokens.refresh_token ?? undefined,
      scope: tokens.scope ?? undefined,
      token_type: tokens.token_type ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
    }

    if (!normalizedTokens.access_token && !normalizedTokens.refresh_token) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=no_access_token`)
    }

    const connectedAccount = await addOrUpdateYouTubeAccount(normalizedTokens)

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?success=connected&youtubeChannel=${encodeURIComponent(connectedAccount.title)}`
    )
  } catch (err) {
    console.error('OAuth callback error:', err)

    if (err instanceof YouTubeChannelNotFoundError) {
      const emailParam = err.email ? `&email=${encodeURIComponent(err.email)}` : ''
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=youtube_channel_not_found${emailParam}`
      )
    }

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=token_exchange_failed`)
  }
}
