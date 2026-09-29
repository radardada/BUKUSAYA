// POST /api/progres  { bukuId, progres }  -> simpan posisi terakhir baca (0..1), hanya milik sendiri
import { verifikasiPengguna, baca, transaksi, balas } from "../lib/firebase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return balas(res, 405, { pesan: "Metode tidak diizinkan." });
  const user = await verifikasiPengguna(req);
  if (!user) return balas(res, 401, { pesan: "Silakan login dulu." });
  const { bukuId, progres } = req.body || {};
  if (typeof bukuId !== "string" || !/^[\w-]{1,60}$/.test(bukuId)) return balas(res, 400, { pesan: "Buku tidak valid." });
  if (typeof progres !== "number" || progres < 0 || progres > 1) return balas(res, 400, { pesan: "Progres harus 0 sampai 1." });

  const path = `kepemilikan/${user.uid}_${bukuId}`;
  const ada = await baca(path);
  if (!ada) return balas(res, 403, { pesan: "Kamu belum memiliki buku ini." });
  try { await transaksi(async (t) => { const d = await t.baca(path); t.set(path, { ...d, progres, progresDiubah: new Date() }); }); return balas(res, 200, { ok: true }); }
  catch (e) { return balas(res, 500, { pesan: "Gagal menyimpan progres." }); }
}
