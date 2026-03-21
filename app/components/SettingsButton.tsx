'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ConnectionStatus {
  youtube: boolean
  youtubeCount: number
  onedrive: boolean
  dropbox: boolean
}

export function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [connections, setConnections] = useState<ConnectionStatus>({
    youtube: false,
    youtubeCount: 0,
    onedrive: false,
    dropbox: false,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      checkConnections()
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const checkConnections = async () => {
    setLoading(true)
    try {
      const [youtubeRes, onedriveRes, dropboxRes] = await Promise.all([
        fetch('/api/youtube/check-connection'),
        fetch('/api/onedrive/check-connection'),
        fetch('/api/dropbox/check-connection'),
      ])

      const [youtube, onedrive, dropbox] = await Promise.all([
        youtubeRes.json(),
        onedriveRes.json(),
        dropboxRes.json(),
      ])

      setConnections({
        youtube: youtube.connected || false,
        youtubeCount: youtube.count || 0,
        onedrive: onedrive.connected || false,
        dropbox: dropbox.connected || false,
      })
    } catch (error) {
      console.error('Failed to check connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = (service: 'youtube' | 'onedrive' | 'dropbox') => {
    const urls = {
      youtube: '/api/auth/youtube',
      onedrive: '/api/onedrive/auth',
      dropbox: '/api/auth/dropbox',
    }
    window.location.href = urls[service]
  }

  const handleDisconnect = async (service: 'youtube' | 'onedrive' | 'dropbox') => {
    if (!confirm(`Yakin ingin disconnect ${service.toUpperCase()}?`)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/${service}/disconnect`, { method: 'POST' })
      if (res.ok) {
        await checkConnections()
        alert(`${service.toUpperCase()} berhasil di-disconnect`)
      } else {
        alert(`Gagal disconnect ${service.toUpperCase()}`)
      }
    } catch (error) {
      console.error('Disconnect error:', error)
      alert(`Error disconnect ${service.toUpperCase()}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-6 right-6 z-50 flex-shrink-0 rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors shadow-lg"
        title="Settings"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {isMounted &&
        isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label="Close settings"
              onClick={() => setIsOpen(false)}
            />
            <div
              className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-600">Kelola koneksi layanan pihak ketiga</p>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* YouTube */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                        <span className="text-xl">▶️</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">YouTube</p>
                        <p className="text-xs text-slate-500">
                          {connections.youtube
                            ? `${connections.youtubeCount} akun terhubung`
                            : 'Tidak terhubung'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleConnect('youtube')}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        {connections.youtube ? 'Add Account' : 'Connect'}
                      </button>

                      {connections.youtube && (
                        <button
                          onClick={() => handleDisconnect('youtube')}
                          className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
                        >
                          Disconnect All
                        </button>
                      )}
                    </div>
                  </div>

                  {/* OneDrive */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                        <span className="text-xl">☁️</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">OneDrive</p>
                        <p className="text-xs text-slate-500">
                          {connections.onedrive ? 'Terhubung' : 'Tidak terhubung'}
                        </p>
                      </div>
                    </div>
                    {connections.onedrive ? (
                      <button
                        onClick={() => handleDisconnect('onedrive')}
                        className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect('onedrive')}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Connect
                      </button>
                    )}
                  </div>

                  {/* Dropbox */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                        <span className="text-xl">📦</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">Dropbox</p>
                        <p className="text-xs text-slate-500">
                          {connections.dropbox ? 'Terhubung' : 'Tidak terhubung'}
                        </p>
                      </div>
                    </div>
                    {connections.dropbox ? (
                      <button
                        onClick={() => handleDisconnect('dropbox')}
                        className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect('dropbox')}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>,
          document.body
        )}
    </>
  )
}
