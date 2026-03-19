# Fix Azure Redirect URI

## Error yang Terjadi

```
invalid_request: The provided value for the input parameter 'redirect_uri' is not valid.
```

## Solusi

### 1. Buka Azure Portal

https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade

### 2. Cari App Kamu

- Cari app dengan Client ID: `a36bd2c3-882b-415a-8ce5-d6889ad7e807`
- Atau cari berdasarkan nama app

### 3. Tambahkan Redirect URI

1. Klik app tersebut
2. Di sidebar kiri, klik **"Authentication"**
3. Di bagian **"Platform configurations"**, cari **"Web"**
4. Jika belum ada platform Web, klik **"Add a platform"** → pilih **"Web"**
5. Tambahkan Redirect URI:
   ```
   http://localhost:3000/api/auth/callback/microsoft
   ```
6. Klik **"Save"** atau **"Configure"**

### 4. Verifikasi

Pastikan di halaman Authentication ada:

```
Platform: Web
Redirect URIs:
  ✓ http://localhost:3000/api/auth/callback/microsoft
```

### 5. Test Lagi

1. Refresh browser
2. Klik "Hubungkan OneDrive"
3. Seharusnya berhasil login

## Screenshot Lokasi

```
Azure Portal
└── App registrations
    └── [Your App]
        └── Authentication (sidebar)
            └── Platform configurations
                └── Web
                    └── Redirect URIs
                        └── [Add URI here]
```

## Untuk Production

Nanti tambahkan juga:
```
https://your-app.vercel.app/api/auth/callback/microsoft
```
