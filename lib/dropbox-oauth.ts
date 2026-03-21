export function getDropboxAuthUrl() {
  const clientId = process.env.DROPBOX_CLIENT_ID
  const redirectUri = process.env.DROPBOX_REDIRECT_URI
  
  const params = new URLSearchParams({
    client_id: clientId!,
    response_type: 'code',
    redirect_uri: redirectUri!,
    token_access_type: 'offline', // untuk refresh token
  })

  return `https://www.dropbox.com/oauth2/authorize?${params}`
}

export async function exchangeCodeForToken(code: string) {
  const clientId = process.env.DROPBOX_CLIENT_ID
  const clientSecret = process.env.DROPBOX_CLIENT_SECRET
  const redirectUri = process.env.DROPBOX_REDIRECT_URI

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri!,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to exchange code for token')
  }

  return response.json()
}

export async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.DROPBOX_CLIENT_ID
  const clientSecret = process.env.DROPBOX_CLIENT_SECRET

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId!,
      client_secret: clientSecret!,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to refresh token')
  }

  return response.json()
}

export async function getValidAccessToken(tokens: any) {
  const now = Date.now()
  const expiresAt = tokens.expires_at || 0
  const buffer = 5 * 60 * 1000 // 5 menit buffer

  // Jika token masih valid (belum expired atau akan expired dalam 5 menit)
  if (expiresAt > now + buffer) {
    return tokens.access_token
  }

  // Refresh token
  const newTokens = await refreshAccessToken(tokens.refresh_token)
  return {
    access_token: newTokens.access_token,
    refresh_token: tokens.refresh_token, // refresh token tidak berubah
    expires_at: now + (newTokens.expires_in * 1000),
  }
}
