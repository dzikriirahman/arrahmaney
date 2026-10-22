const OWNER_EMAIL = 'dzikrii.rahman@gmail.com';
const SUPABASE_URL = 'https://bxdzfuzrvgbdenawxtba.supabase.co';
const OCR_PATH = '/.netlify/functions/gemini-receipt-ocr';
const AI_PATH = '/api/ai';
const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
// Model Workers AI (gratis, 10.000 neuron/hari) sebagai cadangan saat kuota
// Gemini habis. gpt-oss-120b hanya bisa teks (bukan vision), jadi dipakai
// untuk chat/analisis, bukan OCR foto struk.
const CF_AI_MODELS = ['@cf/openai/gpt-oss-120b', '@cf/meta/llama-3.2-3b-instruct'];
const STAGE_PROMPTS = {
  name: 'Transkripsikan HANYA nama-nama barang yang tercetak pada struk. Satu nama barang per baris, pertahankan urutan dari atas ke bawah. Abaikan nama toko, alamat, tanggal, nomor invoice, subtotal, total, pembayaran, dan teks non-barang. Jangan menebak atau menambahkan barang yang tidak terbaca; jika nama tidak terbaca, tulis [TIDAK TERBACA]. Keluarkan teks mentah saja tanpa judul, bullet, nomor urut, atau penjelasan.',
  qty: 'Transkripsikan HANYA jumlah/kuantitas tiap barang pada struk, satu nilai per baris, sesuai urutan barang dari atas ke bawah. Jangan masukkan harga atau total uang. Pertahankan angka desimal bila ada. Jangan menebak angka yang tidak terbaca; tulis [TIDAK TERBACA]. Keluarkan hanya nilai mentah satu per baris, tanpa judul, bullet, satuan, atau penjelasan.',
  unitPrice: 'Transkripsikan HANYA harga satuan tiap barang pada struk, satu nilai per baris, sesuai urutan barang dari atas ke bawah. Jangan masukkan jumlah atau total per baris. Gunakan angka saja tanpa Rp, IDR, titik pemisah ribuan, koma, atau simbol mata uang. Jangan menebak angka yang tidak terbaca; tulis [TIDAK TERBACA]. Keluarkan hanya nilai mentah satu per baris, tanpa judul, bullet, atau penjelasan.',
  amount: 'Transkripsikan HANYA total harga per baris barang (jumlah x harga satuan) pada struk, satu nilai per baris, sesuai urutan barang dari atas ke bawah. Jangan masukkan subtotal/total keseluruhan, pajak, diskon umum, atau pembayaran. Gunakan angka saja tanpa Rp, IDR, titik pemisah ribuan, koma, atau simbol mata uang. Jangan menebak angka yang tidak terbaca; tulis [TIDAK TERBACA]. Keluarkan hanya nilai mentah satu per baris, tanpa judul, bullet, atau penjelasan.'
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

function modelList(env) {
  const configured = String(env.GEMINI_MODEL || '').split(',').map(value => value.trim()).filter(Boolean);
  return configured.length ? configured : DEFAULT_MODELS;
}

async function getUser(request, env) {
  const token = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const apiKey = String(env.SUPABASE_ANON_KEY || request.headers.get('apikey') || '').trim();
  if (!token || !apiKey) return false;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: apiKey, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) return false;
  const user = await response.json();
  return user;
}

async function runOcr(request, env) {
  if (request.method !== 'POST') return json({ error: 'Metode tidak diizinkan.' }, 405);

  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return json({ error: 'Permintaan lintas situs ditolak.' }, 403);
    } catch {
      return json({ error: 'Origin permintaan tidak valid.' }, 403);
    }
  }

  try {
    const user = await getUser(request, env);
    if (!user) return json({ error: 'Sesi login berakhir. Silakan masuk kembali.' }, 401);
    const ownerEmail = String(env.OWNER_EMAIL || OWNER_EMAIL).trim().toLowerCase();
    if (String(user.email || '').trim().toLowerCase() !== ownerEmail) {
      return json({ error: 'Fitur ini hanya tersedia untuk akun pemilik.' }, 403);
    }
  } catch (error) {
    console.error('Supabase owner verification failed:', error);
    return json({ error: 'Tidak dapat memverifikasi sesi pemilik. Coba lagi.' }, 503);
  }

  const apiKey = String(env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return json({ error: 'Secret GEMINI_API_KEY belum dipasang pada Cloudflare Worker.' }, 503);

  let body;
  try {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 5.8 * 1024 * 1024) return json({ error: 'Foto terlalu besar untuk dikirim. Crop bagian struk lalu coba lagi.' }, 413);
    body = await request.json();
  } catch {
    return json({ error: 'Data foto tidak valid.' }, 400);
  }

  const imageBase64 = String(body?.imageBase64 || '');
  const mimeType = String(body?.mimeType || '');
  const stage = String(body?.stage || '');
  if (!STAGE_PROMPTS[stage]) return json({ error: 'Tahap OCR tidak dikenal.' }, 400);
  if (!/^image\/(jpeg|png|webp)$/i.test(mimeType)) return json({ error: 'Format foto tidak didukung.' }, 400);
  if (!imageBase64 || imageBase64.length > 5.2 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
    return json({ error: 'Data foto kosong atau terlalu besar. Crop bagian struk lalu coba lagi.' }, 413);
  }

  const startedAt = Date.now();
  const models = modelList(env);
  const totalBudget = Math.max(5000, Number(env.OCR_TOTAL_MS) || 9000);
  const prompt = 'Anda adalah pembaca OCR struk belanja yang teliti. Baca hanya informasi yang benar-benar tampak pada foto. ' + STAGE_PROMPTS[stage];
  let last = null;

  for (const model of models) {
    for (const useThinking of [true, false]) {
      const remaining = totalBudget - (Date.now() - startedAt);
      if (remaining < 2500) {
        last = last || { status: 504, message: 'Waktu habis.', timedOut: true };
        break;
      }
      const controller = new AbortController();
      const timeoutMs = Math.min(remaining - 500, models.length > 1 ? Math.round(totalBudget * 0.55) : remaining - 500);
      const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
      let result;
      try {
        const generationConfig = { temperature: 0, maxOutputTokens: 4096 };
        if (useThinking && /^gemini-2\.5-flash/i.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
        else if (useThinking && /^gemini-3/i.test(model)) generationConfig.thinkingConfig = { thinkingLevel: 'low' };
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
            generationConfig
          }),
          signal: controller.signal
        });
        const data = await response.json().catch(() => ({}));
        const text = (data?.candidates?.[0]?.content?.parts || []).map(part => part?.text || '').join('').trim();
        if (response.ok && text) return json({ text, stage, model, ms: Date.now() - startedAt });
        result = {
          status: response.ok ? 422 : response.status,
          message: String(data?.error?.message || response.statusText || 'Balasan kosong.').replace(/\s+/g, ' ').slice(0, 220),
          retryThinking: response.status === 400 && !!generationConfig.thinkingConfig
        };
      } catch (error) {
        result = { status: error?.name === 'AbortError' ? 504 : 0, message: error?.message || 'Tidak dapat terhubung ke Gemini.', timedOut: error?.name === 'AbortError' };
      } finally {
        clearTimeout(timer);
      }
      last = { ...result, model };
      console.error('Gemini OCR failed', { model, status: result.status, message: result.message });
      if (!result.retryThinking) break;
    }
    if (!(last && (last.status === 404 || last.status === 429 || last.status >= 500 || last.status === 0))) break;
  }

  const detail = last ? `${last.model}: ${last.status || 'jaringan'} ${last.message || ''}`.trim() : '';
  if (!last) return json({ error: 'Layanan Gemini sedang bermasalah.' }, 502);
  if (last.timedOut) return json({ error: 'Gemini terlalu lama menjawab. Crop foto lebih dekat lalu coba lagi.', detail }, 504);
  if (last.status === 404) return json({ error: 'Model Gemini tidak ditemukan. Atur GEMINI_MODEL ke model yang tersedia.', detail }, 502);
  if (last.status === 401 || last.status === 403) return json({ error: 'Gemini menolak API key. Periksa secret GEMINI_API_KEY dan akses Gemini API.' , detail }, 502);
  if (last.status === 429) return json({ error: 'Kuota atau batas permintaan Gemini tercapai. Tunggu sebentar lalu coba lagi.', detail }, 429);
  if (last.status === 422) return json({ error: 'Gemini tidak menghasilkan teks. Coba foto lebih jelas.', detail }, 422);
  return json({ error: 'Layanan Gemini sedang bermasalah. Coba lagi beberapa saat.', detail }, 502);
}

async function runAi(request, env) {
  if (request.method !== 'POST') return json({ error: 'Metode tidak diizinkan.' }, 405);

  // Endpoint ini dipakai untuk chat/analisis. Berbeda dengan OCR, tidak
  // butuh foto, jadi boleh dipakai juga dari skrip backend (dengan token
  // pemilik) maupun dari bubble chat.
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Badan permintaan tidak valid.' }, 400);
  }
  const prompt = String(body.prompt || '').trim();
  if (!prompt) return json({ error: 'Prompt kosong.' }, 400);
  const system = String(body.system || '').trim();
  const maxTokens = Math.min(Number(body.maxTokens) || 1024, 4096);
  // "provider": "gemini" | "workers-ai" | "auto" (default).
  // "workers-ai" dipakai untuk memaksa jalur cadangan tanpa menunggu Gemini gagal.
  const mauProvider = String(body.provider || 'auto').trim().toLowerCase();
  const forceCf = mauProvider === 'workers-ai' || mauProvider === 'cf' || mauProvider === 'cloudflare';

  const geminiKey = String(env.GEMINI_API_KEY || '').trim();
  const models = modelList(env);
  const attempts = [];

  // 1) Gemini (utama)
  for (const model of (forceCf ? [] : models)) {
    if (!geminiKey) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: system ? `${system}\n\n${prompt}` : prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens }
        }),
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      const text = (data?.candidates?.[0]?.content?.parts || []).map(part => part?.text || '').join('').trim();
      if (response.ok && text) return json({ text, model, provider: 'gemini', attempts });
      attempts.push({ model, status: response.status, message: String(data?.error?.message || 'Balasan kosong.').slice(0, 160) });
    } catch (error) {
      attempts.push({ model, status: 0, message: String(error?.message || error).slice(0, 200) });
    } finally {
      clearTimeout(timer);
    }
    // 404 / 429 / 5xx -> coba model berikutnya. Error lain (401/403) = kunci salah.
    const last = attempts[attempts.length - 1];
    if (last && last.status && ![404, 429, 500, 502, 503, 504, 0].includes(last.status)) break;
  }

  // 2) Workers AI (gratis) sebagai cadangan
  if (env.AI) {
    for (const model of CF_AI_MODELS) {
      try {
        const response = await env.AI.run(model, {
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: prompt }
          ],
          max_tokens: maxTokens
        });
        // Workers AI mengembalikan bentuk berbeda per model:
        //   - @cf/openai/gpt-oss-120b : { choices: [{ message: { content } }] }
        //   - model chat llama/mistral : { response: "teks" }
        //   - model completion gemma   : { generated_text: "teks" }
        const kandidat = [
          response?.response,
          response?.generated_text,
          response?.choices?.[0]?.message?.content,
          response?.choices?.[0]?.text,
          typeof response === 'string' ? response : null
        ].map(value => (typeof value === 'string' ? value.trim() : '')).find(Boolean);
        if (kandidat) return json({ text: kandidat, model, provider: 'workers-ai', attempts });
        attempts.push({ model, status: 0, message: 'Balasan Workers AI kosong.', raw: JSON.stringify(response).slice(0, 200) });
      } catch (error) {
        attempts.push({ model, status: 0, message: String(error?.message || error).slice(0, 200) });
      }
    }
  }

  const detail = attempts.length ? attempts[attempts.length - 1] : null;
  if (detail && detail.status === 429) {
    return json({ error: 'Kuota AI habis (Gemini free tier 20 permintaan/hari per model). Coba lagi setelah tengah malam.', detail: attempts }, 429);
  }
  if (detail && (detail.status === 401 || detail.status === 403)) {
    return json({ error: 'API key AI ditolak. Periksa secret GEMINI_API_KEY.', detail: attempts }, 502);
  }
  return json({ error: 'Semua penyedia AI sedang bermasalah.', detail: attempts }, 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === OCR_PATH) return runOcr(request, env);
    if (url.pathname === AI_PATH) return runAi(request, env);
    return env.ASSETS.fetch(request);
  }
};
