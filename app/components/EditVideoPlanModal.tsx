'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { updateVideoPlan } from '@/app/actions/channel-actions'
import { VideoPlan } from '@/lib/youtube-types'

interface EditVideoPlanModalProps {
  channelName: string
  plan: VideoPlan
  onClose: () => void
  onSuccess?: () => void
}

export function EditVideoPlanModal({
  channelName,
  plan,
  onClose,
  onSuccess,
}: EditVideoPlanModalProps) {
  const router = useRouter()

  const [state, formAction, isPending] = useActionState(
    async (prevState: { status: 'idle' | 'success' | 'error'; message: string }, formData: FormData) => {
      const newJudulVideo = formData.get('judul_video') as string
      const newJudulFilm = formData.get('judul_film') as string
      const newTanggalUpload = formData.get('tanggal_upload') as string

      return await updateVideoPlan(
        channelName,
        plan.judul_film,
        plan.tanggal_upload,
        newJudulVideo,
        newJudulFilm !== plan.judul_film ? newJudulFilm : undefined,
        newTanggalUpload !== plan.tanggal_upload ? newTanggalUpload : undefined
      )
    },
    { status: 'idle' as const, message: '' }
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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-lg">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Edit Rencana Video</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="judul_video"
              className="block text-sm font-medium text-slate-700 mb-2"
            >
              Judul Video
            </label>
            <input
              type="text"
              id="judul_video"
              name="judul_video"
              defaultValue={plan.judul_video}
              disabled={isPending}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
              placeholder="Contoh: Review Inception - Cara Nolan Jebak Otak Kita"
            />
          </div>

          <div>
            <label
              htmlFor="judul_film"
              className="block text-sm font-medium text-slate-700 mb-2"
            >
              Judul Film
            </label>
            <input
              type="text"
              id="judul_film"
              name="judul_film"
              defaultValue={plan.judul_film}
              disabled={isPending}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
              placeholder="Contoh: Inception"
            />
          </div>

          <div>
            <label
              htmlFor="tanggal_upload"
              className="block text-sm font-medium text-slate-700 mb-2"
            >
              Tanggal Upload
            </label>
            <input
              type="date"
              id="tanggal_upload"
              name="tanggal_upload"
              defaultValue={plan.tanggal_upload}
              disabled={isPending}
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
              disabled={isPending}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending || state.status === 'success'}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
            >
              {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
