import assert from "node:assert/strict";
import { hargaSetelahEvent, terapkanVoucher, validasiVoucher } from "../lib/harga.js";

let lulus = 0; const t = (n, f) => { f(); lulus++; console.log("  ok -", n); };
const buku = { id: 1, cat: "Fiksi", price: 100000 };

t("tanpa event, harga tetap", () => assert.equal(hargaSetelahEvent(buku, null), 100000));
t("event tidak aktif diabaikan", () => assert.equal(hargaSetelahEvent(buku, { status: "nonaktif", tipe: "persen", nilai: 50 }), 100000));
t("event persen memotong benar", () => assert.equal(hargaSetelahEvent(buku, { status: "aktif", tipe: "persen", nilai: 20 }), 80000));
t("event potongan tidak boleh negatif", () => assert.equal(hargaSetelahEvent(buku, { status: "aktif", tipe: "potongan", nilai: 999999 }), 0));
t("event di luar rentang tanggal diabaikan", () => {
  const now = Date.now();
  assert.equal(hargaSetelahEvent(buku, { status: "aktif", tipe: "persen", nilai: 50, mulai: now + 10000 }), 100000);
  assert.equal(hargaSetelahEvent(buku, { status: "aktif", tipe: "persen", nilai: 50, selesai: now - 10000 }), 100000);
});
t("event dibatasi kategori lain diabaikan", () => assert.equal(hargaSetelahEvent(buku, { status: "aktif", tipe: "persen", nilai: 50, kategori: ["Bisnis"] }), 100000));
t("event dibatasi kategori yang cocok berlaku", () => assert.equal(hargaSetelahEvent(buku, { status: "aktif", tipe: "persen", nilai: 50, kategori: ["Fiksi"] }), 50000));

t("voucher kosong tidak mengubah harga", () => assert.deepEqual(terapkanVoucher(80000, null), { hargaAkhir: 80000, gratis: false }));
t("voucher gratis membuat harga 0", () => assert.deepEqual(terapkanVoucher(80000, { tipe: "gratis" }), { hargaAkhir: 0, gratis: true }));
t("voucher persen", () => assert.equal(terapkanVoucher(80000, { tipe: "persen", nilai: 25 }).hargaAkhir, 60000));
t("voucher potongan tidak minus dan bisa jadi gratis", () => {
  assert.equal(terapkanVoucher(10000, { tipe: "potongan", nilai: 50000 }).hargaAkhir, 0);
  assert.equal(terapkanVoucher(10000, { tipe: "potongan", nilai: 50000 }).gratis, true);
});

t("validasi voucher: tidak ada -> gagal", () => assert.equal(validasiVoucher(null).ok, false));
t("validasi voucher: nonaktif -> gagal", () => assert.equal(validasiVoucher({ aktif: false }).ok, false));
t("validasi voucher: kuota habis -> gagal", () => assert.equal(validasiVoucher({ aktif: true, kuota: 5, terpakai: 5 }).ok, false));
t("validasi voucher: kuota masih ada -> ok", () => assert.equal(validasiVoucher({ aktif: true, kuota: 5, terpakai: 4 }).ok, true));
t("validasi voucher: sudah kedaluwarsa -> gagal", () => assert.equal(validasiVoucher({ aktif: true, selesai: Date.now() - 1000 }).ok, false));

console.log(`\n${lulus} tes harga lulus`);
