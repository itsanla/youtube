'use client'

import type { YouTubeChannelInfo } from '@/lib/youtube-channel'

interface YouTubeConnectionProps {
  isConnected: boolean
  channelInfo?: YouTubeChannelInfo | null
}

export function YouTubeConnection({ isConnected, channelInfo }: YouTubeConnectionProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">Koneksi YouTube</h2>
      
      {isConnected ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-slate-700">Akun YouTube terhubung</span>
          </div>
          
          {channelInfo && (
            <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              {channelInfo.thumbnailUrl && (
                <img
                  src={channelInfo.thumbnailUrl}
                  alt={channelInfo.title}
                  className="h-12 w-12 rounded-full"
                />
              )}
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{channelInfo.title}</p>
                {channelInfo.customUrl && (
                  <p className="text-sm text-slate-600">{channelInfo.customUrl}</p>
                )}
                {channelInfo.subscriberCount && (
                  <p className="text-xs text-slate-500">
                    {parseInt(channelInfo.subscriberCount).toLocaleString('id-ID')} subscribers
                  </p>
                )}
              </div>
              <a
                href={`https://www.youtube.com/channel/${channelInfo.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Lihat Channel
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-red-500"></div>
            <span className="text-sm text-slate-700">Belum terhubung</span>
          </div>
          <a
            href="/api/auth/youtube"
            className="inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Hubungkan YouTube
          </a>
        </div>
      )}
    </div>
  )
}
