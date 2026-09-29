// Modul bersama untuk semua halaman: Firebase Auth, helper API, format uang.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, query, where, orderBy, limit }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const rp = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
export const $ = (id) => document.getElementById(id);
export const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const tgl = (v) => { try { return new Date(v?.seconds ? v.seconds * 1000 : v).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); } catch { return ""; } };

export function toast(m) {
  let t = $("toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200);
}

let _auth, _db, _cfg;
export async function siap() {
  if (_auth) return { auth: _auth, db: _db, cfg: _cfg };
  const r = await fetch("/api/config"); _cfg = await r.json();
  if (!_cfg.firebase?.apiKey) throw new Error("Konfigurasi Firebase belum diisi di Vercel (lihat PANDUAN.md).");
  const app = initializeApp(_cfg.firebase); _auth = getAuth(app); _db = getFirestore(app);
  return { auth: _auth, db: _db, cfg: _cfg };
}

// Panggil API server dengan token login pengguna.
export async function api(path, body) {
  const { auth } = await siap();
  const u = auth.currentUser; if (!u) throw new Error("Silakan login dulu.");
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await u.getIdToken()) }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.pesan || "Terjadi kesalahan.");
  return j;
}

export function pesanAuth(e) {
  const m = { "auth/invalid-credential": "Email atau kata sandi salah.", "auth/user-not-found": "Email belum terdaftar.", "auth/wrong-password": "Kata sandi salah.",
    "auth/email-already-in-use": "Email ini sudah terdaftar. Silakan masuk.", "auth/weak-password": "Kata sandi minimal 6 karakter.", "auth/invalid-email": "Format email tidak valid.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.", "auth/network-request-failed": "Koneksi bermasalah. Periksa internet kamu." };
  return m[e?.code] || e?.message || "Terjadi kesalahan.";
}

export { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, updateProfile,
  doc, onSnapshot, collection, query, where, orderBy, limit };

// Bottom nav 3 tab, dipasang di setiap halaman utama (Menu / Akun / My Book).
export function pasangNav(aktif) {
  const svgKotak = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
  const svgOrang = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>';
  const svgBuku = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5v-18Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/></svg>';
  const item = (href, label, svg, id) => `<a href="${href}" class="${aktif === id ? "on" : ""}" aria-current="${aktif === id ? "page" : "false"}">${svg}<span>${label}</span></a>`;
  const wrap = document.createElement("nav");
  wrap.className = "bottomnav";
  wrap.setAttribute("aria-label", "Navigasi utama");
  wrap.innerHTML = item("/", "Menu", svgKotak, "menu") + item("/akun", "Akun", svgOrang, "akun") + item("/mybook", "My Book", svgBuku, "mybook");
  document.body.appendChild(wrap);
}
