// GET /api/config -> konfigurasi PUBLIK untuk browser (kunci web Firebase memang publik; keamanan ada di rules).
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY, authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID, appId: process.env.FIREBASE_APP_ID,
    },
    pembayaran: { nama: process.env.PEMBAYARAN_NAMA || "", nomor: process.env.PEMBAYARAN_NOMOR || "", metode: process.env.PEMBAYARAN_METODE || "E-wallet" },
  });
}
