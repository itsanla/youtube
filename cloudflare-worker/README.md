# Cloudflare Worker - YouTube Upload

Worker untuk upload video YouTube dari local atau OneDrive dengan streaming.

## Fitur

- ✅ Upload dari **local file** (FormData)
- ✅ Upload dari **OneDrive** (streaming URL)
- ✅ Upload **thumbnail** (local/OneDrive)
- ✅ **Chunked upload** (10MB per chunk)
- ✅ **Progress tracking** via Redis
- ✅ **No timeout** (streaming support)
- ✅ **100% gratis** untuk 1 video/hari

## Setup

### 1. Install Dependencies

```bash
cd cloudflare-worker
npm install
```

### 2. Login Cloudflare

```bash
npx wrangler login
```

### 3. Deploy Worker

```bash
npm run deploy
```

Setelah deploy, kamu akan dapat URL worker:
```
https://youtube-upload-worker.YOUR_SUBDOMAIN.workers.dev
```

## API Endpoints

### 1. Upload Video dari Local

**Endpoint:** `POST /upload-video`

**Content-Type:** `multipart/form-data`

**Body:**
```
video: File (video file)
title: string
description: string (optional)
privacyStatus: 'private' | 'public' | 'unlisted'
accessToken: string (YouTube access token)
thumbnail: File (optional)
```

**Response:**
```json
{
  "success": true,
  "videoId": "abc123",
  "uploadId": "uuid",
  "url": "https://www.youtube.com/watch?v=abc123"
}
```

### 2. Upload Video dari OneDrive

**Endpoint:** `POST /upload-video`

**Content-Type:** `application/json`

**Body:**
```json
{
  "title": "Video Title",
  "description": "Video description",
  "privacyStatus": "private",
  "videoSource": "onedrive",
  "videoUrl": "https://onedrive.live.com/download?...",
  "thumbnailSource": "onedrive",
  "thumbnailUrl": "https://onedrive.live.com/download?...",
  "accessToken": "ya29.xxx"
}
```

### 3. Upload Thumbnail Terpisah

**Endpoint:** `POST /upload-thumbnail`

**Content-Type:** `multipart/form-data`

**Body:**
```
videoId: string
thumbnail: File
accessToken: string
```

### 4. Cek Progress Upload

**Endpoint:** `GET /upload-progress?uploadId=xxx`

**Response:**
```json
{
  "uploaded": 52428800,
  "total": 104857600,
  "percentage": 50,
  "timestamp": 1234567890
}
```

## Integrasi dengan Next.js

Update form upload di Next.js untuk panggil Cloudflare Worker:

```typescript
// app/components/YouTubeUploadForm.tsx
const WORKER_URL = 'https://youtube-upload-worker.YOUR_SUBDOMAIN.workers.dev'

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  
  const formData = new FormData(e.currentTarget)
  
  // Ambil access token dari Redis via API
  const tokenResponse = await fetch('/api/youtube/get-token')
  const { accessToken } = await tokenResponse.json()
  
  formData.append('accessToken', accessToken)
  
  // Upload ke Cloudflare Worker
  const response = await fetch(`${WORKER_URL}/upload-video`, {
    method: 'POST',
    body: formData,
  })
  
  const result = await response.json()
  console.log('Upload success:', result)
}
```

## Estimasi Biaya (Free Tier)

**Cloudflare Workers Free:**
- 100,000 requests/day
- Unlimited bandwidth

**Usage kamu (1 video/hari):**
- Video 500MB = 50 chunks
- Total requests: ~50/hari
- **Biaya: $0/bulan** ✅

## Testing Local

```bash
npm run dev
```

Worker akan jalan di `http://localhost:8787`

Test dengan curl:
```bash
curl -X POST http://localhost:8787/upload-video \
  -F "video=@test.mp4" \
  -F "title=Test Video" \
  -F "accessToken=ya29.xxx"
```

## Troubleshooting

**Error: "No upload URL received"**
- Cek access token valid
- Pastikan YouTube API enabled

**Error: "Upload chunk failed"**
- Cek koneksi internet
- Retry otomatis akan handle ini

**Progress tidak update**
- Cek Redis credentials di wrangler.toml
- Pastikan Upstash Redis accessible

## Production Checklist

- [ ] Deploy worker: `npm run deploy`
- [ ] Update WORKER_URL di Next.js
- [ ] Test upload dari local
- [ ] Test upload dari OneDrive
- [ ] Test thumbnail upload
- [ ] Monitor usage di Cloudflare Dashboard
