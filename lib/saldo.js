// Logika saldo MURNI (tanpa Firebase) supaya bisa diuji.
// Semua angka dalam Rupiah bulat (integer). Tidak pernah pakai desimal untuk uang.

export const BATAS = {
  TOPUP_MIN: 10000,
  TOPUP_MAX: 5000000,
  KODE_UNIK_MIN: 1,
  KODE_UNIK_MAX: 999,
};

export function validNominal(n) {
  return Number.isInteger(n) && n > 0 && Number.isSafeInteger(n);
}

// Kode unik 3 digit ditambahkan ke nominal agar admin mudah mencocokkan transfer.
export function buatKodeUnik(rand = Math.random) {
  return BATAS.KODE_UNIK_MIN + Math.floor(rand() * (BATAS.KODE_UNIK_MAX - BATAS.KODE_UNIK_MIN + 1));
}

export function validasiTopup(nominal) {
  if (!validNominal(nominal)) return { ok: false, pesan: "Nominal harus angka bulat lebih dari 0." };
  if (nominal < BATAS.TOPUP_MIN) return { ok: false, pesan: `Top up minimal Rp${BATAS.TOPUP_MIN.toLocaleString("id-ID")}.` };
  if (nominal > BATAS.TOPUP_MAX) return { ok: false, pesan: `Top up maksimal Rp${BATAS.TOPUP_MAX.toLocaleString("id-ID")}.` };
  return { ok: true };
}

// Hitung hasil setelah admin MENYETUJUI top up. Mengembalikan data baru, tidak mengubah input.
export function terapkanTopup(saldoSekarang, topup) {
  if (!topup || topup.status !== "menunggu") return { ok: false, pesan: "Top up sudah diproses atau tidak valid." };
  if (!validNominal(topup.nominal)) return { ok: false, pesan: "Nominal top up rusak." };
  return { ok: true, saldoBaru: saldoSekarang + topup.nominal };
}

// Hitung hasil pembelian. Saldo tidak boleh negatif.
export function terapkanBeli(saldoSekarang, harga) {
  if (!validNominal(harga)) return { ok: false, pesan: "Harga tidak valid." };
  if (saldoSekarang < harga) return { ok: false, pesan: "Saldo tidak cukup.", kurang: harga - saldoSekarang };
  return { ok: true, saldoBaru: saldoSekarang - harga };
}
