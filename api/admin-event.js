// POST /api/admin-event  { aksi: "simpan" | "hapus", event: {...} }  -> HANYA ADMIN
import { verifikasiPengguna, adalahAdmin, transaksi, balas } from "../lib/firebase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return balas(res, 405, { pesan: "Metode tidak diizinkan." });
  const user = await verifikasiPengguna(req);
  if (!user) return balas(res, 401, { pesan: "Silakan login dulu." });
  if (!(await adalahAdmin(user.uid))) return balas(res, 403, { pesan: "Khusus admin." });

  const { aksi, event } = req.body || {};
  const id = String(event?.id || "").trim();
  if (!/^[a-z0-9-]{1,60}$/.test(id)) return balas(res, 400, { pesan: "ID event tidak valid." });

  try {
    if (aksi === "hapus") { await transaksi(async (t) => t.set(`events/${id}`, { id, status: "nonaktif" })); return balas(res, 200, { ok: true }); }
    if (aksi === "simpan") {
      const nama = String(event.nama || "").trim(); if (!nama) return balas(res, 400, { pesan: "Nama event wajib diisi." });
      const tipe = event.tipe === "potongan" ? "potongan" : "persen";
      const nilai = Number(event.nilai); if (!Number.isFinite(nilai) || nilai <= 0) return balas(res, 400, { pesan: "Nilai diskon harus lebih dari 0." });
      const data = { id, nama, tipe, nilai, status: event.status === "aktif" ? "aktif" : "nonaktif",
        mulai: event.mulai ? new Date(event.mulai).getTime() : null, selesai: event.selesai ? new Date(event.selesai).getTime() : null,
        kategori: Array.isArray(event.kategori) ? event.kategori.slice(0, 20) : [] };
      await transaksi(async (t) => t.set(`events/${id}`, data));
      return balas(res, 200, { ok: true });
    }
    return balas(res, 400, { pesan: "Aksi tidak dikenal." });
  } catch (e) { return balas(res, 500, { pesan: "Gagal menyimpan event." }); }
}
