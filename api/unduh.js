// POST /api/unduh  { bukuId }  -> hanya untuk pembeli, membuat link unduh sementara dari Supabase (privat)
import { verifikasiPengguna, baca, balas } from "../lib/firebase.js";
import { linkUnduhSementara } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return balas(res, 405, { pesan: "Metode tidak diizinkan." });
  const user = await verifikasiPengguna(req);
  if (!user) return balas(res, 401, { pesan: "Silakan login dulu." });
  const bukuId = req.body?.bukuId;
  if (typeof bukuId !== "string" || !/^[\w-]{1,60}$/.test(bukuId)) return balas(res, 400, { pesan: "Buku tidak valid." });

  const milik = await baca(`kepemilikan/${user.uid}_${bukuId}`);
  if (!milik) return balas(res, 403, { pesan: "Kamu belum memiliki buku ini." });
  const buku = await baca(`books/${bukuId}`);
  if (!buku?.filePath) return balas(res, 404, { pesan: "File buku belum tersedia." });

  try { return balas(res, 200, { url: await linkUnduhSementara(buku.filePath, 300) }); }
  catch (e) { return balas(res, 500, { pesan: e.message }); }
}
