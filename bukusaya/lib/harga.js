// Perhitungan harga final: harga dasar -> event diskon aktif -> voucher (kalau ada).
// Semua fungsi murni, tidak menyentuh Firestore, supaya gampang diuji.

export function hargaSetelahEvent(buku, event) {
  if (!event || event.status !== "aktif") return buku.price;
  const now = Date.now();
  if (event.mulai && now < event.mulai) return buku.price;
  if (event.selesai && now > event.selesai) return buku.price;
  if (Array.isArray(event.kategori) && event.kategori.length && !event.kategori.includes(buku.cat)) return buku.price;
  if (Array.isArray(event.bukuId) && event.bukuId.length && !event.bukuId.includes(buku.id)) return buku.price;
  const potongan = event.tipe === "persen" ? Math.round(buku.price * (event.nilai / 100)) : event.nilai;
  return Math.max(0, buku.price - Math.min(potongan, buku.price));
}

// voucher.tipe: "persen" | "potongan" | "gratis" | "saldo"
export function terapkanVoucher(hargaSaatIni, voucher) {
  if (!voucher) return { hargaAkhir: hargaSaatIni, gratis: false };
  if (voucher.tipe === "gratis") return { hargaAkhir: 0, gratis: true };
  if (voucher.tipe === "persen") { const p = Math.round(hargaSaatIni * (voucher.nilai / 100)); return { hargaAkhir: Math.max(0, hargaSaatIni - p), gratis: false }; }
  if (voucher.tipe === "potongan") return { hargaAkhir: Math.max(0, hargaSaatIni - voucher.nilai), gratis: hargaSaatIni <= voucher.nilai };
  return { hargaAkhir: hargaSaatIni, gratis: false }; // tipe "saldo" tidak memotong harga, lihat lib/voucher.js
}

export function validasiVoucher(voucher, now = Date.now()) {
  if (!voucher) return { ok: false, pesan: "Kode voucher tidak ditemukan." };
  if (voucher.aktif === false) return { ok: false, pesan: "Voucher ini sudah tidak aktif." };
  if (voucher.mulai && now < voucher.mulai) return { ok: false, pesan: "Voucher belum berlaku." };
  if (voucher.selesai && now > voucher.selesai) return { ok: false, pesan: "Voucher sudah kedaluwarsa." };
  if (Number.isFinite(voucher.kuota) && voucher.terpakai >= voucher.kuota) return { ok: false, pesan: "Kuota voucher sudah habis." };
  return { ok: true };
}
