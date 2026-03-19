export function getOneDriveAuthUrl() {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI
  
  const params = new URLSearchParams({
    client_id: clientId!,
    response_type: 'code',
    redirect_uri: redirectUri!,
    scope: 'files.read offline_access',
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
