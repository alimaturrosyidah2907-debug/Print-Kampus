# PrintKampus — Detail Lengkap Aplikasi Web Pemesanan Cetak Dokumen Kampus

**PrintKampus** adalah aplikasi web *Single-Page Application* (SPA) berbasis ekosistem kampus yang menghubungkan mahasiswa (pemesan dokumen cetak/fotokopi) dengan mitra percetakan di sekitar kampus melalui alur terstruktur **PDF → PRINT → PICK UP**, dilengkapi pengelolaan pesanan, katalog tarif, pelacakan status real-time, penanganan kendala, dan simulator model bisnis komisi.

---

## Ringkasan Keputusan & Lingkup Dokumentasi

> [!IMPORTANT]
> Berdasarkan konfirmasi Anda pada tahap klarifikasi, dokumen ini menyajikan **penjelasan menyeluruh mengenai kondisi aplikasi PrintKampus saat ini** (fitur, alur kerja, desain visual, model data, dan arsitektur teknis) **tanpa melakukan perubahan atau penambahan kode sumber apa pun**.

- **Bentuk Penyajian**: Penjelasan lengkap mencakup aspek fungsional, alur pengguna, desain antarmuka, dan arsitektur teknis.
- **Cakupan Fokus**: Seluruh modul aplikasi secara menyeluruh (Portal Mahasiswa, Panel Mitra Percetakan, Dashboard Admin Platform, Katalog Tarif Cetak, dan Simulasi Pendapatan & Komisi).
- **Status Implementasi**: Kondisi aplikasi berjalan saat ini (*read-only specification*); tidak ada modifikasi fitur atau integrasi backend baru yang dieksekusi.

---

## 1. Gambaran Umum & Konsep Inti

- **Fungsi Utama**: Mendigitalisasi proses pemesanan cetak dan fotokopi di lingkungan kampus agar mahasiswa dapat mengunggah dokumen, menentukan spesifikasi cetak secara presisi, memantau progres pengerjaan tanpa mengantre di tempat, dan membayar secara transparan.
- **Target Pengguna (3 Peran Aktif)**:
  1. **Mahasiswa (Pemesan)**: Mengunggah file dokumen, memilih mitra percetakan terdekat, mengatur spesifikasi kertas/warna/jilid, melacak status pesanan, mengedit/membatalkan pesanan sebelum diproses, serta melaporkan kendala hasil cetak.
  2. **Mitra Percetakan**: Mengelola status operasional toko (Buka/Tutup), mengatur profil dan tarif cetak spesifik toko, memproses antrean pesanan masuk melalui alur status bertahap, serta mengajukan pencairan saldo pendapatan bersih.
  3. **Admin Platform**: Memantau seluruh transaksi lintas mitra (GMV, komisi kotor platform, penyaluran dana mitra), melakukan CRUD pendaftaran/penghapusan dan kontrol status mitra, mengatur persentase komisi global, serta menangani tiket kendala pelanggan.
- **Nilai Utama Sistem**:
  - Mengurangi waktu tunggu mahasiswa saat jam sibuk pengumpulan tugas/skripsi.
  - Mencegah risiko salah cetak berkat spesifikasi terstruktur dan kolom instruksi khusus.
  - Memberikan transparansi biaya otomatis dan pembagian komisi real-time antara platform dan mitra (standar 10% / 90%).

---

## 2. Pengalaman Pengguna (UX) & Desain Visual

### A. Alur Pengguna Utama (Key User Flows)

1. **Alur Pemesanan & Pelacakan Mahasiswa**:
   - Pada **Portal Mahasiswa**, pengguna melihat banner utama, tiga kartu layanan cepat (**Hitam Putih B/W**, **Berwarna CLR**, dan **Paket Jilid Lengkap JLD**), ringkasan pesanan terkini, tabel riwayat pesanan dengan pencarian & filter status, serta kartu daftar mitra percetakan kampus beserta jumlah antrean dan tarif B/W.
   - Menekan tombol pesan atau memilih mitra membuka **Form Pemesanan Cetak Dokumen**:
     1. Unggah dokumen (`.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`) yang otomatis membaca nama file, ukuran MB, dan memperkirakan jumlah halaman.
     2. Pilih lokasi mitra percetakan (menampilkan rating dan jumlah antrean saat ini).
     3. Atur spesifikasi: jumlah halaman, jumlah salinan (*copies*), ukuran kertas (`A4`, `F4`, `A3`), gramatur (`70gr`, `80gr`, `100gr`), warna (`B/W` atau `CLR`), sisi cetak (`1 Sisi / Simplex` atau `Bolak-Balik / Duplex`), jenis jilid (`Tanpa Jilid`, `Staples`, `Lakban`, `Spiral Plastik`, `Spiral Kawat`, `Hardcover`), dan catatan khusus.
     4. Sistem menampilkan rincian estimasi biaya real-time, komisi platform, dan hak mitra sebelum memilih metode pembayaran (`QRIS`, `GoPay`, `DANA`, `ShopeePay`, `Transfer VA`, `COD`) dan target waktu ambil.
   - Pesanan baru dibuat dengan nomor urut otomatis (format `PK-YYYYMM-XXX`) dan status awal `menunggu_konfirmasi`.
   - Melalui modal **Detail & Lacak**, mahasiswa memantau 4 tahap progres (**1. Buat Pesanan & Konfirmasi → 2. Proses Cetak → 3. Siap Diambil → 4. Selesai**), melihat riwayat waktu pembaruan, mengedit atau membatalkan pesanan (selama masih `menunggu_konfirmasi`), menghapus riwayat, atau membuka form **Laporkan Kendala**.

2. **Alur Operasional Mitra Percetakan**:
   - Pada **Panel Mitra Percetakan**, pengelola dapat berpindah antar akun mitra yang terdaftar (mis. *Berkah Digital Copy & Print*, *Mitra Teknik Express Print*, *Prima Copy Center*, *Ganesha Print & Stationeries*).
   - Mitra dapat mengubah status toko (`BUKA` / `TUTUP`), membuka form edit profil & konfigurasi tarif (tarif B/W, warna, jilid lakban, spiral kawat), memantau 4 metrik ringkas (antrean berjalan, pesanan selesai, saldo siap dicairkan 90%, form pencairan saldo ke rekening dengan batas minimum Rp 50.000), dan memfilter pesanan masuk.
   - Pada setiap kartu pesanan, mitra mengeksekusi transisi status berurutan:
     - `menunggu_konfirmasi` → **Terima & Mulai Cetak** (`diproses`) atau **Tolak Pesanan** (`dibatalkan`).
     - `diproses` → **Tandai Selesai Cetak** (`siap_diambil`).
     - `siap_diambil` → **Serahkan ke Mahasiswa & Tutup Pesanan** (`selesai`), yang otomatis menambah hitungan order selesai, total pendapatan, dan saldo dapat dicairkan mitra sekaligus mengurangi jumlah antrean.

3. **Alur Pengawasan Admin, Katalog Tarif & Simulator Bisnis**:
   - **Dashboard Admin Platform** menampilkan 4 kartu KPI finansial (Total GMV, Komisi Kotor Platform, Penyaluran ke Mitra 90%, dan Mitra Aktif) serta 4 sub-tab:
     - *Transaksi*: Tabel seluruh order lengkap dengan nilai total, komisi platform, hak mitra, dan status.
     - *Mitra (CRUD)*: Daftar kartu mitra dengan tombol buka/tutup toko, hapus mitra, dan modal pendaftaran mitra baru.
     - *Komisi & Tarif*: Pengaturan persentase komisi global (`1%–50%`) beserta simulasi langsung dampak pada contoh pesanan Rp 20.000.
     - *Tiket Kendala (CRUD)*: Daftar keluhan dari mahasiswa dengan kontrol ubah status (`terbuka`, `investigasi`, `selesai`, `ditolak`), tampilan solusi admin, dan hapus tiket.
   - **Katalog Tarif Cetak (CRUD)**: Manajemen master layanan cetak dalam kategori *Kertas*, *Warna & Tinta*, *Jilid Buku*, dan *Finishing & Laminasi*—mendukung filter kategori, tambah layanan baru, edit harga/deskripsi inline, toggle status `AKTIF`/`NON-AKTIF`, dan hapus layanan.
   - **Simulasi Pendapatan & Model Finansial**: Kalkulator interaktif dengan panel rumus komisi per transaksi, proyeksi bulanan, slider parameter (volume 20–2.000 pesanan/bulan, rata-rata nilai pesanan Rp 5.000–Rp 100.000, komisi 5%–25%), input beban operasional (hosting server, promosi, fee QRIS %), serta kartu proyeksi **Laba Bersih (Net Profit)**, status *Profitabel/Defisit*, dan **Titik Impas (Break-Even Point / BEP)**.

### B. Identitas Visual & Tata Letak

- **Arah Estetika**: *Clean Utilitarian SaaS Campus Platform*—antarmuka fungsional yang padat informasi namun rapi dengan sudut membulat (`rounded-xl` / `rounded-2xl` / `rounded-3xl`) dan pemisahan peran yang tegas.
- **Palet Warna & Tema**:
  - Latar utama terang `#f8fafc` (`bg-slate-50`) dan mode gelap `dark:bg-slate-950` dengan dukungan variant `.dark`.
  - Warna primer aksi menggunakan biru (`blue-600` / `blue-700`), indikator sukses/profit menggunakan zamrud (`emerald-600`), peringatan/proses menggunakan kuning amber (`amber-600`), dan hero section menggunakan latar gelap kontras (`slate-900`) dengan ilustrasi maskot kucing.
- **Tipografi**:
  - Huruf utama menggunakan *Plus Jakarta Sans* untuk keterbacaan UI modern.
  - Angka finansial, nomor order, dan statistik menggunakan kelas utilitas `.font-mono-num` (*JetBrains Mono* dengan `tabular-nums`) agar kolom nominal rupiah sejajar rapi.
- **Umpan Balik Interaktif**:
  - Setiap operasi CRUD (buat/ubah/hapus pesanan, ubah status, simpan profil mitra, pencairan saldo, tambah/ubah layanan, kirim tiket kendala, simpan kebijakan komisi) memicu **Toast Notification** otomatis di sudut kanan bawah (`success`, `info`, `warning`, `error`) yang hilang otomatis setelah 4 detik atau dapat ditutup manual.

---

## 3. Keputusan Produk & Arsitektur Utama

- **Manajemen State & Persistensi Data**:
  - *Pendekatan Saat Ini*: Menggunakan React Context API terpusat yang disinkronkan secara otomatis ke `localStorage` peramban (`pk_orders`, `pk_mitras`, `pk_services`, `pk_tickets`, `pk_commission`, `pk_user`) dengan data awal (*seed data*) yang siap diuji.
  - *Alasan*: Memungkinkan seluruh alur CRUD lintas 3 peran berjalan instan di peramban tanpa latensi server atau kebutuhan konfigurasi database eksternal saat tahap prototipe/validasi.
  - *Konsekuensi*: Data bersifat lokal per peramban dan tidak tersinkronisasi antar perangkat berbeda sebelum dihubungkan ke backend/database persisten.
- **Pergantian Peran Instan (Persona Switcher)**:
  - *Pendekatan Saat Ini*: Pengguna dapat beralih langsung antara peran **Mahasiswa**, **Mitra Percetakan**, dan **Admin Platform** melalui bar atas maupun header tanpa login terpisah.
  - *Alasan*: Memudahkan pengujian dan demonstrasi alur ujung-ke-ujung (misalnya membuat pesanan sebagai Mahasiswa lalu langsung menerimanya sebagai Mitra dan memeriksa komisi sebagai Admin).
- **Kalkulasi Tarif & Komisi Dinamis**:
  - *Pendekatan Saat Ini*: Harga cetak dihitung per mitra berdasarkan jenis warna, tambahan ukuran/gramatur kertas, diskon cetak bolak-balik (*duplex*), serta biaya jilid dikalikan jumlah salinan; sementara komisi platform dihitung dinamis mengikuti pengaturan `platformCommissionPercent` di Admin (bawaan `10%`).

---

## 4. Arsitektur Teknis & Strategi Data

### A. Diagram Arsitektur Sistem

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    PUSAT STATE & PERSISTENSI (Client)                     │
│  AppProvider (React Context) <──────> Browser localStorage (pk_*)         │
│  [orders, mitras, services, tickets, commissionSettings, currentUser]     │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │ Menyediakan state & aksi CRUD
                                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         SHELL APLIKASI (MainLayout)                       │
│  ┌─────────────────────────┐   ┌───────────────────────────────────────┐  │
│  │ Sticky Header (Navigasi)│   │ Role Switcher & Feature Tab Bar       │  │
│  └─────────────────────────┘   └───────────────────────────────────────┘  │
└───────┬───────────────┬──────────────┬───────────────┬───────────────┬────┘
        │               │              │               │               │
        ▼               ▼              ▼               ▼               ▼
┌──────────────┐ ┌────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐
│   Portal     │ │   Panel    │ │  Dashboard  │ │   Katalog   │ │ Simulasi  │
│  Mahasiswa   │ │   Mitra    │ │    Admin    │ │ Tarif CRUD  │ │  Komisi   │
└──────┬───────┘ └────────────┘ └─────────────┘ └─────────────┘ └───────────┘
       │ Memicu Modal Interaktif
       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  [CreateOrderModal]  │  [OrderTrackerModal]  │  [ReportIssueModal]        │
└───────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                  [ToastContainer] — Notifikasi Status Global              │
└───────────────────────────────────────────────────────────────────────────┘
```

### B. Stack Teknologi Terpasang

- **Frontend Framework**: React 19 + TypeScript + Vite 8.
- **Styling & Ikon**: Tailwind CSS v4 (`@tailwindcss/vite`) + Lucide React untuk ikonografi antarmuka.
- **Dependensi Tambahan di Konfigurasi**: `motion` tersedia untuk animasi, serta `express`, `dotenv`, dan `@google/genai` tercantum di manifes proyek meski aplikasi saat ini berjalan murni sebagai SPA di sisi klien tanpa rute server aktif atau panggilan AI.

### C. Model Data & Entitas Utama

1. **`Order` (Pesanan Cetak)**: Menyimpan nomor order, identitas mahasiswa, ID & lokasi mitra, metadata dokumen (`documentTitle`, `fileSize`, `pageCount`, `copies`), spesifikasi cetak (`colorType`, `paperSize`, `paperWeight`, `duplex`, `binding`, `notes`), rincian finansial (`unitPrintPrice`, `unitBindingPrice`, `subtotal`, `platformFee`, `mitraEarnings`, `totalAmount`), metode & status pembayaran, status alur beserta `statusHistory[]`, dan `pickupDeadline`.
2. **`Mitra` (Mitra Percetakan)**: Menyimpan profil usaha, area kampus, jam operasional, status buka/tutup, rating, `queueCount`, `totalCompletedOrders`, `totalEarnings`, `pendingBalance`, layanan yang ditawarkan, serta objek `pricing` khusus toko (`bwPerPage`, `colorPerPage`, `duplexDiscountPerPage`, dan harga 5 tipe jilid).
3. **`PrintServiceItem` (Item Katalog Layanan)**: Menyimpan kode layanan, kategori (`kertas`, `warna`, `jilid`, `finishing`), nama, deskripsi, tarif dasar, satuan, dan status aktif.
4. **`IssueTicket` (Tiket Kendala)**: Menyimpan referensi `orderId`/`orderNumber`, pelapor & perannya, kategori masalah (`salah_cetak`, `keterlambatan`, `kertas_rusak`, `salah_jilid`, `pembayaran`, `lainnya`), deskripsi, status penanganan (`terbuka`, `investigasi`, `selesai`, `ditolak`), dan catatan solusi.
5. **`CommissionSettings` & `UserProfile`**: Menyimpan persentase komisi platform (default `10%`), minimum order (`Rp 2.000`), promo diskon order pertama (`Rp 2.000`), batas pencairan saldo minimum mitra (`Rp 50.000`), hotline bantuan, serta profil mahasiswa aktif.

### D. Aturan Perhitungan & Transisi State

- **Formula Harga Pesanan**:
  - Harga dasar halaman diambil dari `mitra.pricing` (`bwPerPage`, `colorPerPage`, atau rata-rata untuk `mixed`).
  - Penyesuaian kertas: `+Rp 50` untuk `F4`, `×2` untuk `A3`; `+Rp 100` untuk `80gr`, `+Rp 250` untuk `100gr`.
  - Diskon cetak bolak-balik (*duplex*): dikurangi `duplexDiscountPerPage` (minimal `Rp 100`/halaman).
  - Total: `(pageCount × pricePerPage × copies) + (bindingPrice × copies)`.
- **Formula Komisi & Bagi Hasil**:
  - `platformFee = Math.round((subtotal × platformCommissionPercent) / 100)`
  - `mitraEarnings = subtotal - platformFee`
- **Sinkronisasi Antrean & Saldo Mitra**:
  - Saat pesanan dibuat, `queueCount` mitra bertambah `+1`.
  - Saat status berubah ke `selesai`, `queueCount` berkurang `-1`, `totalCompletedOrders` bertambah `+1`, serta `totalEarnings` dan `pendingBalance` mitra bertambah sebesar `mitraEarnings`.
  - Saat pesanan dibatalkan atau dihapus sebelum selesai, `queueCount` berkurang `-1`.
  - Saat mitra mencairkan saldo (`withdrawMitraBalance`), sistem memvalidasi kecukupan `pendingBalance` dan batas minimum `payoutMinimum` sebelum memotong saldo.
