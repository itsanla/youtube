import { getChannels } from '@/app/actions/channel-actions'
import { RemoteUploadForm } from '@/app/components/RemoteUploadForm'
import { SettingsButton } from '@/app/components/SettingsButton'
import { getYouTubeAccounts } from '@/lib/youtube-accounts'
import Link from 'next/link'

export const metadata = {
  title: 'Dashboard Channel YouTube',
  description: 'Upload video, rencana video, dan remote upload',
}

export default async function DashboardPage() {
  const channels = await getChannels()
  const youtubeAccounts = await getYouTubeAccounts()

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white px-4 py-10 relative">
      <SettingsButton />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">YouTube Planner</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Dashboard Fitur Utama
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Pilih channel untuk upload video atau kelola rencana video, lalu gunakan remote upload untuk transfer file dari URL.
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Upload Video</h2>
            <p className="mt-1 text-sm text-slate-600">
              Pilih akun/channel YouTube yang sudah terhubung.
            </p>

            <div className="mt-4 space-y-3">
              {youtubeAccounts.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Belum ada akun YouTube terhubung. Tambahkan akun lewat Settings di kanan atas.
                </div>
              ) : (
                youtubeAccounts.map((account) => (
                  <Link
                    key={`upload-${account.id}`}
                    href={`/dashboard/upload?ytAccount=${encodeURIComponent(account.id)}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{account.title}</p>
                      <p className="text-xs text-slate-500">Akun YouTube untuk upload</p>
                    </div>
                    <span className="text-sm font-medium text-blue-700">Pilih</span>
                  </Link>
                ))
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Rencana Video</h2>
            <p className="mt-1 text-sm text-slate-600">
              Pilih channel untuk membuka dashboard rencana video harian.
            </p>

            <div className="mt-4 space-y-3">
              {channels.map((channel) => (
                <Link
                  key={`plan-${channel}`}
                  href={`/dashboard/${encodeURIComponent(channel)}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{channel}</p>
                    <p className="text-xs text-slate-500">Kelola rencana video</p>
                  </div>
                  <span className="text-sm font-medium text-emerald-700">Buka</span>
                </Link>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Remote Upload</h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload file dari URL langsung ke cloud storage.
          </p>

          <div className="mt-4">
            <RemoteUploadForm />
          </div>
        </section>
      </div>
    </main>
  )
}
