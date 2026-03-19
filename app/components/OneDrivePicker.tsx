'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface OneDriveFile {
  id: string
  name: string
  size: number
  downloadUrl?: string
  modifiedDate?: string
}

interface OneDrivePickerProps {
  onSelect: (file: OneDriveFile) => void
  accept?: 'video' | 'image'
  label: string
}

export function OneDrivePicker({ onSelect, accept = 'video', label }: OneDrivePickerProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<OneDriveFile[]>([])
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [selectedFile, setSelectedFile] = useState<OneDriveFile | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const observerTarget = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkConnection()
  }, [])

  async function checkConnection() {
    try {
      const response = await fetch('/api/onedrive/check-connection')
      const data = await response.json()
      setIsConnected(data.connected)
    } catch {
      setIsConnected(false)
    }
  }

  async function loadFiles(reset = false) {
    setLoading(true)
    if (reset) {
      setShowFilePicker(true)
      setOffset(0)
      setFiles([])
    }
    
    try {
      const currentOffset = reset ? 0 : offset
      const url = `/api/onedrive/search-files?type=${accept}&limit=15&offset=${currentOffset}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`
      const response = await fetch(url)
      const data = await response.json()
      
      if (response.ok) {
        if (reset) {
          setFiles(data.files)
        } else {
          setFiles(prev => [...prev, ...data.files])
        }
        setHasMore(data.hasMore)
        setOffset(currentOffset + data.files.length)
      }
    } catch (error) {
      console.error('Load files error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Lazy load observer
  useEffect(() => {
    if (!showFilePicker || !hasMore || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadFiles(false)
        }
      },
      { threshold: 0.1 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [showFilePicker, hasMore, loading, offset])

  // Search debounce
  useEffect(() => {
    if (!showFilePicker) return
    
    const timer = setTimeout(() => {
      loadFiles(true)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  async function selectFile(file: OneDriveFile) {
    setLoading(true)
    
    try {
      // Get download URL
      const response = await fetch('/api/onedrive/get-download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: file.id }),
      })

      const data = await response.json()

      const selectedFile: OneDriveFile = {
        ...file,
        downloadUrl: data.downloadUrl,
      }

      setSelectedFile(selectedFile)
      onSelect(selectedFile)
      setShowFilePicker(false)
    } catch (error) {
      console.error('Select file error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs text-slate-600 mb-2">OneDrive belum terhubung</p>
        <a
          href="/api/onedrive/auth"
          className="inline-block rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          Hubungkan
        </a>
      </div>
    )
  }

  return (
    <div>
      {selectedFile ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-2">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-green-900 truncate">{selectedFile.name}</p>
              <p className="text-xs text-green-700">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null)
                setSearchQuery('')
                loadFiles(true)
              }}
              className="ml-2 text-xs text-blue-600 hover:underline flex-shrink-0"
            >
              Ganti
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => loadFiles(true)}
          disabled={loading}
          className="w-full rounded-lg border-2 border-dashed border-slate-300 bg-white px-3 py-4 text-center hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
        >
          {loading ? (
            <span className="text-xs text-slate-600">Loading...</span>
          ) : (
            <>
              <svg
                className="mx-auto h-8 w-8 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="mt-1 text-xs font-medium text-slate-700">
                Pilih dari OneDrive
              </p>
            </>
          )}
        </button>
      )}

      {/* File Picker Modal */}
      {showFilePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="text-lg font-bold text-slate-900">
                Pilih {accept === 'video' ? 'Video' : 'Gambar'} dari OneDrive
              </h3>
              <button
                onClick={() => {
                  setShowFilePicker(false)
                  setSearchQuery('')
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b">
              <input
                type="text"
                placeholder="Cari file..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading && files.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-600">Loading files...</p>
              ) : files.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-600">
                  Tidak ada file {accept === 'video' ? 'video' : 'gambar'} ditemukan
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    {files.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => selectFile(file)}
                        disabled={loading}
                        className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                        <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                          <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          {file.modifiedDate && (
                            <span>{new Date(file.modifiedDate).toLocaleDateString('id-ID')}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Lazy Load Trigger */}
                  {hasMore && (
                    <div ref={observerTarget} className="py-4 text-center">
                      {loading ? (
                        <span className="text-sm text-slate-600">Loading more...</span>
                      ) : (
                        <span className="text-sm text-slate-400">Scroll untuk load lebih banyak</span>
                      )}
                    </div>
                  )}

                  {!hasMore && files.length > 0 && (
                    <p className="py-4 text-center text-xs text-slate-400">
                      Semua file sudah ditampilkan ({files.length} file)
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
