import { NextResponse } from 'next/server'
import { getYouTubeAccounts } from '@/lib/youtube-accounts'

export async function GET() {
  try {
    const accounts = await getYouTubeAccounts()
    return NextResponse.json({
      connected: accounts.length > 0,
      count: accounts.length,
      accounts: accounts.map((account) => ({
        id: account.id,
        title: account.title,
      })),
    })
  } catch {
    return NextResponse.json({ connected: false, count: 0, accounts: [] })
  }
}
