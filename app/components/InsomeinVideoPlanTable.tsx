'use client'

import { useMemo, useState } from 'react'
import { formatDateToIndonesian } from '@/lib/format-date'
import type { VideoPlan } from '@/lib/youtube-types'

interface InsomeinVideoPlanTableProps {
  channelName: string
  plans: VideoPlan[]
}

export function InsomeinVideoPlanTable({ channelName, plans }: InsomeinVideoPlanTableProps) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const sortedPlans = useMemo(() => {
    const next = [...plans]
    next.sort((a, b) => a.tanggal_upload.localeCompare(b.tanggal_upload))

    if (sortOrder === 'desc') {
      next.reverse()
    }

    return next
  }, [plans, sortOrder])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">
          Rencana Video Harian {channelName}
        </h2>
        <button
          type="button"
          onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Sort tanggal: {sortOrder === 'asc' ? 'Terlama' : 'Terbaru'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 font-semibold text-slate-700">judul_video</th>
              <th className="px-3 py-2 font-semibold text-slate-700">judul_film</th>
              <th className="px-3 py-2 font-semibold text-slate-700">tanggal_upload</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlans.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                  Belum ada rencana video.
                </td>
              </tr>
            ) : (
              sortedPlans.map((plan) => (
                <tr key={`${plan.judul_film}-${plan.tanggal_upload}`} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-800">{plan.judul_video}</td>
                  <td className="px-3 py-2 text-slate-700">{plan.judul_film}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">{formatDateToIndonesian(plan.tanggal_upload)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
