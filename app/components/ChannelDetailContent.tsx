'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MovieTitleJsonInputForm } from './MovieTitleJsonInputForm'
import { ManualVideoPlanForm } from './ManualVideoPlanForm'
import { InsomeinVideoPlanTable } from './InsomeinVideoPlanTable'
import { EditVideoPlanModal } from './EditVideoPlanModal'
import type { VideoPlan } from '@/lib/youtube-types'

interface ChannelDetailContentProps {
  channelName: string
  plans: VideoPlan[]
}

export function ChannelDetailContent({ channelName, plans }: ChannelDetailContentProps) {
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<VideoPlan | null>(null)

  return (
    <>
      <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white px-4 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <header className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Channel Detail</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                  Dashboard {channelName}
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
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(true)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  Input Manual
                </button>
                <button
                  type="button"
                  onClick={() => setIsJsonModalOpen(true)}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  Input JSON
                </button>
              </div>
            </div>
          </header>

          <InsomeinVideoPlanTable
            channelName={channelName}
            plans={plans}
            onEditClick={setEditingPlan}
          />
        </div>
      </main>

      {/* JSON Input Modal */}
      {isJsonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-2xl font-semibold text-slate-900">Input JSON Judul Film</h2>
              <button
                type="button"
                onClick={() => setIsJsonModalOpen(false)}
                className="rounded-lg text-slate-500 hover:bg-slate-100 p-2 transition"
                aria-label="Tutup modal"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <MovieTitleJsonInputForm
              channelName={channelName}
              onSuccess={() => setIsJsonModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <EditVideoPlanModal
          channelName={channelName}
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
        />
      )}

      {/* Manual Input Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-2xl font-semibold text-slate-900">Input Rencana Video Manual</h2>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="rounded-lg text-slate-500 hover:bg-slate-100 p-2 transition"
                aria-label="Tutup modal"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <ManualVideoPlanForm
              channelName={channelName}
              onClose={() => setIsManualModalOpen(false)}
              onSuccess={() => setIsManualModalOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
