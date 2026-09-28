import assert from "node:assert/strict";
import { validasiTopup, terapkanTopup, terapkanBeli, buatKodeUnik, validNominal } from "../lib/saldo.js";

let lulus = 0;
const t = (nama, fn) => { fn(); lulus++; console.log("  ok -", nama); };

t("nominal harus integer positif", () => {
  assert.equal(validNominal(50000), true);
  assert.equal(validNominal(0), false);
  assert.equal(validNominal(-5), false);
  assert.equal(validNominal(1.5), false);
  assert.equal(validNominal("50000"), false);
  assert.equal(validNominal(NaN), false);
  assert.equal(validNominal(Infinity), false);
});
t("top up di bawah minimum ditolak", () => assert.equal(validasiTopup(5000).ok, false));
t("top up di atas maksimum ditolak", () => assert.equal(validasiTopup(9000000).ok, false));
t("top up normal diterima", () => assert.equal(validasiTopup(50000).ok, true));
t("kode unik selalu 1..999", () => {
  for (let i = 0; i < 5000; i++) { const k = buatKodeUnik(); assert.ok(k >= 1 && k <= 999 && Number.isInteger(k)); }
  assert.equal(buatKodeUnik(() => 0), 1);
  assert.equal(buatKodeUnik(() => 0.999999), 999);
});
t("approve top up menambah saldo", () => {
  const r = terapkanTopup(10000, { status: "menunggu", nominal: 50000 });
  assert.equal(r.ok, true); assert.equal(r.saldoBaru, 60000);
});
t("top up yang sudah diproses TIDAK bisa di-approve dua kali (anti double-credit)", () => {
  assert.equal(terapkanTopup(10000, { status: "disetujui", nominal: 50000 }).ok, false);
  assert.equal(terapkanTopup(10000, { status: "ditolak", nominal: 50000 }).ok, false);
});
t("nominal rusak pada dokumen top up ditolak", () => {
  assert.equal(terapkanTopup(0, { status: "menunggu", nominal: -100 }).ok, false);
  assert.equal(terapkanTopup(0, { status: "menunggu", nominal: Infinity }).ok, false);
});
t("beli dengan saldo cukup", () => {
  const r = terapkanBeli(100000, 89000);
  assert.equal(r.ok, true); assert.equal(r.saldoBaru, 11000);
});
t("beli dengan saldo pas menjadi 0", () => assert.equal(terapkanBeli(89000, 89000).saldoBaru, 0));
t("beli dengan saldo kurang ditolak dan saldo tidak negatif", () => {
  const r = terapkanBeli(50000, 89000);
  assert.equal(r.ok, false); assert.equal(r.kurang, 39000); assert.equal(r.saldoBaru, undefined);
});
t("harga tidak valid ditolak", () => {
  assert.equal(terapkanBeli(100000, -1).ok, false);
  assert.equal(terapkanBeli(100000, 0).ok, false);
  assert.equal(terapkanBeli(100000, 0.5).ok, false);
});
console.log(`\n${lulus} tes lulus`);
