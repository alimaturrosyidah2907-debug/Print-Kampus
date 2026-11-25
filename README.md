# PRINT KAMPUS

Aplikasi web Single-Page Application (SPA) **100% client-side** berbasis **React**, **TypeScript**, **Three.js**, **Firebase Authentication**, dan **Cloud Firestore** dengan tiga portal terpisah untuk **User**, **Mitra Percetakan**, dan **Admin Platform**.

## Arsitektur & Penyimpanan Cloud Firestore

Seluruh data aplikasi (profil mahasiswa, akun & undangan Admin, daftar toko Mitra, katalog tarif layanan, pesanan cetak, tiket kendala, pencairan saldo, dan pengaturan komisi `%`) disimpan langsung di **Cloud Firestore** dengan otentikasi **Firebase Authentication (Google Sign-In)** dan proteksi **Firestore Security Rules** (`firestore.rules`).

### Portal & Peran Pengguna

- **`/Print-Kampus/`** (atau **`/`** saat dev lokal) — Gerbang utama beserta Studio 3D interaktif (`Three.js`).
- **`/Print-Kampus/user`** — Portal Mahasiswa (Google Sign-In via Firebase Auth), pemesanan cetak, pelacakan progres, dan pelaporan kendala (CRUD).
- **`/Print-Kampus/mitra`** — Portal Mitra Percetakan (Google Sign-In untuk email Mitra yang telah didaftarkan Admin), pengelolaan antrean pesanan, layanan katalog, status buka/tutup toko, dan pengajuan pencairan saldo.
- **`/Print-Kampus/admin`** — Portal Admin Platform (Google Sign-In untuk Super Admin / Admin terundang di Firestore), pengaturan persentase komisi potongan mitra (`%`), registrasi Mitra, dan CRUD penuh pesanan, katalog, tiket, pencairan saldo, serta akun.

## Deploy Otomatis ke GitHub Pages

Proyek ini sudah dikonfigurasi dengan `base: '/Print-Kampus/'` di `vite.config.ts` (beserta fallback `dist/404.html` untuk SPA routing) dan workflow otomatis di `.github/workflows/deploy.yml`:

1. Push repositori ke GitHub (branch `main` atau `master`):
   ```bash
   git add .
   git commit -m "Migrate PRINT KAMPUS to 100% Firebase + GitHub Pages"
   git push -u origin main
   ```
2. Di repositori GitHub, buka **Settings → Pages → Build and deployment → Source**, lalu pilih **GitHub Actions**.
3. Di **Firebase Console → Authentication → Settings → Authorized domains**, tambahkan domain `<username>.github.io` agar popup Google Sign-In berjalan di GitHub Pages.
4. Situs Anda akan otomatis terbit di `https://<username>.github.io/Print-Kampus/` setiap kali ada push ke `main`.

## Pengembangan Lokal

```bash
npm install
npm run dev        # Menjalankan Vite dev server di http://localhost:3000
npm run lint       # TypeScript typecheck
npm run lint:rules # Validasi ESLint untuk firestore.rules
npm test           # Unit test perhitungan harga & transisi status
npm run build      # Build static bundle untuk GitHub Pages (/Print-Kampus/)
```
