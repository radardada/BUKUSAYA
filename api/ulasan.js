// POST /api/ulasan  { bukuId, bintang, teks }  -> hanya pembeli yang sudah memiliki buku, 1 ulasan per pembeli per buku
import { verifikasiPengguna, baca, transaksi, balas } from "../lib/firebase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return balas(res, 405, { pesan: "Metode tidak diizinkan." });
  const user = await verifikasiPengguna(req);
  if (!user) return balas(res, 401, { pesan: "Silakan login dulu." });
  const { bukuId, bintang, teks } = req.body || {};
  if (typeof bukuId !== "string" || !/^[\w-]{1,60}$/.test(bukuId)) return balas(res, 400, { pesan: "Buku tidak valid." });
  if (!Number.isInteger(bintang) || bintang < 1 || bintang > 5) return balas(res, 400, { pesan: "Bintang harus 1 sampai 5." });
  const teksBersih = String(teks || "").trim().slice(0, 500);

  const milik = await baca(`kepemilikan/${user.uid}_${bukuId}`);
  if (!milik) return balas(res, 403, { pesan: "Hanya pembeli yang bisa memberi ulasan." });

  try {
    const hasil = await transaksi(async (t) => {
      const buku = await t.baca(`books/${bukuId}`);
      if (!buku) throw Object.assign(new Error("Buku tidak ditemukan."), { kode: 404 });
      const lama = await t.baca(`ulasan/${user.uid}_${bukuId}`);
      const n = buku.jumlahUlasan || 0, totalLama = (buku.rating || 0) * n;
      const totalBaru = lama ? totalLama - lama.bintang + bintang : totalLama + bintang;
      const nBaru = lama ? n : n + 1;
      t.set(`ulasan/${user.uid}_${bukuId}`, { uid: user.uid, nama: user.email.split("@")[0], bukuId, bintang, teks: teksBersih, waktu: new Date() });
      t.set(`books/${bukuId}`, { ...buku, rating: Math.round((totalBaru / nBaru) * 10) / 10, jumlahUlasan: nBaru });
      return { ok: true };
    });
    return balas(res, 200, hasil);
  } catch (e) { return balas(res, e.kode || 500, { pesan: e.kode ? e.message : "Gagal menyimpan ulasan." }); }
}
