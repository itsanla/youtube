import { NextRequest, NextResponse } from 'next/server'
import { uploadVideo } from '@/lib/youtube-upload'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const privacyStatus = (formData.get('privacyStatus') as 'private' | 'public' | 'unlisted') || 'private'
    const file = formData.get('file') as File
    const thumbnail = formData.get('thumbnail') as File | null

    if (!title || !file) {
      return NextResponse.json(
        { error: 'Title dan file wajib diisi' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const tempPath = join('/tmp', `upload-${Date.now()}-${file.name}`)
    
    await writeFile(tempPath, buffer)

    let thumbnailPath: string | undefined
    if (thumbnail) {
      const thumbBytes = await thumbnail.arrayBuffer()
      const thumbBuffer = Buffer.from(thumbBytes)
      thumbnailPath = join('/tmp', `thumb-${Date.now()}-${thumbnail.name}`)
      await writeFile(thumbnailPath, thumbBuffer)
    }

    const result = await uploadVideo({
      title,
      description: description || '',
      filePath: tempPath,
      thumbnailPath,
      privacyStatus,
    })

    await unlink(tempPath)
    if (thumbnailPath) {
      await unlink(thumbnailPath)
    }

    return NextResponse.json({
      success: true,
      videoId: result.id,
      url: `https://www.youtube.com/watch?v=${result.id}`,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload gagal' },
      { status: 500 }
    )
  }
}
