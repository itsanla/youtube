/**
 * Cloudflare Worker untuk Upload YouTube
 * Support: Local file & OneDrive streaming
 */

interface Env {
  UPSTASH_REDIS_REST_URL: string
  UPSTASH_REDIS_REST_TOKEN: string
}

interface UploadRequest {
  title: string
  description?: string
  privacyStatus?: 'private' | 'public' | 'unlisted'
  categoryId?: string
  playlistId?: string
  defaultLanguage?: string
  defaultAudioLanguage?: string
  subtitleUrl?: string
  subtitleLanguage?: string
  subtitleName?: string
  videoSource: 'local' | 'onedrive'
  videoUrl?: string // OneDrive download URL
  thumbnailSource?: 'local' | 'onedrive'
  thumbnailUrl?: string
  accessToken: string // YouTube access token dari Redis
}

const CHUNK_SIZE = 10 * 1024 * 1024 // 10MB per chunk

function sanitizeVideoTitle(input: string): string {
  return input
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchWithRetry(url: string, attempts = 2): Promise<Response> {
  let lastError: unknown = null

  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, {
        method: 'GET',
        redirect: 'follow',
      })
    } catch (error) {
      lastError = error
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Network connection lost')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    if (request.method !== 'POST' && request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 })
    }

    const url = new URL(request.url)

    // Route: /upload-video
    if (url.pathname === '/upload-video') {
      return handleVideoUpload(request, env, corsHeaders)
    }

    // Route: /upload-thumbnail
    if (url.pathname === '/upload-thumbnail') {
      return handleThumbnailUpload(request, env, corsHeaders)
    }

    // Route: /upload-progress
    if (url.pathname === '/upload-progress') {
      return handleProgress(request, env, corsHeaders)
    }

    // Route: /remote-upload
    if (url.pathname === '/remote-upload') {
      return handleRemoteUpload(request, env, corsHeaders)
    }

    return new Response('Not found', { status: 404 })
  },
}

async function handleVideoUpload(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  let currentStage = 'init'
  try {
    const contentType = request.headers.get('content-type') || ''

    let uploadData: UploadRequest
    let videoStream: ReadableStream<Uint8Array>
    let videoSize = 0
    let subtitleBlob: Blob | null = null

    // Parse request berdasarkan source
    if (contentType.includes('multipart/form-data')) {
      currentStage = 'parse_multipart_form'
      // Upload dari local (FormData)
      const formData = await request.formData()
      const videoFile = formData.get('video')
      const title = formData.get('title')
      const description = formData.get('description')
      const privacyStatus = formData.get('privacyStatus')
      const playlistId = formData.get('playlistId')
      const defaultLanguage = formData.get('defaultLanguage')
      const defaultAudioLanguage = formData.get('defaultAudioLanguage')
      const subtitle = formData.get('subtitle')
      const subtitleLanguage = formData.get('subtitleLanguage')
      const subtitleName = formData.get('subtitleName')
      const accessToken = formData.get('accessToken')

      // Validate required string fields
      if (!title || typeof title !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Missing title' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const cleanedTitle = sanitizeVideoTitle(title)
      if (!cleanedTitle) {
        return new Response(
          JSON.stringify({ error: 'Video title tidak boleh kosong' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (cleanedTitle.length > 100) {
        return new Response(
          JSON.stringify({
            error: 'Video title terlalu panjang (maksimal 100 karakter)',
            debug: { titleLength: cleanedTitle.length },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!accessToken || typeof accessToken !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Missing access token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate video file (must be File, not string or null)
      if (!videoFile) {
        return new Response(
          JSON.stringify({ error: 'Missing video file' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (typeof videoFile === 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid video file' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // TypeScript now knows videoFile is File (not string or null)
      const video = videoFile as File
      videoStream = video.stream()
      videoSize = video.size

      uploadData = {
        title: cleanedTitle,
        description: typeof description === 'string' ? description : undefined,
        privacyStatus: (typeof privacyStatus === 'string' ? privacyStatus : 'private') as any,
        playlistId: typeof playlistId === 'string' ? playlistId : undefined,
        defaultLanguage: typeof defaultLanguage === 'string' ? defaultLanguage : 'id',
        defaultAudioLanguage:
          typeof defaultAudioLanguage === 'string' ? defaultAudioLanguage : 'id',
        subtitleLanguage: typeof subtitleLanguage === 'string' ? subtitleLanguage : 'id',
        subtitleName: typeof subtitleName === 'string' ? subtitleName : 'Subtitle Indonesia',
        videoSource: 'local',
        accessToken,
      }

      if (subtitle && typeof subtitle !== 'string') {
        subtitleBlob = subtitle as File
      }
    } else {
      currentStage = 'parse_json_payload'
      // Upload dari OneDrive (JSON)
      uploadData = await request.json() as UploadRequest

      if (!uploadData.videoUrl || !uploadData.title || !uploadData.accessToken) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const cleanedTitle = sanitizeVideoTitle(uploadData.title)
      if (!cleanedTitle) {
        return new Response(
          JSON.stringify({ error: 'Video title tidak boleh kosong' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (cleanedTitle.length > 100) {
        return new Response(
          JSON.stringify({
            error: 'Video title terlalu panjang (maksimal 100 karakter)',
            debug: { titleLength: cleanedTitle.length },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      uploadData.title = cleanedTitle

      currentStage = 'fetch_video_from_onedrive'
      // Fetch video dari OneDrive
      const videoResponse = await fetchWithRetry(uploadData.videoUrl, 2)
      if (!videoResponse.ok) {
        const errorBody = await videoResponse.text()
        return new Response(
          JSON.stringify({
            error: 'Failed to fetch video from OneDrive',
            debug: {
              stage: currentStage,
              status: videoResponse.status,
              statusText: videoResponse.statusText,
              responseBodyPreview: errorBody.slice(0, 400),
            },
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      videoStream = videoResponse.body!
      videoSize = parseInt(videoResponse.headers.get('content-length') || '0')
    }

    // Generate upload ID untuk tracking
    currentStage = 'init_resumable_upload'
    const uploadId = crypto.randomUUID()

    // Initialize YouTube resumable upload
    const initResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${uploadData.accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Length': videoSize.toString(),
          'X-Upload-Content-Type': 'video/*',
        },
        body: JSON.stringify({
          snippet: {
            title: uploadData.title,
            description: uploadData.description || '',
            categoryId: uploadData.categoryId || '22',
            defaultLanguage: uploadData.defaultLanguage || 'id',
            defaultAudioLanguage: uploadData.defaultAudioLanguage || 'id',
          },
          status: {
            privacyStatus: uploadData.privacyStatus || 'private',
          },
        }),
      }
    )

    if (!initResponse.ok) {
      const error = await initResponse.text()
      return new Response(
        JSON.stringify({
          error: `YouTube init failed: ${error}`,
          debug: {
            title: uploadData.title,
            titleLength: uploadData.title.length,
            defaultLanguage: uploadData.defaultLanguage || 'id',
            defaultAudioLanguage: uploadData.defaultAudioLanguage || 'id',
          },
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const uploadUrl = initResponse.headers.get('location')
    if (!uploadUrl) {
      return new Response(
        JSON.stringify({ error: 'No upload URL received' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Upload video dengan streaming chunked
    currentStage = 'upload_chunked_video'
    const videoId = await uploadVideoChunked(
      videoStream,
      uploadUrl,
      videoSize,
      uploadId,
      env
    )

    // Upload thumbnail jika ada
    if (uploadData.thumbnailUrl && videoId) {
      currentStage = 'upload_thumbnail'
      await uploadThumbnailFromUrl(
        videoId,
        uploadData.thumbnailUrl,
        uploadData.accessToken
      )
    }

    if (uploadData.playlistId && videoId) {
      currentStage = 'add_video_to_playlist'
      await addVideoToPlaylist(videoId, uploadData.playlistId, uploadData.accessToken)
    }

    if (videoId) {
      if (subtitleBlob) {
        currentStage = 'upload_subtitle_blob'
        await uploadSubtitleFromBlob(
          videoId,
          subtitleBlob,
          uploadData.accessToken,
          uploadData.subtitleLanguage || uploadData.defaultLanguage || 'id',
          uploadData.subtitleName || 'Subtitle Indonesia'
        )
      } else if (uploadData.subtitleUrl) {
        currentStage = 'upload_subtitle_url'
        await uploadSubtitleFromUrl(
          videoId,
          uploadData.subtitleUrl,
          uploadData.accessToken,
          uploadData.subtitleLanguage || uploadData.defaultLanguage || 'id',
          uploadData.subtitleName || 'Subtitle Indonesia'
        )
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        uploadId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Upload error:', error)
    return new Response(
      JSON.stringify({
        error: (error as Error).message,
        debug: {
          stage: currentStage,
        },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function addVideoToPlaylist(
  videoId: string,
  playlistId: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId,
          },
        },
      }),
    }
  )

  if (!response.ok) {
    console.error('Failed to add video to playlist:', await response.text())
  }
}

async function uploadSubtitleFromUrl(
  videoId: string,
  subtitleUrl: string,
  accessToken: string,
  language: string,
  subtitleName: string
): Promise<void> {
  const subtitleResponse = await fetch(subtitleUrl)
  if (!subtitleResponse.ok) {
    console.error('Failed to fetch subtitle from URL')
    return
  }

  const subtitleBlob = await subtitleResponse.blob()
  await uploadSubtitleFromBlob(videoId, subtitleBlob, accessToken, language, subtitleName)
}

async function uploadSubtitleFromBlob(
  videoId: string,
  subtitleBlob: Blob,
  accessToken: string,
  language: string,
  subtitleName: string
): Promise<void> {
  const response = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/captions?part=snippet&sync=false',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': subtitleBlob.type || 'application/octet-stream',
      },
      body: subtitleBlob,
    }
  )

  if (!response.ok) {
    console.error('Failed to upload subtitle:', await response.text())
    return
  }

  const captionData = await response.json() as { id?: string }

  if (!captionData.id) {
    return
  }

  const patchResponse = await fetch(
    'https://www.googleapis.com/youtube/v3/captions?part=snippet',
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: captionData.id,
        snippet: {
          videoId,
          language,
          name: subtitleName,
          isDraft: false,
        },
      }),
    }
  )

  if (!patchResponse.ok) {
    console.error('Failed to set subtitle metadata:', await patchResponse.text())
  }
}

async function uploadVideoChunked(
  stream: ReadableStream<Uint8Array>,
  uploadUrl: string,
  totalSize: number,
  uploadId: string,
  env: Env
): Promise<string> {
  if (!Number.isFinite(totalSize) || totalSize <= 0) {
    throw new Error('Ukuran video tidak valid untuk resumable upload')
  }

  const reader = stream.getReader()
  let uploadedBytes = 0
  let buffer: Uint8Array[] = []
  let bufferSize = 0
  let pendingChunk: Uint8Array | null = null

  const getAckedBytes = (response: Response): number => {
    const rangeHeader = response.headers.get('Range') || response.headers.get('range')
    if (!rangeHeader) {
      return uploadedBytes
    }

    const match = /bytes=0-(\d+)/.exec(rangeHeader)
    if (!match) {
      return uploadedBytes
    }

    const acknowledgedEnd = parseInt(match[1], 10)
    if (!Number.isFinite(acknowledgedEnd) || acknowledgedEnd < 0) {
      return uploadedBytes
    }

    return acknowledgedEnd + 1
  }

  while (true) {
    if (!pendingChunk) {
      const { done, value } = await reader.read()

      if (value) {
        buffer.push(value)
        bufferSize += value.length
      }

      // Upload chunk jika buffer >= CHUNK_SIZE atau stream selesai
      if (bufferSize >= CHUNK_SIZE || (done && bufferSize > 0)) {
        const chunk = new Uint8Array(bufferSize)
        let offset = 0
        for (const arr of buffer) {
          chunk.set(arr, offset)
          offset += arr.length
        }

        pendingChunk = chunk
        buffer = []
        bufferSize = 0
      }

      if (done && !pendingChunk) {
        break
      }
    }

    if (pendingChunk) {
      const chunk: Uint8Array = pendingChunk

      const startByte = uploadedBytes
      const endByte = uploadedBytes + chunk.length - 1

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': chunk.length.toString(),
          'Content-Range': `bytes ${startByte}-${endByte}/${totalSize}`,
        },
        body: chunk,
      })

      if (!uploadResponse.ok && uploadResponse.status !== 308) {
        throw new Error(`Upload chunk failed: ${await uploadResponse.text()}`)
      }

      // Jika upload selesai, ambil video ID
      if (uploadResponse.status === 200 || uploadResponse.status === 201) {
        const result = await uploadResponse.json() as any
        return result.id
      }

      const ackedBytes = getAckedBytes(uploadResponse)
      const acceptedInThisChunk = Math.max(0, Math.min(chunk.length, ackedBytes - startByte))

      if (acceptedInThisChunk >= chunk.length) {
        pendingChunk = null
      } else if (acceptedInThisChunk > 0) {
        pendingChunk = chunk.slice(acceptedInThisChunk)
      }

      uploadedBytes = ackedBytes

      // Update progress ke Redis
      await updateProgress(env, uploadId, uploadedBytes, totalSize)
    }
  }

  throw new Error('Upload completed but no video ID received')
}

async function uploadThumbnailFromUrl(
  videoId: string,
  thumbnailUrl: string,
  accessToken: string
): Promise<void> {
  const thumbnailResponse = await fetch(thumbnailUrl)
  if (!thumbnailResponse.ok) {
    console.error('Failed to fetch thumbnail')
    return
  }

  const thumbnailBlob = await thumbnailResponse.blob()

  await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': thumbnailBlob.type,
      },
      body: thumbnailBlob,
    }
  )
}

async function handleThumbnailUpload(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const formData = await request.formData()
    const videoId = formData.get('videoId')
    const thumbnail = formData.get('thumbnail')
    const accessToken = formData.get('accessToken')

    if (!videoId || typeof videoId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing video ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!accessToken || typeof accessToken !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing access token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!thumbnail) {
      return new Response(
        JSON.stringify({ error: 'Missing thumbnail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (typeof thumbnail === 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid thumbnail file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // TypeScript now knows thumbnail is File
    const thumbnailFile = thumbnail as File
    const uploadResponse = await fetch(
      `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': thumbnailFile.type,
        },
        body: thumbnailFile,
      }
    )

    if (!uploadResponse.ok) {
      throw new Error('Thumbnail upload failed')
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleProgress(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url)
  const uploadId = url.searchParams.get('uploadId')

  if (!uploadId) {
    return new Response(
      JSON.stringify({ error: 'Missing uploadId' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const progress = await getProgress(env, uploadId)

  return new Response(JSON.stringify(progress), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function updateProgress(
  env: Env,
  uploadId: string,
  uploaded: number,
  total: number
): Promise<void> {
  const key = `upload:progress:${uploadId}`
  const progress = {
    uploaded,
    total,
    percentage: Math.round((uploaded / total) * 100),
    timestamp: Date.now(),
  }

  const value = encodeURIComponent(JSON.stringify(progress))
  await fetch(`${env.UPSTASH_REDIS_REST_URL}/set/${key}/${value}`, {
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  })

  // Expire after 1 hour
  await fetch(`${env.UPSTASH_REDIS_REST_URL}/expire/${key}/3600`, {
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  })
}

async function getProgress(env: Env, uploadId: string): Promise<any> {
  const key = `upload:progress:${uploadId}`
  const response = await fetch(`${env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  })

  const data = await response.json() as any
  return data.result ? JSON.parse(data.result) : null
}

async function handleRemoteUpload(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const { url, fileName, folder, oneDriveAccessToken } = await request.json() as any

    if (!url || !fileName || !oneDriveAccessToken) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch file dari URL dengan timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 detik timeout

    try {
      const fileResponse = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (!fileResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to download file from URL' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const fileStream = fileResponse.body
      const fileSize = parseInt(fileResponse.headers.get('content-length') || '0')

      if (!fileStream) {
        return new Response(
          JSON.stringify({ error: 'No file stream' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validasi ukuran file (max 250MB untuk OneDrive API)
      if (fileSize > 250 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ error: 'File too large (max 250MB)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Tentukan path di OneDrive
      const pathSegments = folder ? [folder, fileName] : [fileName]
      const encodedPath = pathSegments.map(s => encodeURIComponent(s)).join('/')

      // Upload ke OneDrive dengan streaming
      if (fileSize < 4 * 1024 * 1024) {
        // Simple upload untuk file kecil
        const uploadResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/content`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${oneDriveAccessToken}`,
              'Content-Type': fileResponse.headers.get('content-type') || 'application/octet-stream',
            },
            body: fileStream,
          }
        )

        if (!uploadResponse.ok) {
          const error = await uploadResponse.text()
          return new Response(
            JSON.stringify({ error: `OneDrive upload failed: ${error}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const result = await uploadResponse.json() as any

        return new Response(
          JSON.stringify({
            success: true,
            file: {
              id: result.id,
              name: result.name,
              size: result.size,
              webUrl: result.webUrl,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        // Resumable upload untuk file besar
        const sessionResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/createUploadSession`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${oneDriveAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              item: {
                '@microsoft.graph.conflictBehavior': 'replace',
              },
            }),
          }
        )

        if (!sessionResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to create upload session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const session = await sessionResponse.json() as any
        const uploadUrl = session.uploadUrl

        // Stream upload dengan chunking
        const reader = fileStream.getReader()
        let uploadedBytes = 0
        let buffer: Uint8Array[] = []
        let bufferSize = 0
        const chunkSize = 10 * 1024 * 1024 // 10MB

        while (true) {
          const { done, value } = await reader.read()

          if (value) {
            buffer.push(value)
            bufferSize += value.length
          }

          if (bufferSize >= chunkSize || (done && bufferSize > 0)) {
            const chunk = new Uint8Array(bufferSize)
            let offset = 0
            for (const arr of buffer) {
              chunk.set(arr, offset)
              offset += arr.length
            }

            const startByte = uploadedBytes
            const endByte = uploadedBytes + bufferSize - 1

            const uploadResponse = await fetch(uploadUrl, {
              method: 'PUT',
              headers: {
                'Content-Length': bufferSize.toString(),
                'Content-Range': `bytes ${startByte}-${endByte}/${fileSize}`,
              },
              body: chunk,
            })

            if (!uploadResponse.ok && uploadResponse.status !== 202) {
              throw new Error(`Upload chunk failed: ${await uploadResponse.text()}`)
            }

            uploadedBytes += bufferSize
            buffer = []
            bufferSize = 0

            if (uploadResponse.status === 200 || uploadResponse.status === 201) {
              const result = await uploadResponse.json() as any
              return new Response(
                JSON.stringify({
                  success: true,
                  file: {
                    id: result.id,
                    name: result.name,
                    size: result.size,
                    webUrl: result.webUrl,
                  },
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
          }

          if (done) break
        }
      }

      return new Response(
        JSON.stringify({ error: 'Upload failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Request timeout' }),
          { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('Remote upload error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
