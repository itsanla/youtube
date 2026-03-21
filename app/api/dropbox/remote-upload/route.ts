import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { getValidAccessToken } from '@/lib/dropbox-oauth'

const DROPBOX_TOKENS_KEY = 'dropbox:tokens'

export async function POST(request: NextRequest) {
  try {
    const { url, fileName, folder } = await request.json()

    if (!url || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get Dropbox access token from Redis
    const tokensData = await redis.get(DROPBOX_TOKENS_KEY)
    if (!tokensData) {
      return NextResponse.json(
        { error: 'Dropbox belum terkoneksi' },
        { status: 401 }
      )
    }

    const tokens = typeof tokensData === 'string' ? JSON.parse(tokensData) : tokensData
    
    // Auto-refresh jika token expired atau akan expired
    const validToken = await getValidAccessToken(tokens)
    
    // Jika token di-refresh, simpan yang baru
    if (typeof validToken === 'object') {
      await redis.set(DROPBOX_TOKENS_KEY, JSON.stringify(validToken))
      var accessToken = validToken.access_token
    } else {
      var accessToken = validToken
    }

    // Tentukan path di Dropbox
    const path = folder ? `/${folder}/${fileName}` : `/${fileName}`

    // Call Dropbox save_url API
    const response = await fetch('https://api.dropboxapi.com/2/files/save_url', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path,
        url,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: `Dropbox save_url failed: ${error.error_summary || 'Unknown error'}` },
        { status: 500 }
      )
    }

    const result = await response.json()

    console.log('Dropbox save_url response:', result)

    // Check if async job
    if (result['.tag'] === 'async_job_id') {
      const jobId = result.async_job_id

      // Poll job status
      let completed = false
      let attempts = 0
      const maxAttempts = 60 // 5 menit (5 detik interval)

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)) // wait 5 detik

        const statusResponse = await fetch('https://api.dropboxapi.com/2/files/save_url/check_job_status', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            async_job_id: jobId,
          }),
        })

        const statusResult = await statusResponse.json()
        console.log('Job status:', statusResult)

        if (statusResult['.tag'] === 'complete') {
          completed = true
          const metadata = statusResult

          return NextResponse.json({
            success: true,
            file: {
              id: metadata.id || 'unknown',
              name: metadata.name || fileName,
              size: metadata.size || 0,
              path: path,
            },
          })
        } else if (statusResult['.tag'] === 'failed') {
          return NextResponse.json(
            { error: `Upload failed: ${JSON.stringify(statusResult)}` },
            { status: 500 }
          )
        }

        attempts++
      }

      if (!completed) {
        return NextResponse.json(
          { error: 'Upload timeout - file mungkin terlalu besar atau URL tidak valid' },
          { status: 408 }
        )
      }
    } else if (result['.tag'] === 'complete') {
      // Langsung selesai (file kecil)
      const metadata = result

      return NextResponse.json({
        success: true,
        file: {
          id: metadata.id || 'unknown',
          name: metadata.name || fileName,
          size: metadata.size || 0,
          path: path,
        },
      })
    }

    return NextResponse.json(
      { error: 'Unexpected response from Dropbox' },
      { status: 500 }
    )
  } catch (error) {
    console.error('Dropbox remote upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
