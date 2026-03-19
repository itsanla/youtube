'use client'

import { useState, useRef } from 'react'
import { OneDrivePicker } from './OneDrivePicker'

const WORKER_URL = 'https://youtube-upload-worker.anlaharpanda.workers.dev'

interface OneDriveFile {
  id: string
  name: string
  size: number
  downloadUrl?: string
}

export function YouTubeUploadForm() {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<{ success: boolean; message: string; url?: string } | null>(null)
  const [videoFile, setVideoFile] = useState<File | OneDriveFile | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | OneDriveFile | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploading(true)
    setUploadProgress(0)
    setResult(null)

    if (!videoFile) {
      setResult({ success: false, message: 'Pilih video terlebih dahulu' })
      setUploading(false)
      return
    }

    try {
      const tokenResponse = await fetch('/api/youtube/get-token')
      if (!tokenResponse.ok) {
        throw new Error('YouTube belum terhubung')
      }
      const { accessToken } = await tokenResponse.json()

      const formData = new FormData(e.currentTarget)
      const title = formData.get('title') as string
      const description = formData.get('description') as string
      const privacyStatus = formData.get('privacyStatus') as string

      // Cek apakah video dari local atau OneDrive
      const isLocalVideo = videoFile instanceof File
      const isLocalThumbnail = thumbnailFile instanceof File

      if (isLocalVideo) {
        // Upload dari local
        const uploadFormData = new FormData()
        uploadFormData.append('video', videoFile)
        uploadFormData.append('title', title)
        uploadFormData.append('description', description)
        uploadFormData.append('privacyStatus', privacyStatus)
        uploadFormData.append('accessToken', accessToken)
        
        if (thumbnailFile && isLocalThumbnail) {
          uploadFormData.append('thumbnail', thumbnailFile)
        }

        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100)
            setUploadProgress(percentComplete)
          }
        })

        const response = await new Promise<{ ok: boolean; data: any }>((resolve, reject) => {
          xhr.addEventListener('load', () => {
            try {
              const data = JSON.parse(xhr.responseText)
              resolve({ ok: xhr.status === 200, data })
            } catch {
              reject(new Error('Invalid response'))
            }
          })

          xhr.addEventListener('error', () => reject(new Error('Network error')))
          xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))

          xhr.open('POST', `${WORKER_URL}/upload-video`)
          xhr.send(uploadFormData)
        })

        if (response.ok) {
          setResult({
            success: true,
            message: 'Video berhasil diupload!',
            url: response.data.url,
          })
          formRef.current?.reset()
          setVideoFile(null)
          setThumbnailFile(null)
          setUploadProgress(0)
        } else {
          setResult({
            success: false,
            message: response.data.error || 'Upload gagal',
          })
        }
      } else {
        // Upload dari OneDrive
        const videoOneDrive = videoFile as OneDriveFile
        const thumbnailOneDrive = thumbnailFile as OneDriveFile | null

        const response = await fetch(`${WORKER_URL}/upload-video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            privacyStatus,
            videoSource: 'onedrive',
            videoUrl: videoOneDrive.downloadUrl,
            thumbnailSource: thumbnailOneDrive ? 'onedrive' : undefined,
            thumbnailUrl: thumbnailOneDrive?.downloadUrl,
            accessToken,
          }),
        })

        const data = await response.json()

        if (response.ok) {
          setResult({
            success: true,
            message: 'Video berhasil diupload!',
            url: data.url,
          })
          formRef.current?.reset()
          setVideoFile(null)
          setThumbnailFile(null)
        } else {
          setResult({
            success: false,
            message: data.error || 'Upload gagal',
          })
        }
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Terjadi kesalahan',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">Upload Video ke YouTube</h2>
      
      <form ref={formRef} onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-slate-700">
            Judul Video *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            required
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700">
            Deskripsi
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="privacyStatus" className="block text-sm font-medium text-slate-700">
            Privacy Status
          </label>
          <select
            id="privacyStatus"
            name="privacyStatus"
            defaultValue="private"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Video *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Dari Local</label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setVideoFile(file)
                }}
                className="block w-full text-sm text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Dari OneDrive</label>
              <OneDrivePicker
                accept="video"
                label=""
                onSelect={(file) => setVideoFile(file)}
              />
            </div>
          </div>
          {videoFile && (
            <p className="mt-2 text-sm text-green-600">
              ✓ {videoFile instanceof File ? videoFile.name : (videoFile as OneDriveFile).name}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Thumbnail (Opsional)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Dari Local</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setThumbnailFile(file)
                }}
                className="block w-full text-sm text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-green-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-green-700 hover:file:bg-green-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Dari OneDrive</label>
              <OneDrivePicker
                accept="image"
                label=""
                onSelect={(file) => setThumbnailFile(file)}
              />
            </div>
          </div>
          {thumbnailFile && (
            <p className="mt-2 text-sm text-green-600">
              ✓ {thumbnailFile instanceof File ? thumbnailFile.name : (thumbnailFile as OneDriveFile).name}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {uploading ? `Uploading... ${uploadProgress}%` : 'Upload Video'}
        </button>

        {uploading && (
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </form>

      {result && (
        <div
          className={`mt-4 rounded-lg p-4 text-sm ${
            result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          <p className="font-medium">{result.message}</p>
          {result.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-blue-600 underline"
            >
              Lihat Video
            </a>
          )}
        </div>
      )}
    </div>
  )
}
