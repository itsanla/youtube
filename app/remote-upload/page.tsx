import { RemoteUploadForm } from '@/app/components/RemoteUploadForm'

export const metadata = {
  title: 'Remote Upload - OneDrive',
  description: 'Upload file dari URL langsung ke OneDrive',
}

export default function RemoteUploadPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white px-4 py-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">OneDrive Tools</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Remote Upload
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Upload file dari URL langsung ke OneDrive tanpa download ke local. Hemat kuota internet!
          </p>
        </header>

        <RemoteUploadForm />

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Cara Pakai</h2>
          <ol className="mt-4 space-y-2 text-sm text-slate-700">
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">1.</span>
              <span>Copy link download file (video, audio, gambar, dll)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">2.</span>
              <span>Paste di form di atas</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">3.</span>
              <span>Isi nama file dan folder tujuan (opsional)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">4.</span>
              <span>Klik Upload - File akan langsung masuk ke OneDrive</span>
            </li>
          </ol>

          <div className="mt-6 rounded-lg bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">💡 Tips:</p>
            <ul className="mt-2 space-y-1 text-sm text-blue-800">
              <li>• Support semua format: MP4, MP3, PNG, JPG, SVG, PDF, dll</li>
              <li>• File besar (&gt;4MB) otomatis pakai chunked upload</li>
              <li>• Tidak pakai kuota internet lokal kamu</li>
              <li>• Proses server-to-server (cepat!)</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
