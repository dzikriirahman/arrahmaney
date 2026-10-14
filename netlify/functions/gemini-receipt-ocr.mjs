// Gemini-powered receipt OCR for AR-Rahmaney.
//
// Environment variables (Netlify -> Site configuration -> Environment variables):
//   GEMINI_API_KEY   (wajib)  API key dari Google AI Studio. Jangan pernah ditulis di index.html.
//   GEMINI_MODEL     (opsional) Nama model, boleh beberapa dipisah koma sebagai cadangan.
//                    Default: gemini-3.8-flash, lalu gemini-3.5-flash-lite, lalu gemini-2.5-flash
//   SUPABASE_URL / SUPABASE_ANON_KEY (opsional) dipakai untuk memeriksa login pengguna.
//                    Jika kosong, dipakai nilai bawaan proyek ini.
//   REQUIRE_LOGIN    (opsional) isi "false" hanya untuk uji coba; default "true".
//
// Kenapa memakai generateContent (bukan /interactions):
//   endpoint ini stabil, balasannya sinkron, dan bentuk balasannya dikenal. Berpikir (thinking)
//   dimatikan/dibuat minimal supaya pembacaan struk selesai dalam hitungan detik, bukan menggantung.

// Urutan percobaan: model utama, lalu cadangan jika model tidak ada / kena batas / bermasalah.
// gemini-2.5-flash hanya tersisa untuk akun yang dulu sudah memakainya, jadi ditaruh paling akhir.
const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"];
// Fungsi Netlify sinkron dipotong sekitar 10 detik secara bawaan. Anggaran di bawah sengaja lebih kecil
// dari itu supaya pesan error kita yang sampai ke pengguna, bukan HTTP 502 mentah dari Netlify.
// Jika paket Netlify Anda mengizinkan batas lebih lama (Site configuration > Functions), naikkan lewat OCR_TOTAL_MS.
const TOTAL_BUDGET_MS = Math.max(5000, Number(process.env.OCR_TOTAL_MS) || 9000);
const PER_ATTEMPT_MS = Math.round(TOTAL_BUDGET_MS * 0.55); // sisakan waktu untuk model cadangan
const SUPABASE_URL = process.env.SUPABASE_URL || "https://bxdzfuzrvgbdenawxtba.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4ZHpmdXpydmdiZGVuYXd4dGJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3ODM2ODksImV4cCI6MjEwNzM1OTY4OX0.UpTKivwEbTuerfOyiGhgnc-8TMJRzOE6mbMAZ-N1E6w";

const STAGE_PROMPTS = {
  name: "Transkripsikan HANYA nama-nama barang yang tercetak pada struk. Satu nama barang per baris, pertahankan urutan dari atas ke bawah. Abaikan nama toko, alamat, tanggal, nomor invoice, subtotal, total, pembayaran, dan teks non-barang. Jangan menebak atau menambahkan barang yang tidak terbaca; jika nama tidak terbaca, tulis [TIDAK TERBACA]. Keluarkan teks mentah saja tanpa judul, bullet, nomor urut, atau penjelasan.",
  qty: "Transkripsikan HANYA jumlah/kuantitas tiap barang pada struk, satu nilai per baris, sesuai urutan barang dari atas ke bawah. Jangan masukkan harga atau total uang. Pertahankan angka desimal bila ada. Jangan menebak angka yang tidak terbaca; tulis [TIDAK TERBACA]. Keluarkan hanya nilai mentah satu per baris, tanpa judul, bullet, satuan, atau penjelasan.",
  unitPrice: "Transkripsikan HANYA harga satuan tiap barang pada struk, satu nilai per baris, sesuai urutan barang dari atas ke bawah. Jangan masukkan jumlah atau total per baris. Gunakan angka saja tanpa Rp, IDR, titik pemisah ribuan, koma, atau simbol mata uang. Jangan menebak angka yang tidak terbaca; tulis [TIDAK TERBACA]. Keluarkan hanya nilai mentah satu per baris, tanpa judul, bullet, atau penjelasan.",
  amount: "Transkripsikan HANYA total harga per baris barang (jumlah x harga satuan) pada struk, satu nilai per baris, sesuai urutan barang dari atas ke bawah. Jangan masukkan subtotal/total keseluruhan, pajak, diskon umum, atau pembayaran. Gunakan angka saja tanpa Rp, IDR, titik pemisah ribuan, koma, atau simbol mata uang. Jangan menebak angka yang tidak terbaca; tulis [TIDAK TERBACA]. Keluarkan hanya nilai mentah satu per baris, tanpa judul, bullet, atau penjelasan."
};

function modelList() {
  const fromEnv = String(process.env.GEMINI_MODEL || "").split(",").map(s => s.trim()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_MODELS;
}

function thinkingConfigFor(model) {
  if (/^gemini-2\.5-flash/i.test(model)) return { thinkingBudget: 0 };
  if (/^gemini-3/i.test(model)) return { thinkingLevel: "low" };
  return null;
}

function shorten(text, max = 220) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

async function verifyUser(request) {
  const token = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.startsWith("__")) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      signal: controller.signal
    });
    if (!res.ok) return null;
    const user = await res.json().catch(() => null);
    return user && user.id ? user : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Satu panggilan ke Gemini untuk satu model. Mengembalikan {ok, status, text, message, retryable}.
async function callGemini({ apiKey, model, prompt, mimeType, imageBase64, timeoutMs, useThinking }) {
  // maxOutputTokens dibuat longgar: pada model yang berpikir, batas kecil bisa menghabiskan token sebelum teks keluar.
  const generationConfig = { temperature: 0, maxOutputTokens: 4096 };
  const thinking = useThinking ? thinkingConfigFor(model) : null;
  if (thinking) generationConfig.thinkingConfig = thinking;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: imageBase64 } }
            ]
          }],
          generationConfig
        }),
        signal: controller.signal
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, message: shorten(data?.error?.message || res.statusText), thinkingUsed: !!thinking };
    }
    const candidate = data?.candidates?.[0];
    const text = (candidate?.content?.parts || []).map(p => p?.text || "").join("").trim();
    if (!text) {
      const reason = data?.promptFeedback?.blockReason || candidate?.finishReason || "KOSONG";
      return { ok: false, status: 422, message: `Balasan kosong (${reason}).`, thinkingUsed: !!thinking };
    }
    return { ok: true, status: 200, text };
  } catch (error) {
    if (error && error.name === "AbortError") return { ok: false, status: 504, message: "Gemini terlalu lama menjawab.", timedOut: true };
    return { ok: false, status: 0, message: shorten(error?.message || "Tidak dapat terhubung ke Gemini."), network: true };
  } finally {
    clearTimeout(timer);
  }
}

export default async (request) => {
  const startedAt = Date.now();
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

  // Hanya pengguna yang sudah login boleh memakai kuota Gemini.
  if (String(process.env.REQUIRE_LOGIN || "true").toLowerCase() !== "false") {
    const user = await verifyUser(request);
    if (!user) return respond(401, { error: "Sesi login berakhir. Silakan masuk kembali." });
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

  const prompt = "Anda adalah pembaca OCR struk belanja yang teliti. Baca hanya informasi yang benar-benar tampak pada foto. " + STAGE_PROMPTS[stage];
  const models = modelList();
  let last = null;

  for (const model of models) {
    // Dua percobaan per model: pertama dengan thinking minimal, lalu tanpa konfigurasi thinking
    // (berguna jika model menolak pengaturan tersebut dengan HTTP 400).
    for (const useThinking of [true, false]) {
      const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
      if (remaining < 2500) { last = last || { status: 504, message: "Waktu habis.", timedOut: true }; break; }
      const timeoutMs = models.length > 1 ? Math.min(remaining - 500, PER_ATTEMPT_MS) : remaining - 500;
      const result = await callGemini({ apiKey, model, prompt, mimeType, imageBase64, timeoutMs, useThinking });
      if (result.ok) {
        return respond(200, { text: result.text, stage, model, ms: Date.now() - startedAt });
      }
      last = { ...result, model };
      console.error("Gemini OCR gagal", { model, status: result.status, message: result.message, useThinking });
      const retryWithoutThinking = result.status === 400 && result.thinkingUsed && thinkingConfigFor(model);
      if (!retryWithoutThinking) break;
    }
    // Model berikutnya hanya dicoba jika model ini tidak ada / kena batas / sedang bermasalah.
    const tryNext = last && (last.status === 404 || last.status === 429 || last.status >= 500 || last.status === 0);
    if (!tryNext) break;
  }

  const detail = last ? `${last.model ? last.model + ": " : ""}${last.status || "jaringan"} ${last.message || ""}`.trim() : "";
  if (!last) return respond(502, { error: "Layanan Gemini sedang bermasalah. Coba lagi beberapa saat." });
  if (last.timedOut) return respond(504, { error: "Gemini terlalu lama menjawab. Crop foto lebih dekat ke bagian struk yang dibaca lalu coba lagi.", detail });
  if (last.status === 404) return respond(502, { error: "Model Gemini tidak ditemukan. Atur variabel GEMINI_MODEL di Netlify ke model yang tersedia untuk API key Anda (misalnya gemini-2.5-flash).", detail });
  if (last.status === 401 || last.status === 403) return respond(502, { error: "Gemini menolak API key. Periksa GEMINI_API_KEY dan akses Gemini API di Google AI Studio.", detail });
  if (last.status === 400) return respond(502, { error: "Gemini menolak permintaan ini. Coba foto lain atau periksa nama model di GEMINI_MODEL.", detail });
  if (last.status === 429) return respond(429, { error: "Kuota atau batas permintaan Gemini tercapai. Tunggu sebentar lalu coba lagi.", detail });
  if (last.status === 422) return respond(422, { error: "Gemini tidak menghasilkan teks. Coba crop lebih dekat atau gunakan foto lebih jelas.", detail });
  return respond(502, { error: "Layanan Gemini sedang bermasalah. Coba lagi beberapa saat.", detail });
};
