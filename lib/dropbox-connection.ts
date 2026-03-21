import { redis } from './redis'

const DROPBOX_TOKENS_KEY = 'dropbox:tokens'

export async function checkDropboxConnection(): Promise<boolean> {
  try {
    const tokensData = await redis.get(DROPBOX_TOKENS_KEY)
    return !!tokensData
  } catch {
    return false
  }
}
