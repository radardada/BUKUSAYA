// POST /api/admin-voucher  { aksi: "simpan" | "hapus", voucher: {...} }  -> HANYA ADMIN
// tipe: "persen" | "potongan" | "gratis" (buku gratis saat checkout) | "saldo" (menambah saldo langsung)
import { verifikasiPengguna, adalahAdmin, transaksi, baca, balas } from "../lib/firebase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return balas(res, 405, { pesan: "Metode tidak diizinkan." });
  const user = await verifikasiPengguna(req);
  if (!user) return balas(res, 401, { pesan: "Silakan login dulu." });
  if (!(await adalahAdmin(user.uid))) return balas(res, 403, { pesan: "Khusus admin." });

  const { aksi, voucher } = req.body || {};
  const kode = String(voucher?.kode || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,24}$/.test(kode)) return balas(res, 400, { pesan: "Kode voucher 3-24 huruf/angka." });

  try {
    if (aksi === "hapus") { await transaksi(async (t) => t.set(`vouchers/${kode}`, { kode, aktif: false, terpakai: (await baca(`vouchers/${kode}`))?.terpakai || 0 })); return balas(res, 200, { ok: true }); }
    if (aksi === "simpan") {
      const tipe = ["persen", "potongan", "gratis", "saldo"].includes(voucher.tipe) ? voucher.tipe : null;
      if (!tipe) return balas(res, 400, { pesan: "Tipe voucher tidak dikenal." });
      const perluNilai = tipe !== "gratis";
      const nilai = Number(voucher.nilai);
      if (perluNilai && (!Number.isFinite(nilai) || nilai <= 0)) return balas(res, 400, { pesan: "Nilai voucher harus lebih dari 0." });
      const lama = await baca(`vouchers/${kode}`);
      const data = { kode, tipe, nilai: perluNilai ? nilai : 0, aktif: voucher.aktif !== false,
        kuota: Number.isFinite(Number(voucher.kuota)) ? Number(voucher.kuota) : null, terpakai: lama?.terpakai || 0,
        mulai: voucher.mulai ? new Date(voucher.mulai).getTime() : null, selesai: voucher.selesai ? new Date(voucher.selesai).getTime() : null,
        catatan: String(voucher.catatan || "").slice(0, 200) };
      await transaksi(async (t) => t.set(`vouchers/${kode}`, data));
      return balas(res, 200, { ok: true });
    }
    return balas(res, 400, { pesan: "Aksi tidak dikenal." });
  } catch (e) { return balas(res, 500, { pesan: "Gagal menyimpan voucher." }); }
}
