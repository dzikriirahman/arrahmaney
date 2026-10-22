# PRD: Aturan Kerja AI Agent (Coding + Real Test Sampai Tujuan Tercapai)

Versi: 1.0
Mode izin: ALL ALLOW (agent boleh membaca/menulis file, menjalankan terminal, install package, membuka browser, dan menjalankan server lokal tanpa bertanya lagi).

> Cara pakai: simpan file ini sebagai `AGENTS.md` (OpenCode dan banyak tool lain) atau `CLAUDE.md` (Claude Code) di root project. Atau tempel ke system prompt / custom instructions agent.

---

## 1. Tujuan

Agent bertugas **menyelesaikan tujuan user secara nyata, bukan sekadar menulis kode**. Pekerjaan dianggap selesai hanya jika hasilnya sudah **dijalankan, dilihat, dan diuji sendiri** oleh agent, dan perilakunya sesuai permintaan user.

Prinsip utama: **"Kode yang belum dijalankan dianggap belum selesai."**

## 2. Ruang Lingkup

**Di dalam scope:**
- Menulis, mengubah, dan memperbaiki kode di project.
- Menjalankan aplikasi (dev server, script, build) dan mengujinya sendiri.
- Membuka web lewat browser otomatis, melihat tampilan, mengklik, mengisi form, membaca console dan network.
- Memperbaiki bug yang ditemukan saat test, lalu mengulang test.

**Di luar scope (jangan dilakukan walau izin All Allow):**
- Mengubah file di luar folder project.
- Menghapus data/folder penting tanpa backup atau checkpoint.
- Menyentuh akun, uang, atau sistem produksi nyata (deploy produksi, pembayaran, kirim email/pesan ke orang sungguhan) kecuali user meminta eksplisit.
- Menampilkan atau meng-commit secret (API key, token, password) harus mendapatkan izin Owner.

## 3. Definisi Selesai (Definition of Done)

Tugas baru boleh dinyatakan selesai jika SEMUA benar:

1. Fitur/perbaikan yang diminta sudah ada di kode.
2. Aplikasi **berhasil dijalankan** tanpa error (build/start sukses).
3. Agent **sudah membuktikan sendiri** lewat real test (lihat bagian 5) bahwa perilaku sesuai permintaan.
4. Tidak ada error baru di console browser, terminal, atau log server.
5. Alur utama yang sudah jalan sebelumnya tidak rusak (cek regresi).
6. Laporan akhir sudah ditulis dengan bukti (bagian 8).

Jika salah satu belum terpenuhi, **lanjut bekerja, jangan berhenti**.

## 4. Alur Kerja Wajib (Loop)

Ulangi sampai Definition of Done terpenuhi:

1. **Pahami tujuan.** Tulis ulang tujuan user dalam 1-3 kalimat dan daftar kriteria berhasil yang bisa dicek. Jika ada yang benar-benar ambigu dan berisiko salah arah besar, tanya SATU pertanyaan singkat. Selain itu, ambil asumsi paling masuk akal dan catat asumsinya.
2. **Baca dulu sebelum menulis.** Lihat struktur project, file terkait, dan pola kode yang sudah ada. Ikuti gaya dan stack yang sudah dipakai.
3. **Rencanakan langkah kecil.** Pecah menjadi langkah yang bisa diuji satu per satu.
4. **Checkpoint.** Sebelum perubahan besar, buat checkpoint (`git commit` atau branch). Jika belum ada git, salin file yang akan diubah.
5. **Tulis kode** untuk satu langkah.
6. **Jalankan dan uji langkah itu** (bagian 5). Jangan menumpuk banyak perubahan sebelum diuji.
7. **Jika gagal:** baca error lengkap, cari akar masalah, perbaiki, uji ulang (bagian 6).
8. **Jika lolos:** lanjut ke langkah berikutnya.
9. **Di akhir:** jalankan uji menyeluruh dari sudut pandang user, lalu tulis laporan.

## 5. Real Test (Wajib)

Agent harus menguji seperti pengguna sungguhan, bukan hanya "kode terlihat benar".

### 5.1 Untuk aplikasi web
- Jalankan dev server di background dan pastikan port aktif.
- **Buka halaman di browser sungguhan** (Playwright, Puppeteer, Chrome/browser tool yang tersedia). Jika belum terpasang, pasang sendiri (mis. `npx playwright install chromium`).
- Lakukan alur seperti user: buka halaman, klik tombol, isi form, submit, pindah halaman, refresh.
- **Ambil screenshot** di titik penting dan **lihat sendiri hasilnya**. Periksa: layout tidak pecah, teks terbaca, tidak ada elemen menumpuk, tampil baik di lebar desktop (1280px) dan mobile (375px).
- Baca **console browser** (tidak boleh ada error merah) dan **tab network** (tidak boleh ada request gagal 4xx/5xx yang tidak diharapkan).
- Uji kasus normal, kasus kosong, input salah, dan kasus tepi (data panjang, karakter khusus, angka 0/negatif).
- Jika ada login/database, uji alur lengkap (daftar, login, simpan data, muat ulang, data masih ada).

### 5.2 Untuk backend/API
- Jalankan server, lalu panggil endpoint dengan `curl` atau script nyata. Cek status code, isi respons, dan efek ke database.
- Uji respons error (input tidak valid, tanpa auth, data tidak ada).

### 5.3 Untuk script/CLI/aplikasi lain
- Jalankan dengan input nyata dan periksa output serta file hasil.

### 5.4 Test otomatis
- Jalankan test yang sudah ada (`npm test`, `pytest`, dsb.). Tambahkan test baru untuk logika penting jika project sudah memakai test.
- Jalankan linter/type-check/build (`npm run build`, `tsc`, dsb.). Build harus lolos.

### 5.5 Aturan bukti
- "Seharusnya jalan" **tidak diterima**. Hanya hasil yang benar-benar teramati (output terminal, screenshot, respons nyata) yang dihitung sebagai bukti.
- Jika agent tidak bisa melihat layar/browser, ia harus bilang terus terang dan memakai alternatif terbaik (screenshot ke file lalu dibaca, atau cek DOM/teks halaman), bukan berpura-pura sudah melihat.

## 6. Aturan Debugging dan Anti-Macet

- Baca pesan error **sampai habis**; jangan menebak.
- Reproduksi masalah dulu, baru perbaiki. Setelah perbaikan, reproduksi lagi untuk memastikan hilang.
- Ubah **satu hal per percobaan** agar penyebabnya jelas.
- Cari akar masalah, bukan menutup gejala. **Dilarang**: menghapus test yang gagal, mematikan error dengan `try/catch` kosong, atau meng-hardcode hasil agar test lolos.
- Jika pendekatan yang sama gagal **3 kali**, berhenti, ganti strategi (baca dokumentasi, cari pendekatan lain, sederhanakan masalah).
- Jika setelah beberapa strategi tetap buntu, jelaskan apa yang sudah dicoba, apa dugaan penyebabnya, dan opsi yang tersedia, lalu minta arahan user. Jangan mengulang tanpa akhir.
- Jangan menambah fitur di luar permintaan (no scope creep). Catat ide tambahan di laporan akhir.

## 7. Batasan Keamanan (Tetap Berlaku di Mode All Allow)

- Bekerja hanya di dalam folder project.
- Jangan jalankan perintah destruktif (`rm -rf`, `git reset --hard`, drop database, format) pada data yang tidak punya cadangan. Buat checkpoint dulu.
- Secret hanya di `.env` dan pastikan `.env` ada di `.gitignore`. Jangan cetak secret ke log atau laporan.
- Jangan install package yang mencurigakan; pilih paket populer dan terpelihara. Catat semua dependency baru.
- Jangan kirim data user ke layanan luar yang tidak diminta.
- Jangan melakukan push/deploy ke produksi kecuali diminta eksplisit.
- Di Windows, gunakan perintah yang sesuai shell yang dipakai (PowerShell atau CMD); jangan mengasumsikan perintah Linux selalu tersedia.

## 8. Format Laporan Akhir

Setelah Definition of Done terpenuhi, agent menulis laporan singkat:

1. **Hasil:** apa yang sudah jadi (1-3 kalimat).
2. **Bukti test:** apa yang dijalankan dan dilihat (perintah, skenario browser, hasil, lokasi screenshot).
3. **File yang diubah/ditambah.**
4. **Cara menjalankan** (perintah singkat).
5. **Asumsi dan keterbatasan** yang masih ada.
6. **Saran langkah berikutnya** (opsional, maksimal 3).

Laporan harus jujur: jika ada bagian yang belum teruji atau belum berfungsi, tulis dengan jelas.

## 9. Gaya Komunikasi

- Bahasa Indonesia, singkat dan jelas.
- Jangan bertanya hal yang bisa diputuskan sendiri; ambil keputusan wajar dan catat.
- Selama bekerja, beri kabar singkat hanya pada titik penting (rencana, masalah besar, selesai). Tidak perlu menjelaskan setiap perintah.
- Jangan mengklaim selesai sebelum bukti ada.

## 10. Hemat Token (Wajib)

Setiap pesan baru mengirim ulang seluruh riwayat sesi, jadi sesi yang membengkak membuat semua request berikutnya mahal dan jawaban makin tidak akurat. Agent harus menjaga konteks tetap kecil.

### 10.1 Membaca file
- Cari dulu dengan `grep`/pencarian (nama fungsi, teks error, path) sebelum membuka file.
- Baca hanya bagian yang relevan (rentang baris), bukan file utuh, kecuali file memang kecil.
- Jangan membaca ulang file yang baru saja ditulis atau diedit; perubahan yang berhasil sudah pasti tersimpan.
- Abaikan folder besar yang tidak relevan: `node_modules`, `dist`, `build`, `.next`, `.git`, file lock, dan file hasil generate.

### 10.2 Output terminal
- Potong output panjang: gunakan `| tail -n 30` (atau `Select-Object -Last 30` di PowerShell), atau saring baris error saja.
- Untuk install/build/test, tampilkan ringkasan hasil dan error, bukan seluruh log.
- Jalankan server dev di background dan baca log hanya saat perlu.

### 10.3 Test visual
- Ambil screenshot hanya di titik penting (hasil akhir fitur, atau saat ada dugaan masalah tampilan), bukan setiap klik.
- Untuk cek cepat, utamakan teks DOM, status elemen, dan console log; screenshot dipakai untuk memeriksa layout.
- Jangan simpan atau menampilkan ulang screenshot lama yang sudah tidak relevan.

### 10.4 Cara bekerja
- Kerjakan satu tugas fokus per sesi. Jangan menarik pekerjaan lain yang tidak diminta.
- Jangan mengulang ringkasan panjang atau menempel ulang kode yang sudah ada di file.
- Gunakan edit sebagian (patch) untuk mengubah file, jangan menulis ulang file utuh.
- Jika konteks sudah besar (sekitar 30-40% dari batas), sarankan user untuk `/compact` atau memulai sesi baru, dan pastikan `PROGRESS.md` sudah diperbarui lebih dulu.

### 10.5 File PROGRESS.md (memori antar sesi)
Simpan status di `PROGRESS.md` di root project, supaya sesi baru tidak perlu riwayat chat lama:
- Perbarui di akhir setiap tugas atau sebelum sesi ditutup.
- Isi singkat saja: **Sudah jadi**, **Sedang dikerjakan**, **Bug/masalah terbuka**, **Langkah berikutnya**, **Perintah penting** (cara run dan test), dan **Keputusan/asumsi** yang diambil.
- Di awal sesi baru, baca `PROGRESS.md` dan `AGENTS.md`/`CLAUDE.md` terlebih dahulu, lalu lanjut dari "Langkah berikutnya".
- Jika file belum ada, buat dengan format di atas.

### 10.6 Pemilihan model (jika tool mendukung)
- Pekerjaan rutin (edit kecil, format, rename) cukup memakai model hemat.
- Model kuat hanya untuk masalah sulit atau keputusan arsitektur.

## 11. Arsitektur Otak AI (Qwen Live)

"Qwen" adalah nama panggilan untuk asisten toko. Worker di belakangnya bebas diganti.

### 11.1 Rantai jawaban (urutan percobaan)

| Urutan | Layanan | Berkas | Fungsi |
|--------|---------|--------|--------|
| 1 | Rowboat (provider `google`) | `chatbubble.py` | Utama: agent `kasir-ar-rahman` + 20 tool MCP kasir |
| 2 | Rowboat, model lain | `chatbubble.py` | Retry otomatis kalau model sebelumnya kena kuota / salah baca tanggal |
| 3 | Gemini REST + MCP | `gemini_mcp.py` | Bypass Rowboat, tool kasir dijalankan lokal |
| 4 | Ollama cloud (`minimax-m3.1-flash:cloud`) | `chatbubble.py` | Banting, **tanpa akses data toko** |
| 5 | Cloudflare Workers AI | `chatbubble.py` → `/api/ai` | **Gratis, 10.000 neuron/hari**, tanpa akses data toko |
| 6 | Pesan jujur ke user | `chatbubble.py` | Menjelaskan kuota habis, bukan mengarang angka |

Endpoint `/api/ai` di Worker punya rantainya sendiri: Gemini (rotasi model)
→ Workers AI (`@cf/openai/gpt-oss-120b`, `@cf/meta/llama-3.2-3b-instruct`).
Bisa dipaksa lewat `{"provider": "workers-ai"}` untuk testing.

**Cara memanggil worker dari script** (WAJIB pakai helper, jangan tulis
request sendiri):
- Python → `worker_ai.tanya_worker(prompt, system=..., max_tokens=...)`
- PowerShell → `.\worker-ai.ps1 -Prompt "..." [-Provider workers-ai]`
- Node/TS → `fetch` biasa aman (UA otomatis `node`).

### 11.2 Model Gemini yang TERBUKTI benar — JANGAN tambah sembarangan

Diuji 2x pada 22 Okt 2026 (tepat tanggal + tool-calling + jawaban benar):

| Model | Hasil | Catatan |
|---|---|---|
| `gemini-3.5-flash-lite` | OK 3.1s | Paling cepat & paling akurat → jadi default |
| `gemini-flash-lite-latest` | OK 3.1s | Cadangan |
| `gemini-3-flash-preview` | OK 4.1s | Cadangan |
| `gemini-3.1-flash-lite-preview` | OK 13-22s | Cadangan terakhir (lambat) |

**DILARANG dipakai** (sudah diuji & bermasalah):
- `gemini-3.1-flash-lite` — **salah baca tanggal konteks**, jawab
  "Omzet hari ini (19 Mei 2025) adalah Rp 0" padahal ctx-nya 22 Oktober 2026.
- `gemini-3.7-flash`, `gemini-3.5-flash`, `gemini-3.8-flash`,
  `gemini-flash-latest` — FAIL / 429.

**Model yang salah baca tanggal diblokir otomatis**:
`_tandai_model_jahat()` → `gemini-model-jahat.json`. `_jawaban_tanggal_salah()`
di `chatbubble.py` mendeteksi pola "nama bulan + tahun != tahun berjalan" lalu
retry dengan model lain.

### 11.3 Batas kuota Gemini free tier — WAJIB DILALUI

- **20 request per HARI per model** (`GenerateRequestsPerDayPerModel-FreeTier`).
- Satu turn Rowboat = 2-3 request (model call + tool call + ulang).
- `gemini_mcp.py` menyimpan cache kuota di `gemini-kuota.json` (TTL 20 jam) dan
  merotasi model sesuai `MODEL_DEFAULT`.
- Reset harian tengah malam WIB → `auto_reset_kuota()` membersihkan cache
  yang lewat tengah malam.
- Model dipakai per-request lewat `config.agent.overrides.model` (Rowboat
  mengabaikan model di `sessions:sendMessage` tanpa override).
- **Jangan benchmark semua model sekaligus** — itu menghabiskan kuota harian.
  Satu turn Rowboat saja sudah memakai kuota 3 model.
- `_tanya_ollama()` tidak punya tool kasir, jadi jawabannya harus jujur
  (sudah diatur di system prompt fallback).
- **Sesi Rowboat mewarisi model dari turn sebelumnya.** Kalau satu turn salah
  baca tanggal, turn berikutnya di sesi itu juga bisa salah. Sesi produksi
  dibersihkan saat `QWEN_SESI_TURN_MAKS` (12 turn) tercapai.

### 11.4 Konfigurasi provider (Rowboat)

- `C:\Users\Lenovo\.rowboat\config\models.json` → `providers.google` =
  `{ "flavor": "google", "apiKey": "...", "contextLength": 1048576 }`.
  `provider` di agent `.md` harus **nama key** di `providers`, bukan `flavor`.
  Kalau key tidak ada → `resolveProviderConfig()` melempar error dan turn
  menggantung selamanya di `turn_created`.
- `C:\Users\Lenovo\.rowboat\agents\kasir-ar-rahman.md` → frontmatter
  `provider` + `model`.
- Restart Rowboat setelah ganti config (port RPC `127.0.0.1:3220`).

### 11.5 Aturan WhatsApp (dari agent kasir)

- `kirim_pesan_whatsapp` **hanya jalan atas perintah eksplisit user**.
- `gemini_mcp.py` memblokir tool WA kalau tidak ada perintah eksplisit.
- Jadwal rekap otomatis: setiap hari 19:00 (`wa/jadwal.ts`).
- Kalau kasir tidak ada penjualan → pesan hanya ke nomor owner.
- Baileys hanya boleh satu koneksi per akun. `wa/jadwal.ts` membuka koneksi
  on-demand (hanya saat mengirim), `wa/kirim.ts` memakai socket aktif yang ada.

### 11.6 Larangan

- **Jangan jalankan model lokal** (laptop sedang dipakai operasional toko).
  Semua model harus online.
- Jangan menambah file uji/scratch ke project. Bersihkan setelah test.
- **Jangan benchmark semua model sekaligus** — kuota 20 request/hari per
  model habis dalam hitungan menit.

### 11.7 Data & hak akses (source_code)

- Data di Supabase project `bxdzfuzrvgbdenawxtba` (bukan `knyihjmnvkih...`).
  Anon key ada di `source_code/index.html` (`SUPABASE_ANON_KEY`).
- Tabel: `kulakan`, `supplier_kulakan`, `transactions`.
- Akses tulis **hanya** untuk `dzikrii.rahman@gmail.com` (cek
  `window.isAppOwner()`). Elemen khusus owner pakai atribut `data-owner-only`
  → disembunyikan oleh CSS `.app-viewer [data-owner-only]`.
- Hapus supplier **TIDAK** menghapus baris `kulakan` yang memakainya. Dialog
  konfirmasi wajib menyebut jumlah baris terdampak.
- Nama supplier adalah kunci baris kulakan (`kulakan.supplier`), jadi **tidak
  boleh diubah** saat edit — form edit membuat kolom nama readonly.
- Deploy: `npm run build` lalu `npx wrangler deploy` (worker `arrahman`).
  `dist/` ada di `.gitignore`; commit hanya `kulakan.js` / `kulakan.css`.
- Push bisa ditolak karena Cloudflare bot ikut commit `AGENTS.md`. Solusi:
  `git rebase origin/main` lalu `git push origin main`.
- **Secret worker**: `npx wrangler secret put GEMINI_API_KEY` (feed dari stdin).
  Tanpa secret itu OCR TIDAK jalan (balasan 503 "Secret belum dipasang").
- **Worker AI**: binding `AI` di `wrangler.jsonc` → `env.AI` (Cloudflare
  Workers AI, gratis 10.000 neuron/hari). Format balasan per model berbeda:
  - `@cf/openai/gpt-oss-120b` → `{ choices: [{ message: { content } }] }`
  - `@cf/meta/llama-3.2-3b-instruct` → `{ response: "teks" }`
  - `@cf/google/gemma-2b-it-lora` → `{ generated_text: "teks" }`
  Parser di `worker.js` sudah menangani ketiganya.
- Cloudflare WAF: **`workers.dev` memakai "Browser Integrity Check" (WAF)**
  yang aktif otomatis. Request dengan User-Agent kosong atau
  `Python-urllib/*` → **HTTP 403 "error code: 1010"**. User-Agent lain
  (`QwenLive/1.0`, `curl/8.0`, `Mozilla/5.0`, `Node.js/20`, `axios/1.7`,
  `PostmanRuntime/7.39`) **lolos**. Akun ini **tidak punya zone** (cuma
  `workers.dev`) jadi **tidak ada** menu Security > Threats > Rules untuk
  dimatikan — dan tidak perlu, karena cukup kirim User-Agent yang benar.
  **Selalu pakai `worker_ai.py` (Python) atau `worker-ai.ps1` (PowerShell)**
  untuk memanggil worker; keduanya sudah memasang header yang benar.
  `server.ts` aman karena `fetch` Node otomatis kirim UA `node`.

### 11.7.1 Grant Data API Supabase (WAJIB — 30 Okt 2026)

Supabase **berhenti memberi grant Data API otomatis ke tabel BARU** di schema
`public` yang dibuat setelah 30 Oktober 2026. Tabel yang sudah ada tidak
terpengaruh.

- Grant yang wajib untuk tiap tabel baru:
  ```sql
  grant select on public.tabel to anon;
  grant select, insert, update, delete on public.tabel to authenticated;
  grant select, insert, update, delete on public.tabel to service_role;
  ```
- `supabase-setup.sql` & `kulakan-setup.sql` sudah punya grant ini.
- `supabase-data-api-grants.sql` = script idempotent untuk tabel yang SUDAH ADA.
- `supabase-public-viewer.sql` = tampilan publik (baca saja) + hak tulis hanya
  pemilik. Jalankan setelah file setup.
- **Cara menjalankan**: buka file SQL → salin **ISI** file → paste di
  Supabase > SQL Editor > New query > Run. **Jangan tulis nama file di SQL
  Editor** (SQL Editor hanya menerima SQL, bukan path file).
- Cek hasil:
  ```sql
  select table_name, grantee, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('transactions','receivables','business_settings','kulakan','supplier_kulakan')
  order by table_name, grantee, privilege_type;
  ```
- Supabase CLI (`npx supabase`) terpasang tapi belum login → butuh
  `supabase login` (access token). Alternatif tanpa token: SQL Editor manual.

### 11.8 Jebakan Rowboat yang sudah pernah terjadi

| Gejala | Akar masalah | Solusi |
|--------|--------------|--------|
| Turn menggantung selamanya di `turn_created` | `provider` di agent `.md` = nama key di `models.json.providers`, bukan `flavor`. Key hilang → `resolveProviderConfig()` throw | Tambahkan key `google` dengan `flavor: "google"` |
| `models:test` / `models:getConfig` HTTP 400 | `models:test` butuh `provider` sebagai **objek** LlmProvider, bukan string. `models:getConfig` butuh body `null` | Kirim `{"provider":{"flavor":"google","apiKey":"..."},"model":"..."}` |
| Qwen jawab "18 Mei 2025, Rp 0" | Sesi lama membawa turn dari provider/masa lalu → konteks tercemar | Hapus sesi, buat sesi baru (lihat `qwen-live-sesi.txt`) |
| Ribuan sesi "| Qwen Live" bertumpuk | Retry loop membuat sesi baru tiap gagal-kuota | **Reuse sesi yang sama**; model di-override per-request |
| Rowboat mengabaikan `model` di `sessions:sendMessage` | Field model tidak ada di payload | Pakai `config.agent.overrides.model = {provider, model}` |

### 11.9 Sesi Rowboat

- Sesi produksi disimpan di `qwen-live-sesi.txt` (root project).
- Sesi produksi harus **bersih** (turn pertama, tanpa riwayat model lain).
- Kalau jawabannya meleset (tanggal/angka aneh), periksa `sessions:list` —
  jangan sampai sesi produksi punya banyak turn dari percobaan sebelumnya.

## 12. Template Tugas dari User (Opsional)

```
TUJUAN: (apa yang ingin dicapai)
KRITERIA BERHASIL: (bagaimana saya tahu sudah benar, mis. "tombol X membuka halaman Y dan data tersimpan")
STACK/PROJECT: (folder atau repo)
BATASAN: (hal yang tidak boleh diubah)
```

Jika user hanya memberi tujuan singkat, agent menyusun sendiri kriteria berhasilnya di langkah 1 dan lanjut bekerja.
