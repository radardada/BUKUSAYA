// POST /api/topup  { nominal }  -> pembeli membuat permintaan top up (status "menunggu")
import { verifikasiPengguna, transaksi, balas } from "../lib/firebase.js";
import { validasiTopup, buatKodeUnik } from "../lib/saldo.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return balas(res, 405, { pesan: "Metode tidak diizinkan." });
  const user = await verifikasiPengguna(req);
  if (!user) return balas(res, 401, { pesan: "Silakan login dulu." });

  const nominal = req.body && req.body.nominal;
  const cek = validasiTopup(nominal);
  if (!cek.ok) return balas(res, 400, { pesan: cek.pesan });

  try {
    const hasil = await transaksi(async (t) => {
      // Batasi 1 permintaan menunggu per pengguna agar tidak dibanjiri.
      const profil = (await t.baca(`users/${user.uid}`)) || {};
      if ((profil.topupMenunggu || 0) >= 3) throw Object.assign(new Error("Masih ada 3 top up menunggu konfirmasi."), { kode: 429 });
      const kodeUnik = buatKodeUnik();
      const id = `${user.uid}_${Date.now()}`;
      const total = nominal + kodeUnik;
      t.set(`topups/${id}`, { uid: user.uid, email: user.email, nominal, kodeUnik, totalTransfer: total, status: "menunggu", dibuat: new Date() });
      t.set(`users/${user.uid}`, { ...profil, email: user.email, saldo: profil.saldo || 0, topupMenunggu: (profil.topupMenunggu || 0) + 1 });
      return { id, nominal, kodeUnik, totalTransfer: total };
    });
    return balas(res, 200, hasil);
  } catch (e) {
    return balas(res, e.kode || 500, { pesan: e.kode ? e.message : "Gagal membuat top up." });
  }
}
