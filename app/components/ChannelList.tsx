'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { createChannel } from '@/app/actions/channel-actions'
import type { ChannelActionState } from '@/lib/youtube-types'

const initialState: ChannelActionState = {
  status: 'idle',
  message: '',
}

interface ChannelListProps {
  channels: string[]
}

export function ChannelList({ channels }: ChannelListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [state, formAction, pending] = useActionState(createChannel, initialState)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-900">Daftar Channel</h2>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Tambah Channel
        </button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {channels.map((channel) => (
          <li key={channel} className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-800">{channel}</p>
            <Link
              href={`/dashboard/${encodeURIComponent(channel)}`}
              className="mt-1 inline-block text-xs text-blue-600 underline decoration-blue-300 underline-offset-2"
            >
              Lihat rencana video
            </Link>
          </li>
        ))}
      </ul>

      {isModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Tambah Channel Baru</h3>
            <p className="mt-1 text-sm text-slate-600">
              Channel akan disimpan ke Redis Set dengan key channels.
            </p>
            <form action={formAction} className="mt-4 space-y-3">
              <input
                name="channelName"
                type="text"
                placeholder="contoh: techreview"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-offset-2 transition focus:border-slate-500 focus:ring-2 focus:ring-slate-300"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
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
