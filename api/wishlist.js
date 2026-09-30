// POST /api/wishlist  { bukuId, aksi: "tambah" | "hapus" }
import { verifikasiPengguna, transaksi, hapusDok, balas } from "../lib/firebase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return balas(res, 405, { pesan: "Metode tidak diizinkan." });
  const user = await verifikasiPengguna(req);
  if (!user) return balas(res, 401, { pesan: "Silakan login dulu." });
  const { bukuId, aksi } = req.body || {};
  if (typeof bukuId !== "string" || !/^[\w-]{1,60}$/.test(bukuId) || !["tambah", "hapus"].includes(aksi)) return balas(res, 400, { pesan: "Permintaan tidak valid." });
  const path = `wishlist/${user.uid}_${bukuId}`;
  try {
    if (aksi === "tambah") await transaksi(async (t) => t.set(path, { uid: user.uid, bukuId, waktu: new Date() }));
    else await hapusDok(path);
    return balas(res, 200, { ok: true });
  } catch (e) { return balas(res, 500, { pesan: "Gagal memperbarui wishlist." }); }
}
