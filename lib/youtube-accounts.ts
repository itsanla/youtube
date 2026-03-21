import { google } from 'googleapis'
import { getOAuth2Client } from './youtube-oauth'
import { redis } from './redis'

const YOUTUBE_ACCOUNTS_KEY = 'youtube:accounts'
const LEGACY_YOUTUBE_TOKENS_KEY = 'youtube:tokens'

interface YouTubeTokenPayload {
  access_token?: string
  refresh_token?: string
  scope?: string
  token_type?: string
  expiry_date?: number
}

export interface YouTubeAccount {
  id: string
  title: string
  customUrl?: string
  thumbnailUrl?: string
  subscriberCount?: string
  connectedAt: string
  tokens: YouTubeTokenPayload
}

interface YouTubeChannelInfo {
  id: string
  title: string
  customUrl?: string
  thumbnailUrl?: string
  subscriberCount?: string
}

export class YouTubeChannelNotFoundError extends Error {
  email?: string

  constructor(message: string, email?: string) {
    super(message)
    this.name = 'YouTubeChannelNotFoundError'
    this.email = email
  }
}

function parseAccounts(value: unknown): YouTubeAccount[] {
  if (!value) {
    return []
  }

  const parsed = typeof value === 'string' ? JSON.parse(value) : value

  const rawItems = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null
      ? Object.values(parsed)
      : []

  if (rawItems.length === 0) {
    return []
  }

  return rawItems
    .map((item): YouTubeAccount | null => {
      if (typeof item !== 'object' || item === null) {
        return null
      }

      const data = item as Record<string, unknown>
      const id = typeof data.id === 'string' ? data.id : null
      const title = typeof data.title === 'string' ? data.title : null

      if (!id || !title) {
        return null
      }

      const connectedAt =
        typeof data.connectedAt === 'string' && data.connectedAt.trim().length > 0
          ? data.connectedAt
          : new Date().toISOString()

      const tokens =
        typeof data.tokens === 'object' && data.tokens !== null
          ? (data.tokens as YouTubeTokenPayload)
          : {}

      const normalizedAccount: YouTubeAccount = {
        id,
        title,
        customUrl: typeof data.customUrl === 'string' ? data.customUrl : undefined,
        thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : undefined,
        subscriberCount:
          typeof data.subscriberCount === 'string' ? data.subscriberCount : undefined,
        connectedAt,
        tokens,
      }

      return normalizedAccount
    })
    .filter((account): account is YouTubeAccount => account !== null)
}

async function readAccountsFromRedis(): Promise<YouTubeAccount[]> {
  const stored = await redis.get(YOUTUBE_ACCOUNTS_KEY)
  return parseAccounts(stored)
}

async function writeAccountsToRedis(accounts: YouTubeAccount[]): Promise<void> {
  await redis.set(YOUTUBE_ACCOUNTS_KEY, JSON.stringify(accounts))
}

async function fetchGoogleEmail(tokens: YouTubeTokenPayload): Promise<string | undefined> {
  try {
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials(tokens)

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const profile = await oauth2.userinfo.get()
    return profile.data.email || undefined
  } catch {
    return undefined
  }
}

async function fetchYouTubeChannelsInfo(tokens: YouTubeTokenPayload): Promise<YouTubeChannelInfo[]> {
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials(tokens)

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client })
  const response = await youtube.channels.list({
    part: ['snippet', 'statistics'],
    mine: true,
    maxResults: 50,
  })

  const channels = (response.data.items || [])
    .filter((channel) => !!channel.id)
    .map((channel) => ({
      id: channel.id!,
      title: channel.snippet?.title || 'Unknown',
      customUrl: channel.snippet?.customUrl || undefined,
      thumbnailUrl: channel.snippet?.thumbnails?.default?.url || undefined,
      subscriberCount: channel.statistics?.subscriberCount || undefined,
    }))

  if (channels.length === 0) {
    const email = await fetchGoogleEmail(tokens)
    throw new YouTubeChannelNotFoundError('Channel YouTube tidak ditemukan untuk akun ini', email)
  }

  return channels
}

async function migrateLegacyTokenIfNeeded(): Promise<void> {
  const existingAccounts = await readAccountsFromRedis()
  if (existingAccounts.length > 0) {
    return
  }

  const legacyTokensData = await redis.get(LEGACY_YOUTUBE_TOKENS_KEY)
  if (!legacyTokensData) {
    return
  }

  const tokens =
    typeof legacyTokensData === 'string'
      ? (JSON.parse(legacyTokensData) as YouTubeTokenPayload)
      : (legacyTokensData as YouTubeTokenPayload)

  const channels = await fetchYouTubeChannelsInfo(tokens)

  const migratedAccounts: YouTubeAccount[] = channels.map((channelInfo) => ({
    ...channelInfo,
    connectedAt: new Date().toISOString(),
    tokens,
  }))

  await writeAccountsToRedis(migratedAccounts)
}

export async function getYouTubeAccounts(): Promise<YouTubeAccount[]> {
  try {
    await migrateLegacyTokenIfNeeded()
  } catch {
    // If migration fails, keep going with existing accounts.
  }

  return readAccountsFromRedis()
}

export async function addOrUpdateYouTubeAccount(tokens: YouTubeTokenPayload): Promise<YouTubeAccount> {
  const channelInfos = await fetchYouTubeChannelsInfo(tokens)
  const existingAccounts = await getYouTubeAccounts()
  const existingById = new Map(existingAccounts.map((account) => [account.id, account]))

  const connectedAccounts = channelInfos.map((channelInfo) => {
    const existingAccount = existingById.get(channelInfo.id)

    return {
      ...channelInfo,
      connectedAt: existingAccount?.connectedAt || new Date().toISOString(),
      tokens: {
        ...existingAccount?.tokens,
        ...tokens,
        refresh_token: tokens.refresh_token || existingAccount?.tokens.refresh_token,
      },
    }
  })

  const connectedIds = new Set(connectedAccounts.map((account) => account.id))
  const untouchedAccounts = existingAccounts.filter((account) => !connectedIds.has(account.id))
  const updatedAccounts = [...connectedAccounts, ...untouchedAccounts]

  await writeAccountsToRedis(updatedAccounts)

  return connectedAccounts[0]
}

export async function isAnyYouTubeAccountConnected(): Promise<boolean> {
  const accounts = await getYouTubeAccounts()
  return accounts.length > 0
}

export async function removeYouTubeAccount(accountId?: string): Promise<void> {
  if (!accountId) {
    await redis.del(YOUTUBE_ACCOUNTS_KEY)
    await redis.del(LEGACY_YOUTUBE_TOKENS_KEY)
    return
  }

  const accounts = await getYouTubeAccounts()
  const filtered = accounts.filter((account) => account.id !== accountId)
  await writeAccountsToRedis(filtered)

  if (filtered.length === 0) {
    await redis.del(LEGACY_YOUTUBE_TOKENS_KEY)
  }
}

export async function getYouTubeAccessToken(accountId?: string): Promise<string> {
  const accounts = await getYouTubeAccounts()
  if (accounts.length === 0) {
    throw new Error('YouTube belum terkoneksi')
  }

  const targetAccount = accountId
    ? accounts.find((account) => account.id === accountId)
    : accounts[0]

  if (!targetAccount) {
    throw new Error('Akun YouTube untuk upload tidak ditemukan')
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials(targetAccount.tokens)

  const currentExpiry = targetAccount.tokens.expiry_date ?? 0
  const shouldRefresh = !targetAccount.tokens.access_token || currentExpiry <= Date.now() + 60_000

  if (shouldRefresh) {
    await oauth2Client.getAccessToken()

    const credentials = oauth2Client.credentials

    const refreshedTokens: YouTubeTokenPayload = {
      ...targetAccount.tokens,
      access_token: credentials.access_token ?? undefined,
      refresh_token: credentials.refresh_token || targetAccount.tokens.refresh_token,
      scope: credentials.scope ?? undefined,
      token_type: credentials.token_type ?? undefined,
      expiry_date: credentials.expiry_date ?? undefined,
    }

    await addOrUpdateYouTubeAccount(refreshedTokens)

    if (!refreshedTokens.access_token) {
      throw new Error('Gagal mendapatkan access token YouTube')
    }

    return refreshedTokens.access_token
  }

  if (!targetAccount.tokens.access_token) {
    throw new Error('Gagal mendapatkan access token YouTube')
  }

  return targetAccount.tokens.access_token
}

export async function getYouTubeOAuthClient(accountId?: string) {
  const accounts = await getYouTubeAccounts()
  if (accounts.length === 0) {
    throw new Error('YouTube belum terkoneksi')
  }

  const targetAccount = accountId
    ? accounts.find((account) => account.id === accountId)
    : accounts[0]

  if (!targetAccount) {
    throw new Error('Akun YouTube untuk upload tidak ditemukan')
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials(targetAccount.tokens)

  const currentExpiry = targetAccount.tokens.expiry_date ?? 0
  const shouldRefresh = !targetAccount.tokens.access_token || currentExpiry <= Date.now() + 60_000

  if (shouldRefresh) {
    await oauth2Client.getAccessToken()
    const credentials = oauth2Client.credentials

    const refreshedTokens: YouTubeTokenPayload = {
      ...targetAccount.tokens,
      access_token: credentials.access_token ?? undefined,
      refresh_token: credentials.refresh_token || targetAccount.tokens.refresh_token,
      scope: credentials.scope ?? undefined,
      token_type: credentials.token_type ?? undefined,
      expiry_date: credentials.expiry_date ?? undefined,
    }

    await addOrUpdateYouTubeAccount(refreshedTokens)
    oauth2Client.setCredentials(refreshedTokens)
  }

  return oauth2Client
}
