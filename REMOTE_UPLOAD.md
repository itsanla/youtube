# Remote Upload Feature

## Fitur Baru: Upload File dari URL ke OneDrive

Upload file langsung dari URL ke OneDrive tanpa download ke local. **Server-to-server transfer** untuk hemat kuota internet!

## Use Case

Saat edit video, kamu butuh:
- Background music dari website
- Sound effects dari library online
- Stock footage dari platform
- Thumbnail template dari design tool

Dengan Remote Upload, kamu bisa langsung transfer ke OneDrive tanpa:
- ❌ Download ke laptop dulu
- ❌ Pakai kuota internet lokal
- ❌ Upload manual ke OneDrive

## Cara Pakai

### 1. Akses Remote Upload

Dari dashboard, klik tombol **"📥 Remote Upload"** di header.

Atau langsung ke: http://localhost:3000/remote-upload

### 2. Paste URL Download

Copy link download file (direct download link):
```
https://example.com/assets/background-music.mp3
https://cdn.example.com/video/stock-footage.mp4
https://storage.example.com/images/thumbnail.png
```

### 3. Isi Form

- **URL Download**: Paste link
- **Nama File**: Auto-fill dari URL atau isi manual (contoh: `music.mp3`)
- **Folder Tujuan**: Opsional (contoh: `Assets/Audio`)

### 4. Upload

Klik **"Upload ke OneDrive"** → File langsung masuk ke OneDrive!

## Fitur

### ✅ Support Semua Format

- **Video**: MP4, MOV, AVI, MKV, WebM, FLV, WMV
- **Audio**: MP3, WAV, AAC, FLAC, OGG
- **Image**: JPG, PNG, GIF, SVG, WebP, BMP
- **Document**: PDF, DOCX, XLSX, PPTX
- **Archive**: ZIP, RAR, 7Z
- **Dan lainnya**: Semua format file

### ✅ Smart Upload

- **File kecil (<4MB)**: Simple upload (cepat)
- **File besar (>4MB)**: Chunked upload (10MB per chunk)
- **Auto-retry**: Jika gagal, otomatis retry

### ✅ Auto-fill Filename

Paste URL → Nama file otomatis terisi dari URL

### ✅ Upload History

5 upload terakhir ditampilkan dengan link ke OneDrive

## Technical Details

### API Endpoint

```
POST /api/onedrive/remote-upload

Body:
{
  "url": "https://example.com/file.mp4",
  "fileName": "video.mp4",
  "folder": "Assets/Videos" // optional
}

Response:
{
  "success": true,
  "file": {
    "id": "xxx",
    "name": "video.mp4",
    "size": 52428800,
    "webUrl": "https://onedrive.live.com/..."
  }
}
```

### Upload Flow

```
User paste URL
  ↓
Vercel API fetch file dari URL
  ↓
Stream ke OneDrive (chunked jika >4MB)
  ↓
File masuk OneDrive
  ↓
Return metadata ke user
```

### Performance

- **Small file (<4MB)**: 2-5 detik
- **Large file (100MB)**: 30-60 detik
- **Huge file (1GB)**: 5-10 menit

Tergantung kecepatan server source dan OneDrive.

## Tips

### 1. Organize dengan Folder

```
Assets/
├── Audio/
│   ├── music.mp3
│   └── sfx.wav
├── Video/
│   └── stock-footage.mp4
└── Images/
    └── thumbnail.png
```

### 2. Naming Convention

Gunakan nama file yang jelas:
- ❌ `file.mp3`
- ✅ `background-music-upbeat.mp3`

### 3. Batch Upload

Buka multiple tabs untuk upload beberapa file sekaligus.

### 4. Verify Upload

Klik link "Buka di OneDrive" untuk verify file sudah masuk.

## Limitations

### Vercel Serverless

- **Timeout**: 10 detik (Hobby) / 60 detik (Pro)
- **Memory**: 1GB
- **Request size**: 4.5MB body

**Solusi**: Untuk file >100MB, gunakan Cloudflare Worker (no timeout).

### OneDrive API

- **Quota**: 10GB upload/day (free tier)
- **File size**: Max 250GB per file
- **Rate limit**: 100 requests/minute

## Troubleshooting

### Error: "Gagal download file dari URL"

- Cek URL valid dan accessible
- Pastikan direct download link (bukan preview page)
- Cek URL tidak expired

### Error: "Gagal upload ke OneDrive"

- Cek OneDrive storage tidak penuh
- Cek token tidak expired (reconnect OneDrive)
- Cek folder path valid

### Upload lambat

- File besar butuh waktu
- Tergantung kecepatan server source
- Coba lagi saat koneksi stabil

## Future Improvements

- [ ] Batch upload (multiple URLs)
- [ ] Progress bar untuk file besar
- [ ] Queue system untuk upload banyak file
- [ ] Integration dengan Cloudflare Worker (no timeout)
- [ ] Support Google Drive, Dropbox
- [ ] Scheduled upload
