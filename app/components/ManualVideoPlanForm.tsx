'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { createVideoPlan } from '@/app/actions/channel-actions'
import type { ChannelActionState } from '@/lib/youtube-types'

interface ManualVideoPlanFormProps {
  channelName: string
  onSuccess?: () => void
  onClose: () => void
}

const initialState: ChannelActionState = {
  status: 'idle',
  message: '',
}

export function ManualVideoPlanForm({
  channelName,
  onSuccess,
  onClose,
}: ManualVideoPlanFormProps) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    async (prevState: ChannelActionState, formData: FormData) => {
      const judulVideo = formData.get('judul_video') as string
      const judulFilm = formData.get('judul_film') as string
      const tanggalUpload = formData.get('tanggal_upload') as string

      if (!judulFilm.trim()) {
        return {
          status: 'error' as const,
          message: 'Judul film tidak boleh kosong',
        }
      }

      if (!tanggalUpload) {
        return {
          status: 'error' as const,
          message: 'Tanggal upload harus dipilih',
        }
      }

      return await createVideoPlan(
        channelName,
        judulVideo.trim(),
        judulFilm.trim(),
        tanggalUpload
      )
    },
    initialState
  )

  useEffect(() => {
    if (state.status === 'success') {
      const timer = setTimeout(() => {
        router.refresh()
        if (onSuccess) onSuccess()
        onClose()
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [state.status, onSuccess, onClose, router])

  return (
    <div className="w-full space-y-5">
      <h2 className="text-lg font-semibold text-slate-900">Input Data Rencana Video</h2>
      <p className="text-sm text-slate-600">
        Tambahkan rencana video dengan mengisi form di bawah ini.
      </p>

      <form action={formAction} className="space-y-4">
        <div>
          <label
            htmlFor="judul_film"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Judul Film <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="judul_film"
            name="judul_film"
            required
            disabled={pending}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
            placeholder="Contoh: The Matrix"
          />
        </div>

        <div>
          <label
            htmlFor="judul_video"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Judul Video (Opsional)
          </label>
          <input
            type="text"
            id="judul_video"
            name="judul_video"
            disabled={pending}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
            placeholder="Contoh: Review The Matrix - Fakta Menarik"
          />
        </div>

        <div>
          <label
            htmlFor="tanggal_upload"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Tanggal Upload <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="tanggal_upload"
            name="tanggal_upload"
            required
            disabled={pending}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
          />
        </div>

        {/* Status Messages */}
        {state.status === 'error' && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {state.message}
          </div>
        )}

        {state.status === 'success' && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 border border-green-200">
            ✓ {state.message}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={pending || state.status === 'success'}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
          >
            {pending ? 'Menyimpan...' : 'Simpan Rencana'}
          </button>
        </div>
      </form>
    </div>
  )
}
