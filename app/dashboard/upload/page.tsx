import Link from 'next/link'
import { YouTubeUploadForm } from '@/app/components/YouTubeUploadForm'
import { SettingsButton } from '@/app/components/SettingsButton'
import { getYouTubeAccounts } from '@/lib/youtube-accounts'

export const metadata = {
  title: 'Upload Video YouTube',
  description: 'Upload video ke YouTube',
}

export default async function DashboardUploadPage() {
  const youtubeAccounts = await getYouTubeAccounts()
  const isYouTubeConnected = youtubeAccounts.length > 0

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white px-4 py-10 relative">
      <SettingsButton />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">YouTube Uploader</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Upload Video ke YouTube
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Channel bisa dipilih dari baris pilihan pada form upload di bawah.
          </p>
          <Link
            href="/dashboard"
            className="mt-3 inline-block text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-2"
          >
            Kembali ke daftar channel
          </Link>
        </header>

        {isYouTubeConnected ? (
          <YouTubeUploadForm youtubeAccounts={youtubeAccounts} />
        ) : (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-amber-900">YouTube belum terhubung</h2>
            <p className="mt-2 text-sm text-amber-800">
              Hubungkan akun melalui menu Settings di kanan atas terlebih dahulu.
            </p>
          </section>
        )}
      </div>
    </main>
  )
}
