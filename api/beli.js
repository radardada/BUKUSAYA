// POST /api/beli  { bukuId, kodeVoucher? }
// Memotong saldo di server (bukan di browser), mencatat kepemilikan, mendukung voucher gratis/potongan/saldo & event diskon.
import { verifikasiPengguna, transaksi, balas } from "../lib/firebase.js";
import { terapkanBeli } from "../lib/saldo.js";
import { hargaSetelahEvent, terapkanVoucher, validasiVoucher } from "../lib/harga.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return balas(res, 405, { pesan: "Metode tidak diizinkan." });
  const user = await verifikasiPengguna(req);
  if (!user) return balas(res, 401, { pesan: "Silakan login dulu." });

  const bukuId = req.body?.bukuId;
  const kodeVoucher = (req.body?.kodeVoucher || "").trim().toUpperCase();
  if (typeof bukuId !== "string" || !/^[\w-]{1,60}$/.test(bukuId)) return balas(res, 400, { pesan: "Buku tidak valid." });

  try {
    const hasil = await transaksi(async (t) => {
      const buku = await t.baca(`books/${bukuId}`);
      if (!buku || buku.aktif === false) throw Object.assign(new Error("Buku tidak ditemukan."), { kode: 404 });

      const sudahPunya = await t.baca(`kepemilikan/${user.uid}_${bukuId}`);
      if (sudahPunya) throw Object.assign(new Error("Kamu sudah memiliki buku ini."), { kode: 409 });

      const event = buku.eventId ? await t.baca(`events/${buku.eventId}`) : null;
      let harga = hargaSetelahEvent(buku, event);

      let voucher = null, voucherDoc = null;
      if (kodeVoucher) {
        voucherDoc = await t.baca(`vouchers/${kodeVoucher}`);
        const cek = validasiVoucher(voucherDoc);
        if (!cek.ok) throw Object.assign(new Error(cek.pesan), { kode: 400 });
        if (voucherDoc.tipe !== "saldo") { const v = terapkanVoucher(harga, voucherDoc); harga = v.hargaAkhir; }
        voucher = voucherDoc;
      }

      const profil = (await t.baca(`users/${user.uid}`)) || { saldo: 0 };
      const potong = terapkanBeli(profil.saldo || 0, harga);
      if (!potong.ok) throw Object.assign(new Error(potong.pesan + (potong.kurang ? ` Kurang Rp${potong.kurang.toLocaleString("id-ID")}.` : "")), { kode: 402 });

      const idTrx = `${user.uid}_${bukuId}_${Date.now()}`;
      t.set(`kepemilikan/${user.uid}_${bukuId}`, { uid: user.uid, bukuId, hargaDibayar: harga, kodeVoucher: kodeVoucher || null, dibeli: new Date(), progres: 0 });
      t.set(`users/${user.uid}`, { ...profil, saldo: potong.saldoBaru });
      t.set(`ledger/${idTrx}`, { uid: user.uid, jenis: "beli", jumlah: -harga, saldoSetelah: potong.saldoBaru, ref: bukuId, waktu: new Date() });
      if (voucher) t.set(`vouchers/${kodeVoucher}`, { ...voucher, terpakai: (voucher.terpakai || 0) + 1 });
      t.set(`books/${bukuId}`, { ...buku, terjual: (buku.terjual || 0) + 1 });

      return { bukuId, hargaDibayar: harga, saldo: potong.saldoBaru };
    });
    return balas(res, 200, hasil);
  } catch (e) {
    return balas(res, e.kode || 500, { pesan: e.kode ? e.message : "Gagal memproses pembelian." });
  }
}
