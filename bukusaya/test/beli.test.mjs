import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
process.env.FIREBASE_PROJECT_ID = "demo"; process.env.FIREBASE_CLIENT_EMAIL = "sa@demo.iam"; process.env.FIREBASE_PRIVATE_KEY = privateKey.replace(/\n/g, "\\n"); process.env.FIREBASE_API_KEY = "k";

const store = new Map();
const USERS = { tokenA: { localId: "userA", email: "a@x.id" }, tokenAdmin: { localId: "adm1", email: "adm@x.id" } };
const toFields = (obj) => {
  const ke = (v) => v === null || v === undefined ? { nullValue: null }
    : typeof v === "boolean" ? { booleanValue: v }
    : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
    : typeof v === "string" ? { stringValue: v }
    : v instanceof Date ? { timestampValue: v.toISOString() }
    : Array.isArray(v) ? { arrayValue: { values: v.map(ke) } }
    : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ke(x)])) } };
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, ke(v)]));
};
function taruh(path, obj) { store.set(path, { fields: toFields(obj) }); }
taruh("admins/adm1", { aktif: true });
taruh("books/b1", { id: "b1", title: "Buku Satu", author: "Penulis A", cat: "Fiksi", price: 100000, rating: 4.5, color: "#111111", desc: "d", aktif: true, terjual: 0, filePath: "b1.pdf" });
taruh("users/userA", { saldo: 150000 });

globalThis.fetch = async (url, opt = {}) => {
  url = String(url); const j = (o, s = 200) => ({ ok: s < 300, status: s, json: async () => o });
  if (url.includes("oauth2.googleapis.com/token")) return j({ access_token: "T", expires_in: 3600 });
  if (url.includes("accounts:lookup")) { const t = JSON.parse(opt.body).idToken; return USERS[t] ? j({ users: [USERS[t]] }) : j({}, 400); }
  if (url.endsWith("documents:beginTransaction")) return j({ transaction: "trx" });
  if (url.endsWith("documents:rollback")) return j({});
  if (url.endsWith("documents:commit")) { for (const w of JSON.parse(opt.body).writes) store.set(w.update.name.split("/documents/")[1], { fields: w.update.fields }); return j({}); }
  const m = url.match(/\/documents\/([^?]+)/);
  if (m && (opt.method || "GET") === "DELETE") { store.delete(decodeURIComponent(m[1])); return j({}); }
  if (m) { const d = store.get(decodeURIComponent(m[1])); return d ? j({ fields: d.fields }) : j({ error: { message: "nf" } }, 404); }
  throw new Error("URL tak dikenal: " + url);
};

const { default: beli } = await import("../api/beli.js");
const { default: redeemSaldo } = await import("../api/voucher-redeem-saldo.js");
const { default: adminPromo } = await import("../api/admin-promo.js");
const adminVoucher = (req, res) => adminPromo({ ...req, body: { jenis: "voucher", aksi: req.body.aksi, data: req.body.voucher } }, res);
const adminEvent = (req, res) => adminPromo({ ...req, body: { jenis: "event", aksi: req.body.aksi, data: req.body.event } }, res);
const { default: ulasan } = await import("../api/ulasan.js");
const { default: wishlist } = await import("../api/wishlist.js");

const mkRes = () => { const r = { code: 0, body: null }; r.status = (c) => { r.code = c; return r; }; r.setHeader = () => r; r.json = (b) => { r.body = b; return r; }; return r; };
const req = (token, body, method = "POST") => ({ method, headers: token ? { authorization: "Bearer " + token } : {}, body });
const dari = (f) => "integerValue" in f ? Number(f.integerValue) : "doubleValue" in f ? f.doubleValue : "stringValue" in f ? f.stringValue : "booleanValue" in f ? f.booleanValue : null;
const bacaLangsung = (path) => { const d = store.get(path); return d ? Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, dari(v)])) : null; };

let lulus = 0; const t = async (n, f) => { await f(); lulus++; console.log("  ok -", n); };

await t("beli tanpa voucher: saldo terpotong, kepemilikan tercatat", async () => {
  const r = mkRes(); await beli(req("tokenA", { bukuId: "b1" }), r);
  assert.equal(r.code, 200); assert.equal(r.body.hargaDibayar, 100000); assert.equal(r.body.saldo, 50000);
  assert.ok(bacaLangsung("kepemilikan/userA_b1")); assert.equal(bacaLangsung("books/b1").terjual, 1);
});
await t("beli buku yang sama lagi ditolak (409)", async () => { const r = mkRes(); await beli(req("tokenA", { bukuId: "b1" }), r); assert.equal(r.code, 409); assert.equal(bacaLangsung("users/userA").saldo, 50000); });
await t("beli buku tak dikenal ditolak (404)", async () => { const r = mkRes(); await beli(req("tokenA", { bukuId: "tidak-ada" }), r); assert.equal(r.code, 404); });

taruh("books/b2", { id: "b2", title: "Buku Dua", author: "Penulis B", cat: "Bisnis", price: 200000, rating: 4, color: "#222222", desc: "d", aktif: true, terjual: 0 });
await t("beli dengan saldo kurang ditolak (402), saldo tidak berubah", async () => { const r = mkRes(); await beli(req("tokenA", { bukuId: "b2" }), r); assert.equal(r.code, 402); assert.equal(bacaLangsung("users/userA").saldo, 50000); });

await t("admin buat voucher potongan", async () => { const r = mkRes(); await adminVoucher(req("tokenAdmin", { aksi: "simpan", voucher: { kode: "HEMAT50", tipe: "potongan", nilai: 50000, kuota: 2 } }), r); assert.equal(r.code, 200); });
await t("beli buku lain pakai voucher potongan: harga terpotong sesuai voucher", async () => {
  taruh("books/b3", { id: "b3", title: "Buku Tiga", author: "P", cat: "Sejarah", price: 80000, rating: 4, color: "#333", desc: "d", aktif: true, terjual: 0 });
  taruh("users/userA", { saldo: 50000 });
  const r = mkRes(); await beli(req("tokenA", { bukuId: "b3", kodeVoucher: "hemat50" }), r); // huruf kecil, harus dinormalisasi
  assert.equal(r.code, 200); assert.equal(r.body.hargaDibayar, 30000); assert.equal(bacaLangsung("vouchers/HEMAT50").terpakai, 1);
});
await t("voucher kuota habis ditolak", async () => {
  taruh("books/b4", { id: "b4", title: "Buku Empat", author: "P", cat: "Sejarah", price: 80000, rating: 4, color: "#333", desc: "d", aktif: true, terjual: 0 });
  taruh("books/b5", { id: "b5", title: "Buku Lima", author: "P", cat: "Sejarah", price: 80000, rating: 4, color: "#333", desc: "d", aktif: true, terjual: 0 });
  taruh("users/userA", { saldo: 500000 });
  let r = mkRes(); await beli(req("tokenA", { bukuId: "b4", kodeVoucher: "HEMAT50" }), r); assert.equal(r.code, 200); // pemakaian ke-2, kuota habis
  r = mkRes(); await beli(req("tokenA", { bukuId: "b5", kodeVoucher: "HEMAT50" }), r); assert.equal(r.code, 400);
});

await t("admin buat event diskon aktif, beli buku baru memakai harga diskon", async () => {
  const r1 = mkRes(); await adminEvent(req("tokenAdmin", { aksi: "simpan", event: { id: "gajian", nama: "Gajian", tipe: "persen", nilai: 20, status: "aktif" } }), r1); assert.equal(r1.code, 200);
  taruh("books/b6", { id: "b6", title: "Buku Enam", author: "P", cat: "Sejarah", price: 100000, rating: 4, color: "#333", desc: "d", aktif: true, terjual: 0, eventId: "gajian" });
  taruh("users/userA", { saldo: 100000 });
  const r = mkRes(); await beli(req("tokenA", { bukuId: "b6" }), r); assert.equal(r.code, 200); assert.equal(r.body.hargaDibayar, 80000);
});

await t("voucher tipe gratis membuat harga 0 walau saldo 0", async () => {
  await adminVoucher(req("tokenAdmin", { aksi: "simpan", voucher: { kode: "GRATISBUKU", tipe: "gratis", kuota: 1 } }), mkRes());
  taruh("books/b7", { id: "b7", title: "Buku Tujuh", author: "P", cat: "Sejarah", price: 999999, rating: 4, color: "#333", desc: "d", aktif: true, terjual: 0 });
  taruh("users/userA", { saldo: 0 }); // sengaja 0: buku gratis harus tetap bisa dibeli tanpa saldo
  const r = mkRes(); await beli(req("tokenA", { bukuId: "b7", kodeVoucher: "GRATISBUKU" }), r); assert.equal(r.code, 200); assert.equal(r.body.hargaDibayar, 0); assert.equal(bacaLangsung("users/userA").saldo, 0);
});

await t("voucher tipe saldo TIDAK bisa dipakai lewat /api/beli", async () => {
  await adminVoucher(req("tokenAdmin", { aksi: "simpan", voucher: { kode: "SALDO10K", tipe: "saldo", nilai: 10000, kuota: 5 } }), mkRes());
  taruh("books/b8", { id: "b8", title: "Buku Delapan", author: "P", cat: "Sejarah", price: 50000, rating: 4, color: "#333", desc: "d", aktif: true, terjual: 0 });
  taruh("users/userA", { saldo: 50000 });
  const r = mkRes(); await beli(req("tokenA", { bukuId: "b8", kodeVoucher: "SALDO10K" }), r);
  assert.equal(r.code, 200); assert.equal(r.body.hargaDibayar, 50000); // tidak dipotong, karena bukan tipe potongan
});
await t("voucher tipe saldo dipakai lewat endpoint redeem, menambah saldo, tidak bisa dipakai 2x", async () => {
  taruh("users/userA", { saldo: 0 });
  let r = mkRes(); await redeemSaldo(req("tokenA", { kode: "saldo10k" }), r); assert.equal(r.code, 200); assert.equal(r.body.saldo, 10000);
  r = mkRes(); await redeemSaldo(req("tokenA", { kode: "SALDO10K" }), r); assert.equal(r.code, 409); assert.equal(bacaLangsung("users/userA").saldo, 10000);
});

await t("ulasan hanya dari pembeli, rating buku terhitung ulang", async () => {
  const gagal = mkRes(); await ulasan(req("tokenAdmin", { bukuId: "b1", bintang: 5, teks: "bagus" }), gagal); assert.equal(gagal.code, 403); // admin belum pernah beli b1
  const r = mkRes(); await ulasan(req("tokenA", { bukuId: "b1", bintang: 5, teks: "Mantap!" }), r); assert.equal(r.code, 200);
  assert.equal(bacaLangsung("books/b1").rating, 5); assert.equal(bacaLangsung("books/b1").jumlahUlasan, 1);
});
await t("bintang di luar 1-5 ditolak", async () => { const r = mkRes(); await ulasan(req("tokenA", { bukuId: "b1", bintang: 9, teks: "x" }), r); assert.equal(r.code, 400); });

await t("wishlist tambah lalu hapus", async () => {
  let r = mkRes(); await wishlist(req("tokenA", { bukuId: "b2", aksi: "tambah" }), r); assert.equal(r.code, 200); assert.ok(bacaLangsung("wishlist/userA_b2"));
  r = mkRes(); await wishlist(req("tokenA", { bukuId: "b2", aksi: "hapus" }), r); assert.equal(r.code, 200); assert.equal(store.has("wishlist/userA_b2"), false);
});

console.log(`\n${lulus} tes beli/voucher/event/ulasan/wishlist lulus`);
