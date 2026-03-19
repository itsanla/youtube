# OneDrive Integration - Quick Start

## Setup Selesai ✅

Credentials sudah dikonfigurasi:
- Client ID: `a36bd2c3-882b-415a-8ce5-d6889ad7e807`
- Redirect URI: `http://localhost:3000/api/auth/callback/microsoft`

## Langkah Terakhir di Azure Portal

1. Buka: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
2. Cari app dengan Client ID: `a36bd2c3-882b-415a-8ce5-d6889ad7e807`
3. Klik app tersebut
4. Klik **"Authentication"** di sidebar
5. Pastikan Redirect URI sudah ada:
   ```
   http://localhost:3000/api/auth/callback/microsoft
   ```
6. Jika belum, klik **"Add a platform"** → **"Web"** → Tambahkan URL di atas

## Test Integration

1. Restart dev server:
   ```bash
   pnpm dev
   ```

2. Buka: http://localhost:3000/dashboard

3. Scroll ke form upload

4. Klik **"Hubungkan OneDrive"** (jika belum terhubung)

5. Login dengan Microsoft account

6. Test upload:
   - Klik area "Pilih dari OneDrive" di bagian Video
   - File picker OneDrive akan terbuka
   - Pilih video
   - Isi form lainnya
   - Upload

## Struktur Form

```
┌─────────────────────────────────────┐
│ Video *                             │
├──────────────────┬──────────────────┤
│ Dari Local       │ Dari OneDrive    │
│ [Choose File]    │ [Picker Button]  │
└──────────────────┴──────────────────┘

┌─────────────────────────────────────┐
│ Thumbnail (Opsional)                │
├──────────────────┬──────────────────┤
│ Dari Local       │ Dari OneDrive    │
│ [Choose File]    │ [Picker Button]  │
└──────────────────┴──────────────────┘
```

## Troubleshooting

### "OneDrive belum terhubung"
- Klik tombol "Hubungkan OneDrive"
- Login dengan Microsoft account

### File picker tidak muncul
- Cek browser console
- Pastikan OneDrive SDK loaded
- Refresh halaman

### Redirect URI mismatch
- Pastikan di Azure Portal redirect URI exact match:
  `http://localhost:3000/api/auth/callback/microsoft`

## Production

Untuk production, tambahkan redirect URI di Azure:
```
https://your-app.vercel.app/api/auth/callback/microsoft
```

Dan set env vars di Vercel:
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_REDIRECT_URI`
- `NEXT_PUBLIC_MICROSOFT_CLIENT_ID`
