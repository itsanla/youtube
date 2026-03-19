# Integrasi Cloudflare Worker dengan Next.js

## Setup Selesai ✅

### Worker URL
```
https://youtube-upload-worker.anlaharpanda.workers.dev
```

### Fitur yang Sudah Terintegrasi

1. **Upload dari Local**
   - User pilih file video dari komputer
   - Upload langsung ke Cloudflare Worker
   - Worker streaming ke YouTube
   - Progress bar real-time

2. **Upload dari OneDrive**
   - User paste URL download OneDrive
   - Worker fetch dari OneDrive
   - Streaming langsung ke YouTube
   - Tidak melalui browser (hemat bandwidth)

3. **Thumbnail Support**
   - Local file atau OneDrive URL
   - Auto upload setelah video selesai

## Cara Pakai

### 1. Upload dari Local

1. Buka dashboard: http://localhost:3000/dashboard
2. Pastikan YouTube sudah terhubung
3. Pilih tab **"Upload dari Local"**
4. Isi form:
   - Judul video
   - Deskripsi (opsional)
   - Privacy status
   - Pilih file video
   - Pilih thumbnail (opsional)
5. Klik "Upload Video"
6. Tunggu progress bar sampai 100%

### 2. Upload dari OneDrive

1. Buka OneDrive, pilih video
2. Klik "Share" → "Copy link"
3. Ubah link menjadi download URL:
   ```
   Dari: https://1drv.ms/v/s!xxxxx
   Jadi: https://api.onedrive.com/v1.0/shares/u!xxxxx/root/content
   ```
4. Di dashboard, pilih tab **"Upload dari OneDrive"**
5. Paste URL download
6. Isi form lainnya
7. Klik "Upload Video"

## Cara Mendapatkan OneDrive Download URL

### Metode 1: Manual
1. Share file di OneDrive
2. Copy link (contoh: `https://1drv.ms/v/s!AkXXXX`)
3. Encode base64:
   ```bash
   echo -n "https://1drv.ms/v/s!AkXXXX" | base64
   ```
4. URL jadi: `https://api.onedrive.com/v1.0/shares/u!{base64}/root/content`

### Metode 2: OneDrive API (Recommended)
Nanti kita bisa tambahkan fitur:
- OAuth OneDrive
- File picker langsung dari UI
- Auto generate download URL

## Monitoring Upload

### Cek Progress
```javascript
const uploadId = 'xxx' // dari response upload
const response = await fetch(
  `https://youtube-upload-worker.anlaharpanda.workers.dev/upload-progress?uploadId=${uploadId}`
)
const progress = await response.json()
console.log(progress.percentage) // 0-100
```

### Cek di Cloudflare Dashboard
1. Buka: https://dash.cloudflare.com
2. Workers & Pages → youtube-upload-worker
3. Lihat metrics: requests, errors, CPU time

## Estimasi Biaya

**Cloudflare Workers Free Tier:**
- 100,000 requests/day
- Unlimited bandwidth

**Usage kamu (1 video/hari):**
- Video 500MB = ~50 chunks
- Total: ~50 requests/hari
- **Biaya: $0/bulan** ✅

## Troubleshooting

### Upload gagal dari local
- Cek file size (max 2GB untuk free tier)
- Cek format video (MP4, MOV, AVI, dll)
- Cek koneksi internet

### Upload gagal dari OneDrive
- Pastikan URL download valid
- Cek file masih ada di OneDrive
- Cek sharing permission (public/anyone with link)

### Progress tidak update
- Refresh halaman
- Cek Redis connection
- Cek worker logs di Cloudflare

### Error "YouTube belum terhubung"
- Klik "Hubungkan YouTube" di dashboard
- Login dengan Google
- Izinkan akses YouTube

## Next Steps

Fitur yang bisa ditambahkan:
- [ ] OneDrive OAuth integration
- [ ] File picker UI untuk OneDrive
- [ ] Scheduled upload (upload nanti)
- [ ] Batch upload (multiple videos)
- [ ] Upload queue management
- [ ] Email notification setelah upload selesai
