# BUKU SAYA - Tahap 1: Login + Saldo + Top Up Manual

## Yang sudah ada di tahap ini
- Login / daftar / lupa kata sandi (Firebase Authentication)
- Saldo pembeli, realtime (Firestore)
- Top up manual: pembeli buat permintaan -> transfer ke nomor kamu -> admin setujui/tolak
- Kode unik 3 digit di tiap top up supaya mudah dicocokkan dengan mutasi
- Riwayat mutasi saldo (ledger) yang tidak bisa diubah dari browser
- Aturan keamanan Firestore: browser TIDAK bisa mengubah saldo
- Panel admin untuk konfirmasi top up

## Yang BELUM ada (tahap berikutnya)
Beli buku dengan saldo, unduh/baca online, Supabase Storage untuk gambar dan file buku,
review, event diskon, voucher, dan 10 fitur user + 10 fitur admin lainnya.
Toko (`index.html`) masih data contoh, belum membaca dari Firestore.

## Status pengujian (baca ini)
- TERUJI otomatis (`npm test`, 26 tes lulus): logika saldo, dan seluruh alur API top up
  memakai Firestore PALSU di memori. Termasuk: tanpa login ditolak, pembeli tidak bisa
  menyetujui top up sendiri, top up tidak bisa disetujui dua kali, batas 3 top up menunggu.
- BELUM TERUJI: koneksi ke Firebase SUNGGUHAN dan tampilan halaman di browser. Bentuk URL
  REST Firestore ditulis dari ingatan, tanpa akses internet untuk memeriksanya. Kemungkinan
  ada perbaikan kecil saat pertama dicoba. Kalau ada error, kirim pesannya ke saya.
- Kalau top up dibuat tapi saat disetujui muncul error 400/404 dari Firestore, itu hampir pasti
  masalah bentuk URL/format di `lib/firebase.js`, dan mudah diperbaiki.

## Langkah pasang

### 1. Firebase
1. console.firebase.google.com -> Add project.
2. Build -> Authentication -> Get started -> aktifkan **Email/Password**.
3. Build -> Firestore Database -> Create database (mode production).
4. Tab **Rules** -> tempel isi `firestore.rules` -> Publish.
5. Project settings -> General -> Your apps -> tambah **Web app** -> salin apiKey, authDomain, projectId, appId.
6. Project settings -> Service accounts -> **Generate new private key** -> file JSON (RAHASIA, jangan di-upload ke GitHub).

### 2. Indeks Firestore (wajib)
Halaman saldo/admin memakai query gabungan. Saat pertama dibuka, console browser (F12) menampilkan
tautan "create index". Klik tautannya, tekan Create, tunggu beberapa menit. Ulangi untuk tiap tautan
(sekitar 4 indeks: topups uid+dibuat, ledger uid+waktu, topups status+dibuat).

### 3. Jadikan dirimu admin
1. Daftar dulu lewat halaman /login.
2. Firebase Console -> Authentication -> Users -> salin **UID** akunmu.
3. Firestore -> Start collection `admins` -> Document ID = UID tadi -> field `aktif` (boolean) = true.
Admin hanya bisa dibuat lewat Console. Tidak ada cara membuat admin dari website (sengaja).

### 4. Vercel
1. Upload folder ini ke GitHub (file `.env` jangan ikut; sudah ada di .gitignore).
2. vercel.com -> Add New Project -> pilih repo. Framework: **Other**. Output directory: `public`.
3. Settings -> Environment Variables -> isi semua yang ada di `.env.example`.
   - FIREBASE_PRIVATE_KEY: tempel isi `private_key` dari file JSON.
4. Deploy. Tambahkan domain Vercel kamu ke Firebase: Authentication -> Settings -> Authorized domains.

### 5. Coba
- /login -> daftar akun pembeli -> /saldo -> buat top up -> buka /admin dengan akun admin -> setujui.

## Keamanan yang perlu kamu tahu
- Saldo hanya diubah oleh server (folder `api/`) yang memeriksa siapa yang login.
- Top up tidak bisa disetujui dua kali (dijaga dalam transaksi).
- Kunci service account HANYA di Vercel env, tidak pernah di kode.
- Nomor tujuan transfer ada di env (PEMBAYARAN_*), bukan di kode.
- Kunci web Firebase memang publik; yang melindungi data adalah `firestore.rules`.
