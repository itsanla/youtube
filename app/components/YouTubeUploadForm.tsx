'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { OneDrivePicker } from './OneDrivePicker'

const WORKER_URL = 'https://youtube-upload-worker.anlaharpanda.workers.dev'

interface OneDriveFile {
  id: string
  name: string
  size: number
  downloadUrl?: string
}

interface YouTubeUploadFormProps {
  youtubeAccounts: Array<{
    id: string
    title: string
  }>
}

interface YouTubePlaylist {
  id: string
  title: string
  itemCount: number
}

export function YouTubeUploadForm({ youtubeAccounts }: YouTubeUploadFormProps) {
  const searchParams = useSearchParams()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<{ success: boolean; message: string; url?: string } | null>(null)
  const [videoFile, setVideoFile] = useState<File | OneDriveFile | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | OneDriveFile | null>(null)
  const [subtitleFileId, setSubtitleFileId] = useState<File | null>(null)
  const [subtitleFileEn, setSubtitleFileEn] = useState<File | null>(null)
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([])
  const [loadingPlaylists, setLoadingPlaylists] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState(youtubeAccounts[0]?.id ?? '')
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (youtubeAccounts.length === 0) {
      setSelectedAccountId('')
      return
    }

    const accountFromQuery = searchParams.get('ytAccount')
    if (accountFromQuery) {
      const matchedAccount = youtubeAccounts.find(
        (account) => account.id === accountFromQuery
      )

      if (matchedAccount) {
        setSelectedAccountId(matchedAccount.id)
        return
      }
    }

    if (!selectedAccountId || !youtubeAccounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(youtubeAccounts[0].id)
    }
  }, [youtubeAccounts, searchParams, selectedAccountId])

  const selectedAccount =
    youtubeAccounts.find((account) => account.id === selectedAccountId) || null

  useEffect(() => {
    if (!selectedAccountId) {
      setPlaylists([])
      return
    }

    let cancelled = false

    const loadPlaylists = async () => {
      setLoadingPlaylists(true)
      try {
        const response = await fetch(
          `/api/youtube/playlists?accountId=${encodeURIComponent(selectedAccountId)}`
        )

        if (!response.ok) {
          if (!cancelled) {
            setPlaylists([])
          }
          return
        }

        const data = await response.json()
        if (!cancelled) {
          setPlaylists(Array.isArray(data.playlists) ? data.playlists : [])
        }
      } catch {
        if (!cancelled) {
          setPlaylists([])
        }
      } finally {
        if (!cancelled) {
          setLoadingPlaylists(false)
        }
      }
    }

    void loadPlaylists()

    return () => {
      cancelled = true
    }
  }, [selectedAccountId])

  async function uploadSubtitleTrack(
    videoId: string,
    subtitleFile: File,
    subtitleLanguage: 'id' | 'en',
    subtitleName: string
  ): Promise<boolean> {
    const subtitleFormData = new FormData()
    subtitleFormData.append('accountId', selectedAccountId)
    subtitleFormData.append('videoId', videoId)
    subtitleFormData.append('subtitle', subtitleFile)
    subtitleFormData.append('subtitleLanguage', subtitleLanguage)
    subtitleFormData.append('subtitleName', subtitleName)

    const subtitleRes = await fetch('/api/youtube/upload-subtitle', {
      method: 'POST',
      body: subtitleFormData,
    })

    return subtitleRes.ok
  }

  async function applyPostUploadSettings(
    videoId: string,
    playlistId: string,
    titleId: string,
    descriptionId: string,
    titleEn: string,
    descriptionEn: string
  ): Promise<string | null> {
    const warnings: string[] = []

    const localizationRes = await fetch('/api/youtube/update-localizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: selectedAccountId,
        videoId,
        titleId,
        descriptionId,
        titleEn,
        descriptionEn,
      }),
    })

    if (!localizationRes.ok) {
      warnings.push('gagal set lokalisasi judul/deskripsi')
    }

    if (playlistId) {
      const playlistRes = await fetch('/api/youtube/add-to-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          videoId,
          playlistId,
        }),
      })

      if (!playlistRes.ok) {
        warnings.push('gagal menambahkan ke playlist')
      }
    }

    if (subtitleFileId) {
      const ok = await uploadSubtitleTrack(
        videoId,
        subtitleFileId,
        'id',
        'Subtitle Indonesia'
      )

      if (!ok) {
        warnings.push('gagal upload subtitle Indonesia')
      }
    }

    if (subtitleFileEn) {
      const ok = await uploadSubtitleTrack(
        videoId,
        subtitleFileEn,
        'en',
        'English Subtitle'
      )

      if (!ok) {
        warnings.push('gagal upload subtitle Inggris')
      }
    }

    return warnings.length > 0 ? warnings.join(' dan ') : null
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formElement = e.currentTarget
    setUploading(true)
    setUploadProgress(0)
    setResult(null)

    if (!videoFile) {
      setResult({ success: false, message: 'Pilih video terlebih dahulu' })
      setUploading(false)
      return
    }

    if (!selectedAccountId) {
      setResult({ success: false, message: 'Akun YouTube tujuan upload tidak ditemukan' })
      setUploading(false)
      return
    }

    try {
      const tokenResponse = await fetch(
        `/api/youtube/get-token?accountId=${encodeURIComponent(selectedAccountId)}`
      )
      if (!tokenResponse.ok) {
        throw new Error('YouTube belum terhubung')
      }
      const { accessToken } = await tokenResponse.json()

      const formData = new FormData(formElement)
      const titleId = ((formData.get('titleId') as string) || '').trim()
      const descriptionId = ((formData.get('descriptionId') as string) || '').trim()
      const titleEn = ((formData.get('titleEn') as string) || '').trim()
      const descriptionEn = ((formData.get('descriptionEn') as string) || '').trim()
      const privacyStatus = formData.get('privacyStatus') as string
      const playlistId = (formData.get('playlistId') as string) || ''

      if (!titleId || !titleEn) {
        setResult({ success: false, message: 'Judul Indonesia dan Inggris wajib diisi' })
        setUploading(false)
        return
      }

      // Cek apakah video dari local atau OneDrive
      const isLocalVideo = videoFile instanceof File
      const isLocalThumbnail = thumbnailFile instanceof File

      if (isLocalVideo) {
        // Upload dari local
        const uploadFormData = new FormData()
        uploadFormData.append('video', videoFile)
        uploadFormData.append('title', titleId)
        uploadFormData.append('description', descriptionId)
        uploadFormData.append('privacyStatus', privacyStatus)
        uploadFormData.append('channelName', selectedAccount?.title || selectedAccountId)
        uploadFormData.append('defaultLanguage', 'id')
        uploadFormData.append('defaultAudioLanguage', 'id')
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
          const postUploadWarning = response.data.videoId
            ? await applyPostUploadSettings(
                response.data.videoId,
                playlistId,
                titleId,
                descriptionId,
                titleEn,
                descriptionEn
              )
            : null

          setResult({
            success: true,
            message: postUploadWarning
              ? `Video berhasil diupload ke channel ${selectedAccount?.title || selectedAccountId}, tapi ${postUploadWarning}.`
              : `Video berhasil diupload ke channel ${selectedAccount?.title || selectedAccountId}!`,
            url: response.data.url,
          })
          formRef.current?.reset()
          setVideoFile(null)
          setThumbnailFile(null)
          setSubtitleFileId(null)
          setSubtitleFileEn(null)
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
            title: titleId,
            description: descriptionId,
            privacyStatus,
            channelName: selectedAccount?.title || selectedAccountId,
            defaultLanguage: 'id',
            defaultAudioLanguage: 'id',
            videoSource: 'onedrive',
            videoUrl: videoOneDrive.downloadUrl,
            thumbnailSource: thumbnailOneDrive ? 'onedrive' : undefined,
            thumbnailUrl: thumbnailOneDrive?.downloadUrl,
            accessToken,
          }),
        })

        const data = await response.json()

        if (response.ok) {
          const postUploadWarning = data.videoId
            ? await applyPostUploadSettings(
                data.videoId,
                playlistId,
                titleId,
                descriptionId,
                titleEn,
                descriptionEn
              )
            : null

          setResult({
            success: true,
            message: postUploadWarning
              ? `Video berhasil diupload ke channel ${selectedAccount?.title || selectedAccountId}, tapi ${postUploadWarning}.`
              : `Video berhasil diupload ke channel ${selectedAccount?.title || selectedAccountId}!`,
            url: data.url,
          })
          formRef.current?.reset()
          setVideoFile(null)
          setThumbnailFile(null)
          setSubtitleFileId(null)
          setSubtitleFileEn(null)
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
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.12em] text-blue-700">Akun YouTube Terpilih</p>
          <p className="mt-1 text-sm font-semibold text-blue-900">
            {selectedAccount?.title || selectedAccountId}
          </p>
        </div>

        <div>
          <label htmlFor="titleId" className="block text-sm font-medium text-slate-700">
            Judul Video (Indonesia) *
          </label>
          <input
            type="text"
            id="titleId"
            name="titleId"
            required
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="descriptionId" className="block text-sm font-medium text-slate-700">
            Deskripsi (Indonesia)
          </label>
          <textarea
            id="descriptionId"
            name="descriptionId"
            rows={4}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="titleEn" className="block text-sm font-medium text-slate-700">
            Judul Video (English) *
          </label>
          <input
            type="text"
            id="titleEn"
            name="titleEn"
            required
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="descriptionEn" className="block text-sm font-medium text-slate-700">
            Deskripsi (English)
          </label>
          <textarea
            id="descriptionEn"
            name="descriptionEn"
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
          <label htmlFor="playlistId" className="block text-sm font-medium text-slate-700">
            Playlist (Opsional)
          </label>
          <select
            id="playlistId"
            name="playlistId"
            defaultValue=""
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tanpa Playlist</option>
            {playlists.map((playlist) => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.title} ({playlist.itemCount} video)
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {loadingPlaylists
              ? 'Memuat playlist akun YouTube...'
              : 'Jika dipilih, video akan otomatis ditambahkan ke playlist ini.'}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Bahasa Default Video</p>
          <p className="mt-1 text-sm font-medium text-slate-700">
            Indonesia (otomatis) + Lokalisasi English
          </p>
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Subtitle Indonesia (Opsional, .srt/.vtt)
            </label>
            <input
              type="file"
              accept=".srt,.vtt,text/vtt,application/x-subrip"
              onChange={(e) => {
                const file = e.target.files?.[0]
                setSubtitleFileId(file || null)
              }}
              className="block w-full text-sm text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-amber-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-amber-700 hover:file:bg-amber-100"
            />
            {subtitleFileId && (
              <p className="mt-2 text-sm text-green-600">✓ {subtitleFileId.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Subtitle English (Opsional, .srt/.vtt)
            </label>
            <input
              type="file"
              accept=".srt,.vtt,text/vtt,application/x-subrip"
              onChange={(e) => {
                const file = e.target.files?.[0]
                setSubtitleFileEn(file || null)
              }}
              className="block w-full text-sm text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            {subtitleFileEn && (
              <p className="mt-2 text-sm text-green-600">✓ {subtitleFileEn.name}</p>
            )}
          </div>
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
