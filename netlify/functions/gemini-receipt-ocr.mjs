// Gemini-powered receipt OCR for AR-Rahmaney.
// Set GEMINI_API_KEY in Netlify environment variables; never place it in index.html.
const STAGE_PROMPTS = {
  name: "Transkripsikan HANYA nama-nama barang yang tercetak pada struk. Satu nama barang per baris, pertahankan urutan dari atas ke bawah. Abaikan nama toko, alamat, tanggal, nomor invoice, subtotal, total, pembayaran, dan teks non-barang. Jangan menebak atau menambahkan barang yang tidak terbaca; jika nama tidak terbaca, tulis [TIDAK TERBACA]. Keluarkan teks mentah saja tanpa judul, bullet, nomor urut, atau penjelasan.",
  qty: "Transkripsikan HANYA jumlah/kuantitas tiap barang pada struk, satu nilai per baris, sesuai urutan barang dari atas ke bawah. Jangan masukkan harga atau total uang. Pertahankan angka desimal bila ada. Jangan menebak angka yang tidak terbaca; tulis [TIDAK TERBACA]. Keluarkan hanya nilai mentah satu per baris, tanpa judul, bullet, satuan, atau penjelasan.",
  unitPrice: "Transkripsikan HANYA harga satuan tiap barang pada struk, satu nilai per baris, sesuai urutan barang dari atas ke bawah. Jangan masukkan jumlah atau total per baris. Gunakan angka saja tanpa Rp, IDR, titik pemisah ribuan, koma, atau simbol mata uang. Jangan menebak angka yang tidak terbaca; tulis [TIDAK TERBACA]. Keluarkan hanya nilai mentah satu per baris, tanpa judul, bullet, atau penjelasan.",
  amount: "Transkripsikan HANYA total harga per baris barang (jumlah x harga satuan) pada struk, satu nilai per baris, sesuai urutan barang dari atas ke bawah. Jangan masukkan subtotal/total keseluruhan, pajak, diskon umum, atau pembayaran. Gunakan angka saja tanpa Rp, IDR, titik pemisah ribuan, koma, atau simbol mata uang. Jangan menebak angka yang tidak terbaca; tulis [TIDAK TERBACA]. Keluarkan hanya nilai mentah satu per baris, tanpa judul, bullet, atau penjelasan."
};

export default async (request) => {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  const respond = (status, body) => new Response(JSON.stringify(body), { status, headers });
  if (request.method !== "POST") return respond(405, { error: "Metode tidak diizinkan." });
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return respond(403, { error: "Permintaan lintas situs ditolak." });
    } catch { return respond(403, { error: "Origin permintaan tidak valid." }); }
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return respond(503, { error: "API key Gemini belum dipasang di Netlify. Tambahkan variabel GEMINI_API_KEY lalu deploy ulang." });

  let body;
  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 5.8 * 1024 * 1024) return respond(413, { error: "Foto terlalu besar untuk dikirim. Crop bagian struk lalu coba lagi." });
    body = await request.json();
  } catch { return respond(400, { error: "Data foto tidak valid." }); }

  const imageBase64 = String(body?.imageBase64 || "");
  const mimeType = String(body?.mimeType || "");
  const stage = String(body?.stage || "");
  if (!STAGE_PROMPTS[stage]) return respond(400, { error: "Tahap OCR tidak dikenal." });
  if (!/^image\/(jpeg|png|webp)$/i.test(mimeType)) return respond(400, { error: "Format foto tidak didukung." });
  if (!imageBase64 || imageBase64.length > 5.2 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
    return respond(413, { error: "Data foto kosong atau terlalu besar. Crop bagian struk lalu coba lagi." });
  }

  try {
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model: "gemini-3.8-flash",
        input: [
          { type: "text", text: "Anda adalah pembaca OCR struk belanja yang teliti. Baca hanya informasi yang benar-benar tampak pada foto. " + STAGE_PROMPTS[stage] },
          { type: "image", mime_type: mimeType, data: imageBase64 }
        ]
      })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const upstreamMessage = data?.error?.message || "Layanan Gemini menolak permintaan.";
      console.error("Gemini API error", upstream.status, upstreamMessage);
      if (upstream.status === 400 || upstream.status === 403 || upstream.status === 401) {
        return respond(502, { error: "Gemini menolak permintaan. Periksa status API key dan akses Gemini API di Google AI Studio." });
      }
      if (upstream.status === 429) return respond(429, { error: "Kuota atau batas permintaan Gemini tercapai. Tunggu sebentar lalu coba lagi." });
      return respond(502, { error: "Layanan Gemini sedang bermasalah. Coba lagi beberapa saat." });
    }
    const text = String(
      data?.output_text ||
      (data?.steps || [])
        .filter(step => step?.type === "model_output")
        .flatMap(step => step?.content || [])
        .filter(part => part?.type === "text")
        .map(part => part?.text || "")
        .join("")
    ).trim();
    if (!text) return respond(422, { error: "Gemini tidak menghasilkan teks. Coba crop lebih dekat atau gunakan foto lebih jelas." });
    return respond(200, { text, stage });
  } catch (error) {
    console.error("Gemini OCR request failed", error);
    return respond(502, { error: "Tidak dapat menghubungi Gemini. Periksa koneksi internet lalu coba lagi." });
  }
};
