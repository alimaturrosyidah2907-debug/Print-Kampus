# PRINT KAMPUS

Aplikasi web layanan cetak dokumen kampus berbasis React, TypeScript, Three.js, Express, dan SQLite dengan tiga portal terpisah untuk **User**, **Mitra Percetakan**, dan **Admin Platform**.

## Portal & Peran Pengguna

- **`/`** — Halaman gerbang utama beserta Studio 3D interaktif (`Three.js`).
- **`/user`** — Portal Mahasiswa (login melalui **Google Sign-In / Firebase Auth**), pemesanan cetak, pelacakan progres, dan pelaporan kendala (CRUD).
- **`/mitra`** — Portal Mitra Percetakan (login akun Mitra yang didaftarkan oleh Admin ke database SQLite), pengelolaan antrean pesanan, layanan katalog, status buka/tutup toko, dan pencairan saldo.
- **`/admin`** — Portal Admin Platform (akun Admin tersimpan aman di SQLite dengan `scrypt` hash), pengaturan persentase komisi potongan mitra (`%`), registrasi Mitra, dan CRUD penuh seluruh pesanan, katalog, tiket, serta akun database.

## Menyambungkan ke GitHub

Repositori ini siap dihubungkan dan di-push ke GitHub:

```bash
git init -b main
git add .
git commit -m "Initial commit PRINT KAMPUS"
git remote add origin https://github.com/<username>/<nama-repo>.git
git push -u origin main
```

File sensitif dan data lokal (`.env*`, `data/`, `*.db*`, `node_modules/`, `dist/`) sudah dikecualikan di `.gitignore`. Workflow CI otomatis tersedia di `.github/workflows/ci.yml`.

## Menjalankan dari Clone GitHub

1. Instal dependensi:
   ```bash
   npm install
   ```
2. Salin `.env.example` menjadi `.env` dan sesuaikan variabel lingkungan (misalnya `SESSION_SECRET`, serta `VITE_FIREBASE_*` / `FIREBASE_PROJECT_ID` bila mengganti proyek Firebase):
   ```bash
   cp .env.example .env
   ```
3. Jalankan mode pengembangan (port `3000`):
   ```bash
   npm run dev
   ```
4. Build & jalankan mode produksi:
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```
5. Jalankan pemeriksaan tipe dan unit test:
   ```bash
   npm run lint
   npm test
   ```
