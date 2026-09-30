// Klien Supabase Storage sisi-SERVER, memakai service_role key.
// PENTING: service_role key HANYA boleh dipakai di sini (folder api/, jalan di server Vercel).
// Jangan pernah kirim SUPABASE_SERVICE_ROLE_KEY ke browser.
const URL_BASE = () => process.env.SUPABASE_URL;
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_GAMBAR = "sampul";   // publik: siapa saja boleh lihat
const BUCKET_FILE = "file-buku";  // privat: hanya lewat link sementara setelah dibeli

function headers(extra = {}) {
  const k = KEY();
  return { Authorization: `Bearer ${k}`, apikey: k, ...extra };
}

async function upload(bucket, path, buffer, contentType) {
  const r = await fetch(`${URL_BASE()}/storage/v1/object/${bucket}/${path}`, {
    method: "POST", headers: headers({ "Content-Type": contentType, "x-upsert": "true" }), body: buffer,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || "Gagal upload ke Supabase.");
  return path;
}

export function urlPublik(path) { return `${URL_BASE()}/storage/v1/object/public/${BUCKET_GAMBAR}/${path}`; }

export async function uploadGambar(path, buffer, contentType) { return upload(BUCKET_GAMBAR, path, buffer, contentType); }
export async function uploadFileBuku(path, buffer, contentType) { return upload(BUCKET_FILE, path, buffer, contentType); }

export async function hapusObjek(bucket, path) {
  const r = await fetch(`${URL_BASE()}/storage/v1/object/${bucket}`, { method: "DELETE", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ prefixes: [path] }) });
  if (!r.ok) throw new Error("Gagal hapus file di Supabase.");
}

// Link sementara (kedaluwarsa) untuk unduh file buku privat. Hanya dibuat SETELAH server memastikan pembeli sudah beli.
export async function linkUnduhSementara(path, detikBerlaku = 300) {
  const r = await fetch(`${URL_BASE()}/storage/v1/object/sign/${BUCKET_FILE}/${path}`, {
    method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ expiresIn: detikBerlaku }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.message || "Gagal membuat link unduh.");
  return `${URL_BASE()}/storage/v1${j.signedURL}`;
}
