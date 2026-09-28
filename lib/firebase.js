// Klien Firestore + Auth sisi-SERVER lewat REST (tanpa firebase-admin), memakai Service Account.
// Variabel lingkungan yang dibutuhkan ada di .env.example
import { createSign } from "node:crypto";

const PROJECT = process.env.FIREBASE_PROJECT_ID;
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const DB = () => `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
// Endpoint aksi transaksi berada di bawah ".../documents:namaAksi"
export const urlAksi = (aksi) => `${DB()}:${aksi}`;

let tokenCache = { value: null, exp: 0 };
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

// Token akses Google untuk service account (dipakai memanggil Firestore dengan hak penuh).
export async function aksesToken() {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.value && tokenCache.exp - 60 > now) return tokenCache.value;
  const header = b64({ alg: "RS256", typ: "JWT" });
  const claim = b64({
    iss: CLIENT_EMAIL, sub: CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  });
  const sign = createSign("RSA-SHA256"); sign.update(`${header}.${claim}`);
  const jwt = `${header}.${claim}.${sign.sign(PRIVATE_KEY).toString("base64url")}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const j = await r.json();
  if (!r.ok) throw new Error("Gagal ambil token Google: " + (j.error_description || j.error));
  tokenCache = { value: j.access_token, exp: now + (j.expires_in || 3600) };
  return tokenCache.value;
}

// Verifikasi ID token milik PENGGUNA yang login (dikirim browser di header Authorization).
export async function verifikasiPengguna(req) {
  const h = req.headers.authorization || "";
  const idToken = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!idToken) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  const u = j.users && j.users[0];
  return u ? { uid: u.localId, email: u.email || "" } : null;
}

// ---- konversi nilai <-> format Firestore ----
export function ke(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(ke) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ke(x)])) } };
}
export function dari(f) {
  if (!f) return null;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("doubleValue" in f) return f.doubleValue;
  if ("stringValue" in f) return f.stringValue;
  if ("booleanValue" in f) return f.booleanValue;
  if ("timestampValue" in f) return f.timestampValue;
  if ("nullValue" in f) return null;
  if ("arrayValue" in f) return (f.arrayValue.values || []).map(dari);
  if ("mapValue" in f) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, x]) => [k, dari(x)]));
  return null;
}
export const dokKeObj = (d) => (d && d.fields ? Object.fromEntries(Object.entries(d.fields).map(([k, x]) => [k, dari(x)])) : null);

async function panggil(path, opsi = {}) {
  const t = await aksesToken();
  const r = await fetch(`${DB()}${path}`, { ...opsi, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(opsi.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error?.message || "Firestore error"); e.status = r.status; throw e; }
  return j;
}

export async function baca(path) {
  try { return dokKeObj(await panggil("/" + path)); } catch (e) { if (e.status === 404) return null; throw e; }
}

// Transaksi atomik: baca beberapa dokumen, hitung, lalu tulis SEMUANYA sekaligus atau tidak sama sekali.
// Jika dokumen berubah di tengah jalan Firestore menolak commit, dan kita ulangi (maks 5x).
export async function transaksi(fn) {
  for (let i = 0; i < 5; i++) {
    const t = await aksesToken();
    const mulai = await (await fetch(urlAksi("beginTransaction"), {
      method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: "{}",
    })).json();
    const trxId = mulai.transaction;
    const baca_ = async (path) => {
      const r = await fetch(`${DB()}/${path}?transaction=${encodeURIComponent(trxId)}`, { headers: { Authorization: `Bearer ${t}` } });
      if (r.status === 404) return null;
      const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || "baca gagal");
      return dokKeObj(j);
    };
    const tulisan = [];
    const ctx = {
      baca: baca_,
      set: (path, data) => tulisan.push({ update: { name: `projects/${PROJECT}/databases/(default)/documents/${path}`, fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, ke(v)])) } }),
    };
    let hasil;
    try { hasil = await fn(ctx); } catch (e) {
      await fetch(urlAksi("rollback"), { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ transaction: trxId }) }).catch(() => {});
      throw e;
    }
    const c = await fetch(urlAksi("commit"), {
      method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ writes: tulisan, transaction: trxId }),
    });
    if (c.ok) return hasil;
    if (c.status !== 409 && c.status !== 400) throw new Error("Commit gagal (" + c.status + ")");
  }
  throw new Error("Server sibuk, coba lagi.");
}

// Cek apakah uid adalah admin: dokumen admins/{uid} harus ada. Hanya bisa dibuat manual di Firebase Console.
export async function adalahAdmin(uid) { return !!(await baca(`admins/${uid}`)); }

export function balas(res, status, data) { res.status(status).setHeader("Cache-Control", "no-store").json(data); }
