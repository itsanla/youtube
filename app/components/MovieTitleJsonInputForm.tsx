'use client'

import { useActionState, useState } from 'react'
import { submitMovieTitles } from '@/app/actions/channel-actions'
import type { MovieSubmitState } from '@/lib/youtube-types'

const initialState: MovieSubmitState = {
  status: 'idle',
  message: '',
  alreadyUsed: [],
  newTitles: [],
  createdPlans: [],
}

const EXAMPLE_JSON = `["Inception", "The Matrix", "Parasite", "Oppenheimer", "Interstellar", "Dune"]`

interface MovieTitleJsonInputFormProps {
  channelName: string
}

export function MovieTitleJsonInputForm({ channelName }: MovieTitleJsonInputFormProps) {
  const [jsonInput, setJsonInput] = useState('[]')
  const [submitIntent, setSubmitIntent] = useState<'analyze' | 'save'>('analyze')
  const [copiedNotification, setCopiedNotification] = useState(false)
  const [state, formAction, pending] = useActionState(submitMovieTitles, initialState)

  const handleCopyExample = async () => {
    try {
      await navigator.clipboard.writeText(EXAMPLE_JSON)
      setCopiedNotification(true)
      setTimeout(() => setCopiedNotification(false), 2000)
    } catch {
      // Fallback jika clipboard API tidak tersedia
      const textarea = document.createElement('textarea')
      textarea.value = EXAMPLE_JSON
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedNotification(true)
      setTimeout(() => setCopiedNotification(false), 2000)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Input JSON Judul Film</h2>
      <p className="mt-1 text-sm text-slate-600">
        Paste array JSON judul film, lalu analisa judul yang sudah dipakai vs yang masih baru.
      </p>

      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-xs font-semibold text-blue-900">Contoh Format JSON:</p>
        <p className="mt-1 font-mono text-xs text-blue-800">{EXAMPLE_JSON}</p>
      </div>

      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="channelName" value={channelName} />
        <textarea
          name="movieTitlesJson"
          value={jsonInput}
          onChange={(event) => setJsonInput(event.target.value)}
          rows={7}
          required
          className="w-full rounded-lg border border-slate-300 p-3 font-mono text-sm text-slate-900 outline-none ring-offset-2 transition focus:border-slate-500 focus:ring-2 focus:ring-slate-300"
          placeholder='["Inception", "The Matrix", "Parasite", "Oppenheimer"]'
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyExample}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            {copiedNotification ? '✓ Disalin!' : 'Salin Contoh'}
          </button>
          <button
            type="submit"
            name="intent"
            value="analyze"
            onClick={() => setSubmitIntent('analyze')}
            disabled={pending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && submitIntent === 'analyze' ? 'Menganalisa...' : 'Analisa JSON'}
          </button>
          <button
            type="submit"
            name="intent"
            value="save"
            onClick={() => setSubmitIntent('save')}
            disabled={pending || state.newTitles.length === 0}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && submitIntent === 'save' ? 'Menyimpan...' : 'Submit Judul Baru'}
          </button>
        </div>
      </form>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">SUDAH DIPAKAI</h3>
          {state.alreadyUsed.length === 0 ? (
            <p className="mt-2 text-sm text-amber-800">Tidak ada judul bentrok.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {state.alreadyUsed.map((title) => (
                <li key={`used-${title}`}>- {title}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="text-sm font-semibold text-emerald-900">BELUM DIPAKAI</h3>
          {state.newTitles.length === 0 ? (
            <p className="mt-2 text-sm text-emerald-800">Belum ada judul baru.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-emerald-900">
              {state.newTitles.map((title) => (
                <li key={`new-${title}`}>- {title}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {state.createdPlans.length > 0 ? (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-blue-900">Rencana Berhasil Dibuat</h3>
          <ul className="mt-2 space-y-1 text-sm text-blue-900">
            {state.createdPlans.map((plan) => (
              <li key={`${plan.judul_film}-${plan.tanggal_upload}`}>
                {plan.tanggal_upload} - {plan.judul_video}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.status !== 'idle' && state.message ? (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            state.status === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
          role="status"
          aria-live="polite"
        >
          {state.message}
        </div>
      ) : null}
    </section>
  )
}
