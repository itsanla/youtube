import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const WORKER_UPLOAD_URL =
  process.env.YOUTUBE_UPLOAD_WORKER_URL ||
  'https://youtube-upload-worker.anlaharpanda.workers.dev/upload-video'

const MAX_ATTEMPTS = 3

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  let payload = ''

  try {
    payload = await request.text()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request payload' },
      { status: 400 }
    )
  }

  let lastNetworkError: unknown = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const workerResponse = await fetch(WORKER_UPLOAD_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload,
        cache: 'no-store',
      })

      const responseText = await workerResponse.text()
      const contentType = workerResponse.headers.get('content-type') || 'application/json'

      if ((workerResponse.status === 503 || workerResponse.status === 429) && attempt < MAX_ATTEMPTS) {
        await delay(600 * attempt)
        continue
      }

      return new NextResponse(responseText, {
        status: workerResponse.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-store',
        },
      })
    } catch (error) {
      lastNetworkError = error

      if (attempt < MAX_ATTEMPTS) {
        await delay(600 * attempt)
        continue
      }
    }
  }

  return NextResponse.json(
    {
      error: 'Upload worker unreachable after retries',
      debug: {
        stage: 'proxy_upload_worker',
        details: lastNetworkError instanceof Error ? lastNetworkError.message : 'Unknown network error',
      },
    },
    { status: 502 }
  )
}
