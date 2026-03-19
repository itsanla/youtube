import { ChannelList } from '@/app/components/ChannelList'
import { InsomeinVideoPlanTable } from '@/app/components/InsomeinVideoPlanTable'
import { MovieTitleJsonInputForm } from '@/app/components/MovieTitleJsonInputForm'
import { getChannels, getVideoPlans } from '@/app/actions/channel-actions'

export const metadata = {
  title: 'Dashboard Channel YouTube',
  description: 'Manajemen channel dan rencana video insomein',
}

export default async function DashboardPage() {
  const [channels, plans] = await Promise.all([getChannels(), getVideoPlans()])

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white px-4 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">YouTube Planner</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Dashboard Manajemen Channel & Rencana Video
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Fokus utama pada channel insomein untuk perencanaan konten review film berbasis input JSON.
          </p>
        </header>

        <ChannelList channels={channels} />

        <section className="grid gap-6 lg:grid-cols-2">
          <MovieTitleJsonInputForm />
          <InsomeinVideoPlanTable plans={plans} />
        </section>
      </div>
    </main>
  )
}
