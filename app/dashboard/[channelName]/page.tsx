import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getChannels, getVideoPlans } from '@/app/actions/channel-actions'
import { InsomeinVideoPlanTable } from '@/app/components/InsomeinVideoPlanTable'
import { MovieTitleJsonInputForm } from '@/app/components/MovieTitleJsonInputForm'

interface ChannelDetailPageProps {
  params: Promise<{ channelName: string }>
}

export default async function ChannelDetailPage({ params }: ChannelDetailPageProps) {
  const { channelName } = await params
  const normalizedChannelName = decodeURIComponent(channelName).trim().toLocaleLowerCase()

  if (!normalizedChannelName) {
    notFound()
  }

  const channels = await getChannels()
  if (!channels.includes(normalizedChannelName)) {
    notFound()
  }

  const plans = await getVideoPlans(normalizedChannelName)

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white px-4 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Channel Detail</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Dashboard {normalizedChannelName}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Atur rencana video harian dan input JSON judul film untuk channel ini.
          </p>
          <Link
            href="/dashboard"
            className="mt-3 inline-block text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-2"
          >
            Kembali ke daftar channel
          </Link>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <MovieTitleJsonInputForm channelName={normalizedChannelName} />
          <InsomeinVideoPlanTable channelName={normalizedChannelName} plans={plans} />
        </section>
      </div>
    </main>
  )
}
