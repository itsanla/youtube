# Setup YouTube Upload Feature

## Langkah-langkah Setup (Sekali Saja)

### 1. Google Cloud Console Setup

1. Buka https://console.cloud.google.com/apis/credentials
2. Pilih project atau buat baru
3. Enable **YouTube Data API v3**:
   - Klik "Enable APIs and Services"
   - Cari "YouTube Data API v3"
   - Klik "Enable"

### 2. Buat OAuth 2.0 Credentials

1. Di halaman Credentials, klik "Create Credentials" → "OAuth client ID"
2. Pilih Application type: **Web application**
3. Tambahkan **Authorized redirect URIs**:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-domain.vercel.app/api/auth/callback/google`
4. Simpan Client ID dan Client Secret ke `.env`

### 3. Environment Variables

Tambahkan ke file `.env`:
```
CLIENT_ID="your-client-id-from-google-console"
CLIENT_SECRET="your-client-secret-from-google-console"
NEXTAUTH_URL="http://localhost:3000"
UPSTASH_REDIS_REST_URL="your-upstash-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"
```

### 4. Cara Menggunakan

1. Jalankan dev server: `pnpm dev`
2. Buka http://localhost:3000/dashboard
3. Klik tombol **"Hubungkan YouTube"**
4. Login dengan akun Google dan izinkan akses
5. Setelah terhubung, form upload akan muncul
6. Upload video dengan mengisi:
   - Judul video
   - Deskripsi (opsional)
   - Privacy status (private/unlisted/public)
   - File video
   - Thumbnail (opsional)

### 5. Struktur File Baru

```
app/
├── api/
│   ├── auth/
│   │   ├── youtube/route.ts          # Mulai OAuth flow
│   │   └── callback/google/route.ts  # Terima token
│   └── youtube/
│       └── upload/route.ts            # Upload video
├── components/
│   ├── YouTubeConnection.tsx          # Status koneksi
│   └── YouTubeUploadForm.tsx          # Form upload
lib/
├── youtube-oauth.ts                   # OAuth utilities
├── youtube-upload.ts                  # Upload utilities
└── youtube-channel.ts                 # Channel info utilities
```

### 6. Data yang Disimpan di Redis

- Key: `youtube:tokens` - OAuth tokens (access + refresh)
- Key: `youtube:channel_info` - Info channel yang terhubung
- Refresh token permanent sampai user revoke akses

### 7. Testing

1. Pastikan redirect URI sudah ditambahkan di Google Console
2. Test upload dengan video kecil dulu
3. Cek di YouTube Studio apakah video masuk

### 8. Production Deployment

1. Update `NEXTAUTH_URL` di Vercel environment variables
2. Tambahkan production redirect URI di Google Console
3. Set semua environment variables di Vercel:
   - `CLIENT_ID`
   - `CLIENT_SECRET`
   - `NEXTAUTH_URL`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

## Troubleshooting

- **Error: redirect_uri_mismatch** → Cek redirect URI di Google Console
- **Error: no_refresh_token** → Revoke akses di Google Account, lalu connect ulang
- **Upload gagal** → Cek quota YouTube API (default 10,000 units/day)
- **Error 403: access_denied** → Tambahkan email sebagai Test User di OAuth Consent Screen
