// Uji alur API dengan Firestore & Auth PALSU di memori (fetch di-mock). Tidak menyentuh jaringan.
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
process.env.FIREBASE_PROJECT_ID = "demo"; process.env.FIREBASE_CLIENT_EMAIL = "sa@demo.iam"; process.env.FIREBASE_PRIVATE_KEY = privateKey.replace(/\n/g, "\\n"); process.env.FIREBASE_API_KEY = "k";

const store = new Map();            // path -> objek firestore fields
const USERS = { "tokenA": { localId: "userA", email: "a@x.id" }, "tokenB": { localId: "userB", email: "b@x.id" }, "tokenAdmin": { localId: "adm1", email: "adm@x.id" } };
store.set("admins/adm1", { fields: { aktif: { booleanValue: true } } });
let commits = 0;

globalThis.fetch = async (url, opt = {}) => {
  url = String(url); const j = (o, s = 200) => ({ ok: s < 300, status: s, json: async () => o });
  if (url.includes("oauth2.googleapis.com/token")) return j({ access_token: "T", expires_in: 3600 });
  if (url.includes("accounts:lookup")) { const t = JSON.parse(opt.body).idToken; return USERS[t] ? j({ users: [USERS[t]] }) : j({}, 400); }
  if (url.endsWith("documents:beginTransaction")) return j({ transaction: "trx" });
  if (url.endsWith("documents:rollback")) return j({});
  if (url.endsWith("documents:commit")) {
    commits++; for (const w of JSON.parse(opt.body).writes) store.set(w.update.name.split("/documents/")[1], { fields: w.update.fields }); return j({});
  }
  const m = url.match(/\/documents\/([^?]+)/);
  if (m) { const d = store.get(decodeURIComponent(m[1])); return d ? j({ fields: d.fields }) : j({ error: { message: "nf" } }, 404); }
  throw new Error("URL tak dikenal: " + url);
};

const { default: topup } = await import("../api/topup.js");
const { default: proses } = await import("../api/topup-proses.js");
const mkRes = () => { const r = { code: 0, body: null, headers: {} }; r.status = (c) => { r.code = c; return r; }; r.setHeader = () => r; r.json = (b) => { r.body = b; return r; }; return r; };
const req = (token, body, method = "POST") => ({ method, headers: token ? { authorization: "Bearer " + token } : {}, body });
let lulus = 0; const t = async (n, f) => { await f(); lulus++; console.log("  ok -", n); };
const saldoDi = (uid) => Number(store.get("users/" + uid)?.fields?.saldo?.integerValue || 0);

await t("tanpa login ditolak (401)", async () => { const r = mkRes(); await topup(req(null, { nominal: 50000 }), r); assert.equal(r.code, 401); });
await t("token palsu ditolak (401)", async () => { const r = mkRes(); await topup(req("palsu", { nominal: 50000 }), r); assert.equal(r.code, 401); });
await t("nominal di bawah minimum ditolak (400)", async () => { const r = mkRes(); await topup(req("tokenA", { nominal: 500 }), r); assert.equal(r.code, 400); });
await t("nominal pecahan/teks ditolak (400)", async () => { for (const n of [50000.5, "50000", -1, null]) { const r = mkRes(); await topup(req("tokenA", { nominal: n }), r); assert.equal(r.code, 400, String(n)); } });

let idTopup;
await t("top up valid dibuat, saldo BELUM berubah", async () => {
  const r = mkRes(); await topup(req("tokenA", { nominal: 50000 }), r);
  assert.equal(r.code, 200); assert.ok(r.body.kodeUnik >= 1 && r.body.kodeUnik <= 999); assert.equal(r.body.totalTransfer, 50000 + r.body.kodeUnik);
  idTopup = r.body.id; assert.equal(saldoDi("userA"), 0);
});
await t("pembeli biasa TIDAK bisa menyetujui top up sendiri (403)", async () => {
  const r = mkRes(); await proses(req("tokenA", { id: idTopup, aksi: "setuju" }), r); assert.equal(r.code, 403); assert.equal(saldoDi("userA"), 0);
});
await t("pembeli lain juga ditolak (403)", async () => { const r = mkRes(); await proses(req("tokenB", { id: idTopup, aksi: "setuju" }), r); assert.equal(r.code, 403); });
await t("id berbahaya / aksi asing ditolak (400)", async () => {
  for (const b of [{ id: "../users/userA", aksi: "setuju" }, { id: idTopup, aksi: "hapus" }, { id: 5, aksi: "setuju" }]) { const r = mkRes(); await proses(req("tokenAdmin", b), r); assert.equal(r.code, 400); }
});
await t("admin menyetujui -> saldo bertambah tepat nominal (bukan termasuk kode unik)", async () => {
  const r = mkRes(); await proses(req("tokenAdmin", { id: idTopup, aksi: "setuju" }), r);
  assert.equal(r.code, 200); assert.equal(r.body.status, "disetujui"); assert.equal(saldoDi("userA"), 50000);
  assert.ok(store.get("ledger/" + idTopup), "ledger tercatat");
});
await t("menyetujui LAGI tidak menambah saldo dua kali (409)", async () => {
  const r = mkRes(); await proses(req("tokenAdmin", { id: idTopup, aksi: "setuju" }), r); assert.equal(r.code, 409); assert.equal(saldoDi("userA"), 50000);
});
await t("top up yang sudah disetujui tidak bisa ditolak belakangan (409)", async () => {
  const r = mkRes(); await proses(req("tokenAdmin", { id: idTopup, aksi: "tolak" }), r); assert.equal(r.code, 409); assert.equal(saldoDi("userA"), 50000);
});
await t("top up ditolak tidak menambah saldo", async () => {
  const c = mkRes(); await topup(req("tokenB", { nominal: 20000 }), c);
  const r = mkRes(); await proses(req("tokenAdmin", { id: c.body.id, aksi: "tolak" }), r);
  assert.equal(r.code, 200); assert.equal(r.body.status, "ditolak"); assert.equal(saldoDi("userB"), 0);
});
await t("maksimal 3 top up menunggu per pengguna (429)", async () => {
  for (let i = 0; i < 3; i++) { await new Promise((z) => setTimeout(z, 2)); const r = mkRes(); await topup(req("tokenB", { nominal: 10000 }), r); assert.equal(r.code, 200); }
  const r = mkRes(); await topup(req("tokenB", { nominal: 10000 }), r); assert.equal(r.code, 429);
});
await t("metode GET ditolak (405)", async () => { const r = mkRes(); await topup(req("tokenA", {}, "GET"), r); assert.equal(r.code, 405); });

console.log(`\n${lulus} tes API lulus`);
