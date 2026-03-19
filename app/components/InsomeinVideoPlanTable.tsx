'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { formatDateToIndonesian } from '@/lib/format-date'
import { deleteVideoPlan } from '@/app/actions/channel-actions'
import type { VideoPlan } from '@/lib/youtube-types'

interface InsomeinVideoPlanTableProps {
  channelName: string
  plans: VideoPlan[]
  onEditClick: (plan: VideoPlan) => void
  onDeleteSuccess?: () => void
}

type SortField = 'tanggal' | 'judul_film' | 'judul_video'
type SortOrder = 'asc' | 'desc'

export function InsomeinVideoPlanTable({
  channelName,
  plans,
  onEditClick,
  onDeleteSuccess,
}: InsomeinVideoPlanTableProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('tanggal')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [deleteConfirm, setDeleteConfirm] = useState<{
    plan: VideoPlan
    isLoading?: boolean
  } | null>(null)

  // Filter dan sort plans
  const processedPlans = useMemo(() => {
    // Filter berdasarkan search query
    let filtered = plans.filter((plan) => {
      const query = searchQuery.toLowerCase()
      return (
        plan.judul_video.toLowerCase().includes(query) ||
        plan.judul_film.toLowerCase().includes(query) ||
        plan.tanggal_upload.includes(query)
      )
    })

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      if (sortField === 'tanggal') {
        aValue = new Date(a.tanggal_upload).getTime()
        bValue = new Date(b.tanggal_upload).getTime()
      } else if (sortField === 'judul_film') {
        aValue = a.judul_film.toLowerCase()
        bValue = b.judul_film.toLowerCase()
      } else {
        // judul_video
        aValue = a.judul_video.toLowerCase() || '\u0000' // null character untuk kosong
        bValue = b.judul_video.toLowerCase() || '\u0000'
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue, 'id')
          : bValue.localeCompare(aValue, 'id')
      }

      return sortOrder === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })

    return sorted
  }, [plans, searchQuery, sortField, sortOrder])

  const handleDelete = async () => {
    if (!deleteConfirm?.plan) return

    setDeleteConfirm({ ...deleteConfirm, isLoading: true })

    const result = await deleteVideoPlan(
      channelName,
      deleteConfirm.plan.judul_film,
      deleteConfirm.plan.tanggal_upload
    )

    if (result.status === 'success') {
      setDeleteConfirm(null)
      // Wait a moment for server to process, then refresh
      setTimeout(() => {
        router.refresh()
        onDeleteSuccess?.()
      }, 500)
    } else {
      setDeleteConfirm({ plan: deleteConfirm.plan, isLoading: false })
      alert('Gagal menghapus: ' + result.message)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">
          Rencana Video Harian {channelName}
        </h2>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Cari judul video, film, atau tanggal..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">Sort:</span>
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as SortField)}
          className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        >
          <option value="tanggal">Tanggal Upload</option>
          <option value="judul_film">Judul Film</option>
          <option value="judul_video">Judul Video</option>
        </select>

        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="text-sm px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
        >
          {sortOrder === 'asc' ? '↑ A-Z' : '↓ Z-A'}
        </button>

        <div className="ml-auto text-sm font-semibold text-slate-700">
          Hasil: {processedPlans.length} dari {plans.length}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 font-semibold text-slate-700">judul_video</th>
              <th className="px-3 py-2 font-semibold text-slate-700">judul_film</th>
              <th className="px-3 py-2 font-semibold text-slate-700">tanggal_upload</th>
              <th className="px-3 py-2 text-center font-semibold text-slate-700">aksi</th>
            </tr>
          </thead>
          <tbody>
            {processedPlans.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  {searchQuery
                    ? 'Tidak ada rencana yang cocok dengan pencarian.'
                    : 'Belum ada rencana video.'}
                </td>
              </tr>
            ) : (
              processedPlans.map((plan) => (
                <tr
                  key={`${plan.judul_film}-${plan.tanggal_upload}`}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 text-slate-800">
                    {plan.judul_video || (
                      <span className="italic text-slate-400">Kosong</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{plan.judul_film}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">
                    {formatDateToIndonesian(plan.tanggal_upload)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => onEditClick(plan)}
                        className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ plan })}
                        className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl bg-white p-6 shadow-lg max-w-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Hapus Rencana Video?
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Apakah Anda yakin ingin menghapus rencana video ini?
            </p>
            <div className="mb-4 space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
              <p>
                <span className="font-semibold">Film:</span>{' '}
                {deleteConfirm.plan.judul_film}
              </p>
              <p>
                <span className="font-semibold">Tanggal:</span>{' '}
                {formatDateToIndonesian(deleteConfirm.plan.tanggal_upload)}
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteConfirm.isLoading}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm.isLoading}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-400 transition-colors"
              >
                {deleteConfirm.isLoading ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
