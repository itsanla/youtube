import { ChannelList } from '@/app/components/ChannelList'
import { getChannels } from '@/app/actions/channel-actions'
import { YouTubeConnection } from '@/app/components/YouTubeConnection'
import { YouTubeUploadForm } from '@/app/components/YouTubeUploadForm'
import { checkYouTubeConnection } from '@/lib/youtube-upload'
import { getConnectedChannelInfo } from '@/lib/youtube-channel'

export const metadata = {
  title: 'Dashboard Channel YouTube',
  description: 'Daftar channel YouTube',
}

export default async function DashboardPage() {
  const channels = await getChannels()
  const isYouTubeConnected = await checkYouTubeConnection()
  const channelInfo = isYouTubeConnected ? await getConnectedChannelInfo() : null

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white px-4 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">YouTube Planner</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Dashboard Manajemen Channel & Rencana Video
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Pilih satu channel untuk masuk ke halaman detail rencana video harian dan input JSON judul film.
          </p>
        </header>

        <YouTubeConnection isConnected={isYouTubeConnected} channelInfo={channelInfo} />

        {isYouTubeConnected && <YouTubeUploadForm />}

        <ChannelList channels={channels} />
      </div>
    </main>
  )
}
