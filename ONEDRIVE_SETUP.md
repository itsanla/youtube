# Setup OneDrive Integration

## Langkah Setup

### 1. Buat App di Microsoft Azure

1. Buka https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
2. Klik **"New registration"**
3. Isi form:
   - Name: `YouTube Upload Manager`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: 
     - Platform: **Web**
     - URL: `http://localhost:3000/api/onedrive/callback`
4. Klik **"Register"**

### 2. Dapatkan Credentials

1. Di halaman app, copy **Application (client) ID**
2. Klik **"Certificates & secrets"** → **"New client secret"**
3. Description: `YouTube Upload Secret`
4. Expires: **24 months**
5. Klik **"Add"** dan copy **Value** (secret)

### 3. Set API Permissions

1. Klik **"API permissions"** → **"Add a permission"**
2. Pilih **"Microsoft Graph"**
3. Pilih **"Delegated permissions"**
4. Tambahkan:
   - `Files.Read`
   - `Files.Read.All`
   - `offline_access`
5. Klik **"Add permissions"**
6. Klik **"Grant admin consent"** (jika ada)

### 4. Update Environment Variables

Tambahkan ke `.env`:
```
ONEDRIVE_CLIENT_ID="your-application-client-id"
ONEDRIVE_CLIENT_SECRET="your-client-secret-value"
```

Tambahkan ke `.env.local` (untuk OneDrive Picker):
```
NEXT_PUBLIC_ONEDRIVE_CLIENT_ID="your-application-client-id"
```

### 5. Production Setup

Di Azure Portal, tambahkan production redirect URI:
```
https://your-app.vercel.app/api/onedrive/callback
```

Di Vercel, set environment variables:
- `ONEDRIVE_CLIENT_ID`
- `ONEDRIVE_CLIENT_SECRET`
- `NEXT_PUBLIC_ONEDRIVE_CLIENT_ID`

## Cara Pakai

### 1. Hubungkan OneDrive

1. Buka dashboard
2. Di section upload, klik **"Hubungkan OneDrive"**
3. Login dengan Microsoft account
4. Izinkan akses ke files

### 2. Upload Video

1. Di form upload, ada 2 kolom untuk video:
   - **Dari Local**: Pilih file dari komputer
   - **Dari OneDrive**: Klik untuk buka file picker OneDrive
2. Pilih salah satu sumber
3. Sama untuk thumbnail (opsional)
4. Isi judul, deskripsi, privacy
5. Klik "Upload Video"

## Keuntungan OneDrive Integration

✅ **File picker UI** - Tidak perlu copy-paste URL
✅ **Direct streaming** - Video langsung dari OneDrive ke YouTube
✅ **Hemat bandwidth** - Tidak download ke local dulu
✅ **Flexible** - Bisa pilih local atau OneDrive per file
✅ **Thumbnail support** - Bisa beda sumber (video OneDrive, thumbnail local)

## Troubleshooting

### Error: "OneDrive belum terhubung"
- Klik "Hubungkan OneDrive"
- Login dan izinkan akses

### File picker tidak muncul
- Cek browser console untuk error
- Pastikan OneDrive SDK loaded (cek Network tab)
- Cek NEXT_PUBLIC_ONEDRIVE_CLIENT_ID sudah di set

### Error: "Failed to get download URL"
- Token expired, disconnect dan connect ulang
- Cek file masih ada di OneDrive
- Cek permissions di Azure Portal

### Upload gagal dari OneDrive
- Cek file size (max 2GB untuk free tier)
- Cek format video supported
- Cek OneDrive file tidak private/restricted
