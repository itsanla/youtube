'use client'

import { useState, useRef } from 'react'

interface UploadResult {
  success: boolean
  message: string
  file?: {
    id: string
    name: string
    size: number
    webUrl: string
    directUrl?: string
  }
}

export function RemoteUploadForm() {
  const [uploading, setUploading] = useState(false)
  const [loadingFilename, setLoadingFilename] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [uploadHistory, setUploadHistory] = useState<UploadResult[]>([])
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploading(true)
    setResult(null)

    const formData = new FormData(e.currentTarget)
    const url = formData.get('url') as string
    const fileName = formData.get('fileName') as string
    const folder = formData.get('folder') as string

    try {
      // Upload via Dropbox API (token diambil dari Redis di server-side)
      const response = await fetch('/api/dropbox/remote-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          fileName,
          folder: folder || undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        const successResult: UploadResult = {
          success: true,
          message: 'File berhasil diupload ke OneDrive!',
          file: data.file,
        }
        setResult(successResult)
        setUploadHistory(prev => [successResult, ...prev].slice(0, 5))
        formRef.current?.reset()
      } else {
        setResult({
          success: false,
          message: data.error || 'Upload gagal',
        })
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

  async function autoFillFileName(url: string) {
    if (!url) return

    setLoadingFilename(true)
    try {
      // Call server-side API untuk dapat filename
      const response = await fetch('/api/get-filename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (response.ok) {
        const { fileName } = await response.json()
        
        if (fileName && formRef.current) {
          const fileNameInput = formRef.current.querySelector<HTMLInputElement>('input[name="fileName"]')
          if (fileNameInput) {
            fileNameInput.value = fileName
          }
        }
      }
    } catch (error) {
      console.log('Failed to get filename:', error)
      // Fallback ke filename dari URL
      try {
        const urlObj = new URL(url)
        const fileName = urlObj.pathname.split('/').pop() || ''
        if (fileName && formRef.current) {
          const fileNameInput = formRef.current.querySelector<HTMLInputElement>('input[name="fileName"]')
          if (fileNameInput) {
            fileNameInput.value = decodeURIComponent(fileName)
          }
        }
      } catch {}
    } finally {
      setLoadingFilename(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Upload File dari URL ke Dropbox</h2>
        <p className="mt-1 text-sm text-slate-600">
          Server-to-server upload: Dropbox akan download langsung dari URL tanpa menyentuh storage lokal
        </p>

        <form ref={formRef} onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-slate-700">
              URL Download *
            </label>
            <input
              type="url"
              id="url"
              name="url"
              required
              placeholder="https://example.com/file.mp4"
              onBlur={(e) => autoFillFileName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Paste link download langsung (direct download link). Nama file akan otomatis terdeteksi.
            </p>
          </div>

          <div>
            <label htmlFor="fileName" className="block text-sm font-medium text-slate-700">
              Nama File *
            </label>
            <div className="relative">
              <input
                type="text"
                id="fileName"
                name="fileName"
                required
                placeholder="Otomatis terisi dari URL"
                disabled={loadingFilename}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-wait"
              />
              {loadingFilename && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {loadingFilename ? 'Mendeteksi nama file...' : 'Nama file otomatis terisi dari URL. Edit jika ingin ubah nama.'}
            </p>
          </div>

          <div>
            <label htmlFor="folder" className="block text-sm font-medium text-slate-700">
              Folder Tujuan (Opsional)
            </label>
            <input
              type="text"
              id="folder"
              name="folder"
              placeholder="Videos"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Kosongkan untuk upload ke root Dropbox. Contoh: Videos, Assets/Media
            </p>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading to Dropbox...' : 'Upload ke Dropbox'}
          </button>
        </form>

        {result && (
          <div
            className={`mt-4 rounded-lg p-4 text-sm ${
              result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            <p className="font-medium">{result.message}</p>
            {result.file && (
              <div className="mt-2 space-y-1 text-xs">
                <p>📁 {result.file.name}</p>
                <p>📊 {(result.file.size / 1024 / 1024).toFixed(2)} MB</p>
                <a
                  href={result.file.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-blue-600 underline hover:text-blue-800"
                >
                  Buka di OneDrive →
                </a>
                {result.file.directUrl && (
                  <div className="mt-2 rounded bg-slate-100 p-2">
                    <p className="font-medium text-slate-700">Direct URL untuk ClipChamp:</p>
                    <input
                      type="text"
                      readOnly
                      value={result.file.directUrl}
                      onClick={(e) => e.currentTarget.select()}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(result.file!.directUrl!)
                        alert('URL copied!')
                      }}
                      className="mt-1 text-xs text-blue-600 hover:underline"
                    >
                      📋 Copy URL
                    </button>
                    <div className="mt-2 rounded bg-green-50 border border-green-200 p-2">
                      <p className="text-xs text-green-800">
                        ✅ <strong>Dropbox URL siap untuk ClipChamp!</strong> Tidak perlu konversi codec.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload History */}
      {uploadHistory.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Riwayat Upload</h2>
          <div className="mt-4 space-y-2">
            {uploadHistory.map((item, index) => (
              <div
                key={index}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {item.file?.name || 'Unknown'}
                    </p>
                    {item.file && (
                      <p className="text-xs text-slate-600">
                        {(item.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                  {item.file && (
                    <a
                      href={item.file.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Buka
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
