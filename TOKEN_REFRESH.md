# Auto Token Refresh

## Dropbox
- **Refresh Token**: Valid selamanya (offline access)
- **Access Token**: Expired setiap 4 jam
- **Auto-refresh**: Otomatis refresh 5 menit sebelum expired

## OneDrive
- **Refresh Token**: Valid selamanya (offline_access scope)
- **Access Token**: Expired setiap 1 jam
- **Auto-refresh**: Otomatis refresh 5 menit sebelum expired

## Implementasi
Setiap API endpoint yang menggunakan access token akan:
1. Cek apakah token akan expired dalam 5 menit
2. Jika ya, auto-refresh menggunakan refresh token
3. Simpan token baru ke Redis
4. Gunakan access token yang valid

## Files Updated
### Dropbox:
- `lib/dropbox-oauth.ts` - Added `getValidAccessToken()`
- `app/api/auth/callback/dropbox/route.ts` - Save with `expires_at`
- `app/api/dropbox/remote-upload/route.ts` - Auto-refresh before use

### OneDrive:
- `lib/onedrive-oauth.ts` - Added `refreshAccessToken()` and `getValidAccessToken()`
- `app/api/auth/callback/microsoft/route.ts` - Save with `expires_at`
- `app/api/onedrive/get-download-url/route.ts` - Auto-refresh before use
- `app/api/onedrive/list-files/route.ts` - Auto-refresh before use
- `app/api/onedrive/search-files/route.ts` - Auto-refresh before use
- `app/api/onedrive/remote-upload/route.ts` - Auto-refresh before use
- `app/api/onedrive/get-token/route.ts` - Auto-refresh before use

## Result
✅ Dropbox dan OneDrive akan terhubung selamanya tanpa perlu login ulang
