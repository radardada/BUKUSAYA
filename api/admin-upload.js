// POST /api/admin-upload  { jenis: "gambar" | "file", nama, dataBase64 }  -> HANYA ADMIN
// Untuk gambar: mengembalikan { path, url } - simpan url ke field imgUrl buku.
// Untuk file: mengembalikan { path } - simpan ke field filePath buku (privat, diunduh lewat /api/unduh).
import { verifikasiPengguna, adalahAdmin, balas } from "../lib/firebase.js";
import { uploadGambar, uploadFileBuku, urlPublik } from "../lib/supabase.js";

const TIPE_GAMBAR = { jpeg: "image/jpeg", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const TIPE_FILE = { pdf: "application/pdf", epub: "application/epub+zip" };
const MAKS_GAMBAR = 3 * 1024 * 1024, MAKS_FILE = 40 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") return balas(res, 405, { pesan: "Metode tidak diizinkan." });
  const user = await verifikasiPengguna(req);
  if (!user) return balas(res, 401, { pesan: "Silakan login dulu." });
  if (!(await adalahAdmin(user.uid))) return balas(res, 403, { pesan: "Khusus admin." });

  const { jenis, nama, dataBase64 } = req.body || {};
  if (!["gambar", "file"].includes(jenis)) return balas(res, 400, { pesan: "Jenis upload tidak dikenal." });
  const ext = String(nama || "").split(".").pop().toLowerCase();
  const peta = jenis === "gambar" ? TIPE_GAMBAR : TIPE_FILE;
  const contentType = peta[ext];
  if (!contentType) return balas(res, 400, { pesan: "Format file tidak didukung." });
  if (typeof dataBase64 !== "string") return balas(res, 400, { pesan: "Data file kosong." });

  let buffer;
  try { buffer = Buffer.from(dataBase64, "base64"); } catch { return balas(res, 400, { pesan: "Data file rusak." }); }
  const maks = jenis === "gambar" ? MAKS_GAMBAR : MAKS_FILE;
  if (buffer.length > maks) return balas(res, 400, { pesan: `Ukuran file maksimal ${Math.round(maks / 1024 / 1024)} MB.` });

  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  try {
    if (jenis === "gambar") { await uploadGambar(path, buffer, contentType); return balas(res, 200, { path, url: urlPublik(path) }); }
    await uploadFileBuku(path, buffer, contentType);
    return balas(res, 200, { path });
  } catch (e) { return balas(res, 500, { pesan: e.message }); }
}
