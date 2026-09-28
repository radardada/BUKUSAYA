// POST /api/topup-proses  { id, aksi: "setuju" | "tolak" }  -> HANYA ADMIN
import { verifikasiPengguna, adalahAdmin, transaksi, balas } from "../lib/firebase.js";
import { terapkanTopup } from "../lib/saldo.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return balas(res, 405, { pesan: "Metode tidak diizinkan." });
  const user = await verifikasiPengguna(req);
  if (!user) return balas(res, 401, { pesan: "Silakan login dulu." });
  if (!(await adalahAdmin(user.uid))) return balas(res, 403, { pesan: "Khusus admin." });

  const { id, aksi } = req.body || {};
  if (typeof id !== "string" || !/^[\w-]{5,80}$/.test(id) || !["setuju", "tolak"].includes(aksi)) return balas(res, 400, { pesan: "Permintaan tidak valid." });

  try {
    const hasil = await transaksi(async (t) => {
      const topup = await t.baca(`topups/${id}`);
      if (!topup) throw Object.assign(new Error("Top up tidak ditemukan."), { kode: 404 });
      const profil = (await t.baca(`users/${topup.uid}`)) || { saldo: 0, topupMenunggu: 0 };
      const baru = { ...profil, topupMenunggu: Math.max(0, (profil.topupMenunggu || 0) - 1) };

      if (aksi === "setuju") {
        const r = terapkanTopup(profil.saldo || 0, topup);
        if (!r.ok) throw Object.assign(new Error(r.pesan), { kode: 409 });
        baru.saldo = r.saldoBaru;
        t.set(`topups/${id}`, { ...topup, status: "disetujui", diprosesOleh: user.uid, diproses: new Date() });
        t.set(`ledger/${id}`, { uid: topup.uid, jenis: "topup", jumlah: topup.nominal, saldoSetelah: r.saldoBaru, ref: id, waktu: new Date() });
      } else {
        if (topup.status !== "menunggu") throw Object.assign(new Error("Top up sudah diproses."), { kode: 409 });
        t.set(`topups/${id}`, { ...topup, status: "ditolak", diprosesOleh: user.uid, diproses: new Date() });
      }
      t.set(`users/${topup.uid}`, baru);
      return { id, status: aksi === "setuju" ? "disetujui" : "ditolak", saldo: baru.saldo || 0 };
    });
    return balas(res, 200, hasil);
  } catch (e) {
    return balas(res, e.kode || 500, { pesan: e.kode ? e.message : "Gagal memproses top up." });
  }
}
