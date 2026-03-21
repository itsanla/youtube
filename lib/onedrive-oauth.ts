export function getOneDriveAuthUrl() {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI
  
  const params = new URLSearchParams({
    client_id: clientId!,
    response_type: 'code',
    redirect_uri: redirectUri!,
    scope: 'Files.ReadWrite offline_access',
  })

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
}

export async function exchangeCodeForToken(code: string) {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      code,
      redirect_uri: redirectUri!,
      grant_type: 'authorization_code',
    }),
  })

  return response.json()
}

export async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
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
    throw new Error('Failed to refresh OneDrive token')
  }

  return response.json()
}

export async function getValidAccessToken(tokens: any) {
  const now = Date.now()
  const expiresAt = tokens.expires_at || 0
  const buffer = 5 * 60 * 1000 // 5 menit buffer

  // Jika token masih valid
  if (expiresAt > now + buffer) {
    return tokens.access_token
  }

  // Refresh token
  const newTokens = await refreshAccessToken(tokens.refresh_token)
  return {
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token || tokens.refresh_token,
    expires_at: now + (newTokens.expires_in * 1000),
  }
}

export async function getDownloadUrl(accessToken: string, itemId: string): Promise<string> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  const data = await response.json()
  return data['@microsoft.graph.downloadUrl']
}
