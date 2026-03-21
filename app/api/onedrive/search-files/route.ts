import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { getValidAccessToken } from '@/lib/onedrive-oauth'

const ONEDRIVE_TOKENS_KEY = 'onedrive:tokens'

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v']
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'video'
    const limit = parseInt(searchParams.get('limit') || '15')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search') || ''

    const tokensData = await redis.get(ONEDRIVE_TOKENS_KEY)
    if (!tokensData) {
      return NextResponse.json({ error: 'OneDrive not connected' }, { status: 401 })
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

    // Build search query
    const extensions = type === 'video' ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS
    const extensionQuery = extensions.map(ext => `.${ext}`).join(' OR ')
    
    let searchQuery = extensionQuery
    if (search) {
      searchQuery = `${search} AND (${extensionQuery})`
    }

    // Search all files recursively with Graph API
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${searchQuery}')?$orderby=lastModifiedDateTime desc&$top=${limit + offset}&$select=id,name,size,lastModifiedDateTime,file`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('OneDrive API error:', error)
      throw new Error('Failed to search files')
    }

    const data = await response.json()

    // Filter only files (not folders) and apply pagination
    const allFiles = data.value
      .filter((item: any) => item.file) // Only files
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        modifiedDate: item.lastModifiedDateTime,
      }))

    // Apply offset and limit
    const paginatedFiles = allFiles.slice(offset, offset + limit)
    const hasMore = allFiles.length > offset + limit

    return NextResponse.json({
      files: paginatedFiles,
      hasMore,
      total: allFiles.length,
    })
  } catch (error) {
    console.error('Search files error:', error)
    return NextResponse.json(
      { error: 'Failed to search files' },
      { status: 500 }
    )
  }
}
