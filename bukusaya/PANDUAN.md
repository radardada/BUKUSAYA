# BUKU SAYA - Tahap 2: Katalog Firestore + Beli + My Book + Admin Lengkap

## Yang baru di Tahap 2 (dibanding Tahap 1)
- Navigasi bawah 3 tab: **Menu** (katalog), **Akun** (profil+saldo), **My Book** (buku dibeli)
- Buku sekarang di Firestore (bukan data contoh), admin kelola dari `/admin`
- Gambar sampul & file buku (PDF/EPUB) disimpan di **Supabase Storage**
- **Beli buku pakai saldo** — dipotong di server, tidak bisa dicurangi dari browser
- **My Book**: klik buku yang sudah dibeli -> tombol **Baca di sini** (reader dalam app) dan **Unduh** (link sementara, kedaluwarsa 5 menit)
- **Wishlist** (simpan buku), tampil di tab Akun
- **Rating & ulasan** — hanya pembeli yang sudah beli buku itu yang boleh menilai
- **Riwayat transaksi** gabungan (top up + pembelian) di tab Akun
- **Event diskon** — admin atur diskon %/nominal per buku, harga coret otomatis muncul
- **Kode voucher** 4 jenis: potongan %, potongan Rp, buku gratis, saldo gratis
- Pencarian, filter kategori, dan urutkan (termurah/termahal/rating/laris) di tab Menu

## Status pengujian (baca ini)
- **Teruji otomatis (`npm test`, 44 tes lulus):** logika saldo, event diskon, voucher,
  dan seluruh alur API (beli, redeem voucher, ulasan, wishlist, admin) memakai Firestore
  PALSU di memori. Termasuk kasus curang yang sengaja dicoba: beli 2x buku sama, approve
  top up 2x, pakai voucher setelah kuota habis, harga buku gratis, dan lainnya.
- **3 bug nyata ditemukan & diperbaiki lewat proses ini** (bukan cuma tes ditulis ulang):
  1. Harga Rp0 (buku gratis lewat voucher) sempat ditolak sistem — sudah benar sekarang.
  2. Bentuk URL transaksi Firestore salah — sudah benar sekarang.
  3. Admin menyimpan `imgPath`, tapi toko membaca `imgUrl` — sudah disamakan.
- **Belum teruji:** koneksi ke Firebase & Supabase SUNGGUHAN, dan tampilan di browser asli.
  Kemungkinan ada perbaikan kecil di percobaan pertama. Kirim pesan error yang muncul kalau ada.

## Batasan penting: paket Vercel Hobby (gratis)
Vercel Hobby membatasi **maksimal 12 Serverless Functions** per deployment — setiap file
di folder `api/` dihitung 1 function. Proyek ini sudah tepat di angka 12, jadi:
- **Jangan menambah file baru di `api/`** tanpa menggabungkannya ke file yang sudah ada
  (lihat `api/admin-promo.js` sebagai contoh: 1 file menangani 2 jenis data lewat parameter `jenis`).
- Kalau butuh fitur API baru, tambahkan sebagai aksi baru di file yang sudah ada, atau upgrade
  ke paket Vercel Pro (berbayar) yang tidak punya batas ini.
- Error yang muncul kalau kelebihan: *"No more than 12 Serverless Functions can be added to a
  Deployment on the Hobby plan."* — build akan gagal total (bukan cuma warning).



### 1. Firebase (kalau belum, sama seperti Tahap 1)
1. console.firebase.google.com -> buat proyek.
2. Authentication -> Get started -> aktifkan **Email/Password**.
3. Firestore Database -> Create database (mode production).
4. Tab **Rules** -> tempel isi `firestore.rules` -> Publish.
5. Project settings -> General -> Web app -> salin apiKey, authDomain, projectId, appId.
6. Project settings -> Service accounts -> Generate new private key -> file JSON (RAHASIA).

### 2. Supabase (BARU di Tahap 2)
1. supabase.com -> buat proyek baru (tunggu beberapa menit sampai siap).
2. Menu **Storage** (ikon kotak) -> buat 2 bucket:
   - `sampul` -> centang **Public bucket** (supaya gambar bisa tampil langsung ke pembeli)
   - `file-buku` -> **jangan** dicentang public (file buku harus privat, hanya lewat link sementara)
3. Project Settings -> **API** -> salin:
   - **Project URL** -> jadi `SUPABASE_URL`
   - **service_role key** (bukan `anon`!) -> jadi `SUPABASE_SERVICE_ROLE_KEY`, RAHASIA.

### 3. Indeks Firestore (wajib, lebih banyak dari Tahap 1)
Saat pertama buka /akun, /admin, /mybook, /buku, console browser (F12 -> tab Console) akan
menampilkan tautan "The query requires an index". Klik tiap tautan -> Create index -> tunggu
beberapa menit. Perkiraan indeks yang dibutuhkan:
- `topups`: uid + dibuat, status + dibuat
- `ledger`: uid + waktu
- `kepemilikan`: uid + dibeli
- `ulasan`: bukuId + waktu
- `wishlist`: uid (biasa tidak perlu indeks komposit)

### 4. Jadikan dirimu admin (sama seperti Tahap 1)
1. Daftar dulu lewat `/login`.
2. Firebase Console -> Authentication -> Users -> salin **UID**.
3. Firestore -> collection `admins` -> Document ID = UID -> field `aktif` (boolean) = true.

### 5. Vercel
1. Upload folder ini ke GitHub (`.env` tidak ikut, sudah di `.gitignore`).
2. vercel.com -> Add New Project -> pilih repo. Framework: **Other**. Output directory: `public`.
3. Settings -> Environment Variables -> isi SEMUA yang ada di `.env.example`, termasuk
   yang baru: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy. Tambahkan domain Vercel ke Firebase: Authentication -> Settings -> Authorized domains.

### 6. Coba
1. Buka `/admin` (dengan akun admin) -> tab **Buku** -> Tambah buku. Isi judul, harga,
   upload gambar sampul, dan (opsional) upload file PDF/EPUB serta isi "konten baca online".
2. Buka `/` (tab Menu) -> buku baru harus muncul.
3. Klik buku -> beli pakai saldo (top up dulu lewat tab Akun kalau saldo kurang).
4. Buka tab **My Book** -> buku yang dibeli muncul -> klik -> coba **Baca di sini** dan **Unduh**.
5. Di admin, coba buat event diskon dan voucher, lalu lihat efeknya di halaman buku.

## Skema data Firestore (untuk referensi)
- `books/{id}` — title, author, cat, price, rating, color, desc, imgUrl, filePath, fileNama,
  isiBaca, eventId, aktif, terjual, jumlahUlasan
- `events/{id}` — nama, tipe (persen/potongan), nilai, status, mulai, selesai, kategori[]
- `vouchers/{kode}` — tipe (persen/potongan/gratis/saldo), nilai, kuota, terpakai, aktif
- `users/{uid}` — saldo, topupMenunggu (hanya ditulis server)
- `topups/{id}`, `ledger/{id}` — sama seperti Tahap 1
- `kepemilikan/{uid_bukuId}` — bukuId, hargaDibayar, dibeli, progres
- `ulasan/{uid_bukuId}` — bintang, teks, nama, waktu
- `wishlist/{uid_bukuId}` — bukuId, waktu
- `voucher-pakai/{kode_uid}` — anti dobel-klaim voucher saldo
- `admins/{uid}` — hanya dibuat manual lewat Console

## Keamanan yang perlu kamu tahu
- Semua penulisan data uang/kepemilikan/voucher HANYA lewat server (`api/`), tidak pernah
  langsung dari browser (`firestore.rules` menutup total write dari klien).
- `SUPABASE_SERVICE_ROLE_KEY` dan `FIREBASE_PRIVATE_KEY` adalah kunci penuh — jangan
  pernah kirim ke siapa pun, taruh di GitHub, atau screenshot.
- File buku disimpan di bucket privat; link unduh kedaluwarsa 5 menit dan hanya dibuat
  setelah server memverifikasi pembeli benar-benar sudah membayar.

## Yang belum ada / ide lanjutan
- Payment gateway otomatis (QRIS/e-wallet) — saat ini top up masih manual+konfirmasi admin.
- Reader per-halaman presisi (saat ini progres baca masih perkiraan sederhana).
- Notifikasi (email/push) saat top up disetujui atau ada event diskon baru.
- Statistik penjualan lebih detail di admin (grafik, filter tanggal).
