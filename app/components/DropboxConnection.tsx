'use client'

export function DropboxConnection({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Dropbox Connection</h2>
          <p className="mt-1 text-sm text-slate-600">
            {isConnected
              ? '✅ Dropbox terhubung - Siap untuk remote upload'
              : '⚠️ Dropbox belum terhubung'}
          </p>
        </div>
        {!isConnected && (
          <a
            href="/api/auth/dropbox"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Connect Dropbox
          </a>
        )}
      </div>
    </div>
  )
}
