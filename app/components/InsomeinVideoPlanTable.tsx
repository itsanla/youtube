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
type DeleteMode = 'single' | 'bulk'

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
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<{
    mode: DeleteMode
    plan?: VideoPlan
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
        aValue = a.judul_video.toLowerCase() || '\u0000'
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

  const getPlanKey = (plan: VideoPlan): string => {
    return `${plan.judul_film}-${plan.tanggal_upload}`
  }

  const isAllSelected =
    processedPlans.length > 0 &&
    processedPlans.every((plan) => selectedRows.has(getPlanKey(plan)))

  const isSomeSelected =
    processedPlans.length > 0 &&
    processedPlans.some((plan) => selectedRows.has(getPlanKey(plan)))

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRows(new Set())
    } else {
      const newSelected = new Set<string>()
      processedPlans.forEach((plan) => {
        newSelected.add(getPlanKey(plan))
      })
      setSelectedRows(newSelected)
    }
  }

  const handleSelectRow = (plan: VideoPlan) => {
    const key = getPlanKey(plan)
    const newSelected = new Set(selectedRows)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedRows(newSelected)
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return

    setDeleteConfirm({ ...deleteConfirm, isLoading: true })

    if (deleteConfirm.mode === 'single' && deleteConfirm.plan) {
      const result = await deleteVideoPlan(
        channelName,
        deleteConfirm.plan.judul_film,
        deleteConfirm.plan.tanggal_upload
      )

      if (result.status === 'success') {
        setDeleteConfirm(null)
        setTimeout(() => {
          router.refresh()
          onDeleteSuccess?.()
        }, 500)
      } else {
        setDeleteConfirm({ mode: 'single', plan: deleteConfirm.plan, isLoading: false })
        alert('Gagal menghapus: ' + result.message)
      }
    } else if (deleteConfirm.mode === 'bulk') {
      // Bulk delete
      const plansToDelete = processedPlans.filter((plan) =>
        selectedRows.has(getPlanKey(plan))
      )

      let successCount = 0
      for (const plan of plansToDelete) {
        const result = await deleteVideoPlan(
          channelName,
          plan.judul_film,
          plan.tanggal_upload
        )
        if (result.status === 'success') {
          successCount++
        }
      }

      if (successCount === plansToDelete.length) {
        setDeleteConfirm(null)
        setSelectedRows(new Set())
        setTimeout(() => {
          router.refresh()
          onDeleteSuccess?.()
        }, 500)
      } else {
        setDeleteConfirm({ mode: 'bulk', isLoading: false })
        alert(`Berhasil menghapus ${successCount} dari ${plansToDelete.length} rencana.`)
      }
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

      {/* Sort Controls & Bulk Actions */}
      <div className="flex items-center gap-3 flex-wrap">
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

        {isSomeSelected && (
          <button
            onClick={() => setDeleteConfirm({ mode: 'bulk' })}
            className="ml-auto text-sm px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors font-medium"
          >
            Hapus {selectedRows.size} rencana
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="w-4 h-4 cursor-pointer"
                />
              </th>
              <th className="px-3 py-2 font-semibold text-slate-700">judul_video</th>
              <th className="px-3 py-2 font-semibold text-slate-700">judul_film</th>
              <th className="px-3 py-2 font-semibold text-slate-700">tanggal_upload</th>
              <th className="px-3 py-2 text-center font-semibold text-slate-700">aksi</th>
            </tr>
          </thead>
          <tbody>
            {processedPlans.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  {searchQuery
                    ? 'Tidak ada rencana yang cocok dengan pencarian.'
                    : 'Belum ada rencana video.'}
                </td>
              </tr>
            ) : (
              processedPlans.map((plan) => {
                const key = getPlanKey(plan)
                const isSelected = selectedRows.has(key)
                return (
                  <tr
                    key={key}
                    className={`border-b border-slate-100 ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(plan)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
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
                          disabled={isSelected}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ mode: 'single', plan })}
                          className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                          disabled={isSelected}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl bg-white p-6 shadow-lg max-w-sm">
            {deleteConfirm.mode === 'single' ? (
              <>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Hapus Rencana Video?
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Apakah Anda yakin ingin menghapus rencana video ini?
                </p>
                <div className="mb-4 space-y-1 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-slate-900">
                  <p>
                    <span className="font-semibold">Film:</span>{' '}
                    {deleteConfirm.plan?.judul_film}
                  </p>
                  <p>
                    <span className="font-semibold">Tanggal:</span>{' '}
                    {deleteConfirm.plan?.tanggal_upload ? formatDateToIndonesian(deleteConfirm.plan.tanggal_upload) : ''}
                  </p>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Hapus {selectedRows.size} Rencana Video?
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Apakah Anda yakin ingin menghapus {selectedRows.size} rencana video yang dipilih?
                </p>
              </>
            )}

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
