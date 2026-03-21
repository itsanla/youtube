import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { getValidAccessToken } from '@/lib/onedrive-oauth'

const ONEDRIVE_TOKENS_KEY = 'onedrive:tokens'

export async function POST(request: NextRequest) {
  try {
    const { url, fileName, folder } = await request.json()

    if (!url || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get OneDrive access token from Redis
    const tokensData = await redis.get(ONEDRIVE_TOKENS_KEY)
    if (!tokensData) {
      return NextResponse.json(
        { error: 'OneDrive belum terkoneksi' },
        { status: 401 }
      )
    }

    const tokens = typeof tokensData === 'string' ? JSON.parse(tokensData) : tokensData
    
    // Auto-refresh jika token expired
    const validToken = await getValidAccessToken(tokens)
    if (typeof validToken === 'object') {
      await redis.set(ONEDRIVE_TOKENS_KEY, JSON.stringify(validToken))
      var accessToken = validToken.access_token
    } else {
      var accessToken = validToken
    }

    // Debug: Log token format
    console.log('Token length:', accessToken?.length)
    console.log('Token starts with:', accessToken?.substring(0, 20))
    console.log('Token has dots:', accessToken?.includes('.'))

    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json(
        { error: 'Invalid token format in Redis' },
        { status: 500 }
      )
    }

    // Download file from URL
    const fileResponse = await fetch(url)
    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download file from URL' },
        { status: 400 }
      )
    }

    const fileBlob = await fileResponse.blob()
    const fileSize = fileBlob.size

    // Validasi ukuran file (max 250MB)
    if (fileSize > 250 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large (max 250MB)' },
        { status: 400 }
      )
    }

    // Tentukan path di OneDrive
    const pathSegments = folder ? [folder, fileName] : [fileName]
    const encodedPath = pathSegments.map(s => encodeURIComponent(s)).join('/')

    // Upload ke OneDrive
    if (fileSize < 4 * 1024 * 1024) {
      // Simple upload untuk file kecil (<4MB)
      const uploadResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/content`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': fileResponse.headers.get('content-type') || 'application/octet-stream',
          },
          body: fileBlob,
        }
      )

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text()
        return NextResponse.json(
          { error: `OneDrive upload failed: ${error}` },
          { status: 500 }
        )
      }

      const result = await uploadResponse.json()

      // Create sharing link untuk akses publik
      const sharingResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${result.id}/createLink`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'view',
            scope: 'anonymous',
          }),
        }
      )

      let directUrl = result.webUrl
      if (sharingResponse.ok) {
        const sharingData = await sharingResponse.json()
        // Convert sharing link to direct download URL
        const shareUrl = sharingData.link.webUrl
        directUrl = shareUrl.replace('https://1drv.ms/', 'https://api.onedrive.com/v1.0/shares/u!')
          .replace(/\?.*$/, '') + '/root/content'
      }

      return NextResponse.json({
        success: true,
        file: {
          id: result.id,
          name: result.name,
          size: result.size,
          webUrl: result.webUrl,
          directUrl,
        },
      })
    } else {
      // Resumable upload untuk file besar (≥4MB)
      const sessionResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/createUploadSession`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
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
        return NextResponse.json(
          { error: 'Failed to create upload session' },
          { status: 500 }
        )
      }

      const session = await sessionResponse.json()
      const uploadUrl = session.uploadUrl

      // Upload dengan chunking 10MB
      const chunkSize = 10 * 1024 * 1024
      const arrayBuffer = await fileBlob.arrayBuffer()
      let uploadedBytes = 0

      while (uploadedBytes < fileSize) {
        const chunk = arrayBuffer.slice(uploadedBytes, Math.min(uploadedBytes + chunkSize, fileSize))
        const endByte = uploadedBytes + chunk.byteLength - 1

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Length': chunk.byteLength.toString(),
            'Content-Range': `bytes ${uploadedBytes}-${endByte}/${fileSize}`,
          },
          body: chunk,
        })

        if (!uploadResponse.ok && uploadResponse.status !== 202) {
          return NextResponse.json(
            { error: 'Upload chunk failed' },
            { status: 500 }
          )
        }

        uploadedBytes += chunk.byteLength

        // Jika upload selesai
        if (uploadResponse.status === 200 || uploadResponse.status === 201) {
          const result = await uploadResponse.json()

          // Create sharing link untuk akses publik
          const sharingResponse = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/items/${result.id}/createLink`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'view',
                scope: 'anonymous',
              }),
            }
          )

          let directUrl = result.webUrl
          if (sharingResponse.ok) {
            const sharingData = await sharingResponse.json()
            const shareUrl = sharingData.link.webUrl
            directUrl = shareUrl.replace('https://1drv.ms/', 'https://api.onedrive.com/v1.0/shares/u!')
              .replace(/\?.*$/, '') + '/root/content'
          }

          return NextResponse.json({
            success: true,
            file: {
              id: result.id,
              name: result.name,
              size: result.size,
              webUrl: result.webUrl,
              directUrl,
            },
          })
        }
      }

      return NextResponse.json(
        { error: 'Upload failed' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Remote upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
