// POST /api/voucher-redeem-saldo  { kode }  -> voucher tipe "saldo": menambah saldo langsung (bukan potong harga buku)
import { verifikasiPengguna, transaksi, balas } from "../lib/firebase.js";
import { validasiVoucher } from "../lib/harga.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return balas(res, 405, { pesan: "Metode tidak diizinkan." });
  const user = await verifikasiPengguna(req);
  if (!user) return balas(res, 401, { pesan: "Silakan login dulu." });
  const kode = (req.body?.kode || "").trim().toUpperCase();
  if (!kode) return balas(res, 400, { pesan: "Isi kode voucher." });

  try {
    const hasil = await transaksi(async (t) => {
      const v = await t.baca(`vouchers/${kode}`);
      const cek = validasiVoucher(v);
      if (!cek.ok) throw Object.assign(new Error(cek.pesan), { kode: 400 });
      if (v.tipe !== "saldo") throw Object.assign(new Error("Kode ini bukan voucher saldo."), { kode: 400 });
      const dipakai = await t.baca(`voucher-pakai/${kode}_${user.uid}`);
      if (dipakai) throw Object.assign(new Error("Kamu sudah memakai voucher ini."), { kode: 409 });

      const profil = (await t.baca(`users/${user.uid}`)) || { saldo: 0 };
      const saldoBaru = (profil.saldo || 0) + v.nilai;
      t.set(`users/${user.uid}`, { ...profil, saldo: saldoBaru });
      t.set(`vouchers/${kode}`, { ...v, terpakai: (v.terpakai || 0) + 1 });
      t.set(`voucher-pakai/${kode}_${user.uid}`, { uid: user.uid, kode, waktu: new Date() });
      t.set(`ledger/${user.uid}_v_${Date.now()}`, { uid: user.uid, jenis: "voucher", jumlah: v.nilai, saldoSetelah: saldoBaru, ref: kode, waktu: new Date() });
      return { saldo: saldoBaru, nilai: v.nilai };
    });
    return balas(res, 200, hasil);
  } catch (e) {
    return balas(res, e.kode || 500, { pesan: e.kode ? e.message : "Gagal memakai voucher." });
  }
}
