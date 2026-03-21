import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'Missing URL' }, { status: 400 })
    }

    // Fetch HEAD request untuk dapat metadata
    const response = await fetch(url, { 
      method: 'HEAD',
      redirect: 'follow',
    })

    let fileName = ''

    // 1. Cek Content-Disposition header
    const contentDisposition = response.headers.get('content-disposition')
    if (contentDisposition) {
      // Match filename="..." atau filename*=UTF-8''...
      const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i)
      if (filenameMatch && filenameMatch[1]) {
        fileName = decodeURIComponent(filenameMatch[1].trim())
      }
    }

    // 2. Jika tidak ada, ambil dari URL path
    if (!fileName) {
      const urlObj = new URL(response.url || url) // gunakan final URL setelah redirect
      const pathname = urlObj.pathname
      fileName = pathname.split('/').pop() || ''
    }

    // 3. Jika masih tidak ada extension, gunakan Content-Type
    if (fileName && !fileName.includes('.')) {
      const contentType = response.headers.get('content-type')
      if (contentType) {
        const mimeType = contentType.split(';')[0].trim()
        const extMap: Record<string, string> = {
          'audio/mpeg': 'mp3',
          'audio/mp3': 'mp3',
          'video/mp4': 'mp4',
          'video/webm': 'webm',
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'application/pdf': 'pdf',
          'application/zip': 'zip',
        }
        const ext = extMap[mimeType] || mimeType.split('/')[1]
        if (ext && ext !== 'octet-stream' && ext !== 'force-download') {
          fileName = `${fileName}.${ext}`
        }
      }
    }

    // Clean filename
    fileName = fileName.replace(/[<>:"/\\|?*]/g, '_') // Remove invalid chars

    return NextResponse.json({ fileName })
  } catch (error) {
    console.error('Get filename error:', error)
    
    // Fallback: ambil dari URL path
    try {
      const { url } = await request.json()
      const urlObj = new URL(url)
      const fileName = urlObj.pathname.split('/').pop() || 'download'
      return NextResponse.json({ fileName })
    } catch {
      return NextResponse.json({ fileName: 'download' })
    }
  }
}
