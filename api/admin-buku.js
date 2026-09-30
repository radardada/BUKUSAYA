// POST /api/admin-buku  { aksi: "simpan" | "hapus", buku: {...} }  -> HANYA ADMIN
// Gambar/file diupload TERPISAH lewat /api/admin-upload lalu path-nya dikirim ke sini.
import { verifikasiPengguna, adalahAdmin, transaksi, baca, balas } from "../lib/firebase.js";

function bersihkan(b) {
  const id = String(b.id || "").trim();
  if (!/^[a-z0-9-]{1,60}$/.test(id)) throw Object.assign(new Error("ID buku harus huruf kecil, angka, atau strip."), { kode: 400 });
  const title = String(b.title || "").trim(), author = String(b.author || "").trim(), cat = String(b.cat || "").trim();
  const price = Number(b.price), rating = Number(b.rating) || 0;
  if (!title || !author || !cat) throw Object.assign(new Error("Judul, penulis, dan kategori wajib diisi."), { kode: 400 });
  if (!Number.isInteger(price) || price < 0) throw Object.assign(new Error("Harga harus angka bulat 0 atau lebih."), { kode: 400 });
  return { id, title, author, cat, price, rating: Math.min(5, Math.max(0, rating)),
    color: /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : "#2F5D8A",
    desc: String(b.desc || "").trim().slice(0, 1000),
    imgUrl: typeof b.imgUrl === "string" ? b.imgUrl : null,
    filePath: typeof b.filePath === "string" ? b.filePath : null,
    fileNama: typeof b.fileNama === "string" ? b.fileNama.slice(0, 120) : null,
    eventId: typeof b.eventId === "string" ? b.eventId : null,
    aktif: b.aktif !== false };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return balas(res, 405, { pesan: "Metode tidak diizinkan." });
  const user = await verifikasiPengguna(req);
  if (!user) return balas(res, 401, { pesan: "Silakan login dulu." });
  if (!(await adalahAdmin(user.uid))) return balas(res, 403, { pesan: "Khusus admin." });

  const { aksi, buku } = req.body || {};
  try {
    if (aksi === "hapus") {
      const id = String(buku?.id || "");
      if (!/^[a-z0-9-]{1,60}$/.test(id)) return balas(res, 400, { pesan: "ID buku tidak valid." });
      await transaksi(async (t) => { const d = await t.baca(`books/${id}`); if (d) t.set(`books/${id}`, { ...d, aktif: false }); });
      return balas(res, 200, { ok: true });
    }
    if (aksi === "simpan") {
      const data = bersihkan(buku || {});
      const lama = await baca(`books/${data.id}`);
      await transaksi(async (t) => t.set(`books/${data.id}`, { ...(lama || {}), ...data, terjual: lama?.terjual || 0, jumlahUlasan: lama?.jumlahUlasan || 0, rating: lama?.jumlahUlasan ? lama.rating : data.rating, diubah: new Date() }));
      return balas(res, 200, { ok: true, id: data.id });
    }
    return balas(res, 400, { pesan: "Aksi tidak dikenal." });
  } catch (e) { return balas(res, e.kode || 500, { pesan: e.kode ? e.message : "Gagal menyimpan buku." }); }
}
