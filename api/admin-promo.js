// POST /api/admin-promo  { jenis: "event" | "voucher", aksi: "simpan" | "hapus", data: {...} }  -> HANYA ADMIN
// Digabung dari admin-event.js + admin-voucher.js supaya jumlah Serverless Functions tidak melebihi
// batas paket Vercel Hobby (maks 12 function per deployment).
import { verifikasiPengguna, adalahAdmin, transaksi, baca, balas } from "../lib/firebase.js";

async function simpanEvent(aksi, event) {
  const slug = (x) => String(x || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const id = slug(event?.id) || slug(event?.nama);
  if (!/^[a-z0-9-]{1,60}$/.test(id)) return { status: 400, body: { pesan: "ID event tidak valid." } };
  if (aksi === "hapus") { const lama = await baca(`events/${id}`); await transaksi(async (t) => t.set(`events/${id}`, { ...(lama || {}), id, status: "nonaktif" })); return { status: 200, body: { ok: true } }; }
  if (aksi === "simpan") {
    const nama = String(event.nama || "").trim(); if (!nama) return { status: 400, body: { pesan: "Nama event wajib diisi." } };
    const tipe = event.tipe === "potongan" ? "potongan" : "persen";
    const nilai = Number(event.nilai); if (!Number.isFinite(nilai) || nilai <= 0) return { status: 400, body: { pesan: "Nilai diskon harus lebih dari 0." } };
    const data = { id, nama, tipe, nilai, status: event.status === "aktif" ? "aktif" : "nonaktif",
      mulai: event.mulai ? new Date(event.mulai).getTime() : null, selesai: event.selesai ? new Date(event.selesai).getTime() : null,
      kategori: Array.isArray(event.kategori) ? event.kategori.slice(0, 20) : [] };
    await transaksi(async (t) => t.set(`events/${id}`, data));
    return { status: 200, body: { ok: true } };
  }
  return { status: 400, body: { pesan: "Aksi tidak dikenal." } };
}

async function simpanVoucher(aksi, voucher) {
  const kode = String(voucher?.kode || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,24}$/.test(kode)) return { status: 400, body: { pesan: "Kode voucher 3-24 huruf/angka." } };
  if (aksi === "hapus") {
    const lama = await baca(`vouchers/${kode}`);
    await transaksi(async (t) => t.set(`vouchers/${kode}`, { ...(lama || {}), kode, aktif: false, terpakai: lama?.terpakai || 0 }));
    return { status: 200, body: { ok: true } };
  }
  if (aksi === "simpan") {
    const tipe = ["persen", "potongan", "gratis", "saldo"].includes(voucher.tipe) ? voucher.tipe : null;
    if (!tipe) return { status: 400, body: { pesan: "Tipe voucher tidak dikenal." } };
    const perluNilai = tipe !== "gratis";
    const nilai = Number(voucher.nilai);
    if (perluNilai && (!Number.isFinite(nilai) || nilai <= 0)) return { status: 400, body: { pesan: "Nilai voucher harus lebih dari 0." } };
    const lama = await baca(`vouchers/${kode}`);
    const data = { kode, tipe, nilai: perluNilai ? nilai : 0, aktif: voucher.aktif !== false,
      kuota: voucher.kuota !== null && voucher.kuota !== "" && Number.isFinite(Number(voucher.kuota)) ? Number(voucher.kuota) : null, terpakai: lama?.terpakai || 0,
      mulai: voucher.mulai ? new Date(voucher.mulai).getTime() : null, selesai: voucher.selesai ? new Date(voucher.selesai).getTime() : null,
      catatan: String(voucher.catatan || "").slice(0, 200) };
    await transaksi(async (t) => t.set(`vouchers/${kode}`, data));
    return { status: 200, body: { ok: true } };
  }
  return { status: 400, body: { pesan: "Aksi tidak dikenal." } };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return balas(res, 405, { pesan: "Metode tidak diizinkan." });
  const user = await verifikasiPengguna(req);
  if (!user) return balas(res, 401, { pesan: "Silakan login dulu." });
  if (!(await adalahAdmin(user.uid))) return balas(res, 403, { pesan: "Khusus admin." });

  const { jenis, aksi, data } = req.body || {};
  try {
    let hasil;
    if (jenis === "event") hasil = await simpanEvent(aksi, data);
    else if (jenis === "voucher") hasil = await simpanVoucher(aksi, data);
    else return balas(res, 400, { pesan: "Jenis promo tidak dikenal." });
    return balas(res, hasil.status, hasil.body);
  } catch (e) { return balas(res, 500, { pesan: "Gagal menyimpan " + (jenis === "event" ? "event." : "voucher.") }); }
}
