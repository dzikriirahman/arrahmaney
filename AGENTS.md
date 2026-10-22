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
- **Satu koneksi Baileys saja per akun.** Server MCP (`server.ts` → `wa/kirim.ts`)
  adalah **pemilik tunggal** koneksi WhatsApp. `wa/jadwal.ts` **TIDAK** membuka
  koneksi Baileys sendiri — ia meneruskan pesan ke tool MCP lewat
  `wa/kirim-via-mcp.ts`. Kunci lintas-proses: `wa/koneksi.lock` (PID pemilik).

### 11.5.1 Laporan harian dobel — sudah diperbaiki (22 Okt 2026)

**Gejala:** Dzikri menerima 2 pesan di group: satu dari rekap terjadwal 19:00
(`wa/jadwal.ts`), satu lagi dari Qwen Live 10 detik kemudian.

**Akar penyebab (3 lapis, semuanya sudah ditutup):**

1. **Salah mengartikan pertanyaan.** Tanya "qwen paling laris hari ini apa saja"
   memicu Qwen membuat + mengirim laporan harian. → Diperbaiki di
   `~/.rowboat/agents/kasir-ar-rahman.md` dan
   `~/.rowboat/skills/kasir-pos/SKILL.md`: pertanyaan analisis data
   ("paling laris hari ini", "omzet hari ini") dijawab **di chat** dengan tool
   data, **tidak pernah** memicu `kirim_pesan_whatsapp`.
2. **Tidak ada guard anti-dobel.** → `wa/rekap-terkirim.ts` (baru): setelah
   rekap terjadwal terkirim, penanda ditulis ke `wa/rekap-terkirim.json`.
   Tool `kirim_pesan_whatsapp` di `server.ts` membaca penanda itu dan
   **menolak** mengirim rekap yang sama pada tanggal yang sama.
3. **Pesan menggantung "waiting for message".** Dua proses Baileys (jadwal +
   MCP) berebut satu koneksi WhatsApp → saling menendang → `sendMessage`
   menggantung selamanya. → (a) `wa/jadwal.ts` kini proxy ke MCP, tidak pernah
   buka koneksi sendiri; (b) `wa/kirim.ts` punya timeout 30 detik per
   `sendMessage` (`denganBatasWaktu`); (c) `wa/koneksi.lock` mencegah
   koneksi kedua.

**Penting:** kalau(`wa/koneksi.lock` hilang) / proses mati mendadak, hapus file
itu sebelum menyalakan ulang service.

**Cara tes cepat (tidak mengirim pesan sungguhan ke group):**

```powershell
$key = (Get-Content 'd:\kasir-mcp-sketch\wa\mcp-auth.json' -Raw | ConvertFrom-Json).Authorization
# kirim pesan rekap → harus DITOLAK
# (lihat mcp-akses.log: tool=kirim_pesan_whatsapp)
```

### 11.5.2 Backup secret

`backup-secret.py` (root project) mengbacks-up **semua** secret ke SATU file
terenkripsi AES-256-GCM: `secret-backup/rahasia-toko.enc`.

- Isi: 4 env var user Windows (`KASIR_MCP_TOKEN`, `GEMINI_API_KEY`,
  `GOOGLE_API_KEY`, `CLOUDFLARE_API_TOKEN`), 8 file sensitif (sesi WhatsApp
  Baileys, token MCP, `models.json`, `mcp.json`, kunci Rowboat, OAuth token
  Wrangler, config Ollama), + `SUPABASE_URL` & `SUPABASE_ANON_KEY`.
- Nilai secret **tidak pernah** dicetak ke terminal/log.
- `secret-backup/` + `*.enc` sudah masuk `.gitignore` (root).

```powershell
python backup-secret.py            # buat backup baru (minta frasa sandi)
python backup-secret.py --verify   # bukti backup cocok dengan sumber live
python backup-secret.py --list     # daftar isi (nama saja)
python backup-secret.py --restore  # pulihkan ke env & file
```

**Frasa sandi** harus disimpan terpisah (password manager). Tanpa itu file
backup tidak bisa dibuka.

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

### 11.10 Cloudflare API token (deploy Worker)

Token OAuth `wrangler login` hanya berlaku **beberapa jam** (kedaluwarsa
di `~/.wrangler/config/default.toml`, field `expiration_time`). Kalau habis,
`npx wrangler deploy` gagal dengan `Invalid access token`.

Solusi: **API token permanen** + variabel environment `CLOUDFLARE_API_TOKEN`.

| Helper | Pemakaian |
|---|---|
| `cloudflare_token.py` | `python cloudflare_token.py` → tempel token → disimpan ke registry `HKCU\Environment` |
| `cloudflare-token.ps1` | `.\cloudflare-token.ps1` → tempel token → disimpan ke environment user |
| Cek saja | `python cloudflare_token.py --verify` |

Membuat token (butuh login dashboard):
- **User token** (`cfut_...`): https://dash.cloudflare.com/profile/api-tokens
- **Account token** (`cfat_...`, lebih permanen, recommended):
  https://dash.cloudflare.com/2eb226a4cb90e1d9f3b97c12de9d8101/account/api-tokens

Permission yang wajib dicentang — **penting: nama di UI dashboard berbeda
dari nama di Cloudflare API.**

| Di UI dashboard (yang dilihat user) | Di Cloudflare API (permission_groups) |
|---|---|
| Baris **"Workers Scripts"**, kolom **Read** | `Workers Scripts Read` (id `1a71c399035b4950a1bd1466bbe4f420`) |
| Baris **"Workers Scripts"**, kolom **Edit** | `Workers Scripts Write` (id `e086da7e2179491d91ee5f35b3ca210a`) |

Jadi di UI Akun ini permission-nya **1 baris "Workers Scripts" dengan 2 kolom
(Read | Edit)** — bukan dua baris terpisah. **Read** sudah otomatis tercentang
dari template; yang WAJIB dicentang manual adalah kolom **Edit** (itu yang
memberi izin deploy).

Isi template **"Edit Cloudflare Workers"** (11 permissions, dari docs resmi
`developers.cloudflare.com/fundamentals/api/reference/template/`):

| Permission | Resource |
|---|---|
| Workers Routes Write | Zone |
| **Workers Scripts Write** | **Account** ← yang kita butuh |
| Workers KV Storage Write | Account |
| Workers Tail Read | Account |
| Workers R2 Storage Write | Account |
| Account Settings Read | Account |
| User Details Read | User |
| User Memberships Read | User |

Di UI, "Workers Scripts Write" dirender sebagai baris **"Workers Scripts"**
dengan dua kolom (Read | Edit). Jadi Developer Platform menampilkan 4 baris:
Cloud Connector | Workers Routes | **Workers Scripts** | Workers KV Storage
(versi Read dan Write digabung ke satu baris dengan 2 kolom).

Langkah di dashboard (Account API tokens → Create a token):
1. Template **"Edit Cloudflare Workers"** → expanded, kategori
   **Developer Platform** (4/4).
2. Baris **"Workers Scripts"**: centang kolom **Edit** (Read biasanya sudah
   tercentang).
3. Kalau kolom Edit tidak bisa diklik (role akun membatasi) → **Bulk Select →
   "Write all resources"**.
4. **Zone permissions: KOSONGKAN** — akun ini tidak punya zone.
5. **Account Resources → Include → Specific account →
   `Dzikrii.rahman@gmail.com's Account`**.
6. Continue to summary → Create Token. Token hanya ditampilkan SEKALI
   (format `cfat_` untuk account token, `cfut_` untuk user token).

### Verifikasi token — endpoint BERBEDA per jenis token

| Jenis token | Prefix | Endpoint verify |
|---|---|---|
| **Account token** (yang dipakai project ini) | `cfat_` | `GET /accounts/2eb226a4cb90e1d9f3b97c12de9d8101/tokens/verify` |
| User token | `cfut_` | `GET /user/tokens/verify` |

Memakai endpoint yang salah -> **"Invalid API Token" (401)** padahal tokennya
sah. `cloudflare_token.py` & `cloudflare-token.ps1` sudah mencoba keduanya.

Header wajib: `Authorization: Bearer <token>` + `User-Agent` (tanpa User-Agent
Cloudflare balas 403 / 1010).

### Cara UI dashboard (verified 22 Okt 2026)

URL yang benar (tanpa `account/`):
`https://dash.cloudflare.com/2eb226a4cb90e1d9f3b97c12de9d8101/api-tokens`

Langkah:
1. **Create Token** -> template **"Start from scratch"** (Custom).
   Template "Edit Cloudflare Workers" bisa gagal: daftar permission groups
   tidak termuat (console: `Permission label "workers_scripts_write" not found
   in permission groups`) sehingga hanya 2 baris yang tampil.
   Mode Custom memuat **Developer Platform 0/62** dengan semua permission.
2. Scope dropdown: **Entire Account**.
3. Search: `Workers Scripts` -> baris **"Workers Scripts"** bertanda
   **Legacy**, centang kolom **Edit** (deskripsi jadi "Grants write access to
   Cloudflare Workers scripts"). Ada juga permission baru **"Workers"**
   (Metadata Read-only / Content Read-only / Editor / Admin) - itu untuk
   akses script source, bukan yang dipakai `wrangler deploy`.
4. Account Resources -> Include -> Specific account ->
   `Dzikrii.rahman@gmail.com's Account`. Zone Resources kosongkan.
5. Token expiration -> **No expiration**.
6. Continue to summary -> Create Token. Token `cfat_...` hanya ditampilkan
   SEKALI.

### Token yang sudah terpasang

`CLOUDFLARE_API_TOKEN` tersimpan di registry `HKCU\Environment` (permanen,
diterima semua terminal baru). `npx wrangler whoami` kini reporting
"logged in with an Account API Token". Deploy tidak pernah expired lagi.

Token ID: `d5bbf0fb976582bf3253978ae5557d43` (status active).

Akun ini **pakai SSO Google**. Kalau login dashboard gagal: pakai email yang
**sama persis** dengan yang terdaftar di Cloudflare
(`dzikrii.rahman@gmail.com`). Alternatif tanpa dashboard: `npx wrangler login`.

Tambahan penting (terverifikasi 22 Okt 2026 via Cloudflare API):

- Role akun: **Super Administrator - All Privileges**
  (`worker: {edit: true, read: true}`). Jadi permission "Workers Scripts"
  kolom **Edit BISA** dicentang. Pesan "Selectable permission groups are
  limited to actions based on your account membership roles" cuma
  informatif, bukan error.
- Akun **tidak punya zone** -> semua permission Zone memang tidak tersedia.
  Itu normal, bukan masalah.
- Token OAuth `wrangler login` punya scope `workers_scripts:write` +
  `account:read` + `user:read` - **cukup untuk deploy**, tapi **tidak** punya
  scope pembuatan API token (`account_api_tokens:write`). Jadi **API token
  hanya bisa dibuat lewat dashboard**, tidak bisa lewat API.
- `GET /accounts/<id>/tokens/permission_groups` dan
  `POST /accounts/<id>/tokens` -> **403 (9109)** kalau pakai token OAuth
  wrangler. Jangan coba bypass lewat API.
- OAuth wrangler expired **2026-10-22 08:44 UTC (15:44 WIB)**. Cek
  `expiration_time` di
  `%APPDATA%\xdg.config\.wrangler\config\default.toml`. Kalau sudah lewat:
  `npx wrangler login` (browser OAuth) atau pakai `CLOUDFLARE_API_TOKEN`
  permanen.

### 11.12 OCR Struk (Worker) - SUDAH DIVERIFIKASI

Alur: `Struk` tab -> `Galeri / File` (foto per tahap) -> `Deteksi Tahap Ini`
-> `Terapkan Hasil Tahap Ini` (WAJIB tiap tahap, berurutan) -> `Simpan Detail
Pengeluaran`.

Empat tahap: 1. Nama barang, 2. Jumlah, 3. Harga satuan, 4. Total per barang.
Tiap tahap pakai **foto khusus** (bisa di-crop dulu) supaya akurasinya tinggi.

Hasil test end-to-end 22 Okt 2026 (foto struk sintetis, 6 barang) - **semua 4
tahap 100% benar**:
- Nama    : BERAS 1KG / MINYAK GORENG 1L / GULA PASIR 1/4KG / SABUN MANDI BAR / TEH CELUP 25S / GARAM 1/2KG
- Jumlah  : 2 3 4 5 1 6
- Harga   : 14000 16500 4500 5500 9500 3000
- Total   : 28000 49500 18000 27500 9500 18000

Secret worker yang WAJIB ada (semua sudah terpasang):
- `GEMINI_API_KEY` - kunci Gemini
- `GEMINI_MODEL` - daftar model, dipisah koma
- `SUPABASE_ANON_KEY` - untuk verifikasi user (getUser). **Tanpa ini OCR selalu
  401 "Sesi login berakhir"**.

Model OCR (semua sudah diuji vision + tool):
`gemini-3.5-flash-lite` (default, 1.8s) | `gemini-3-flash-preview` (6.1s) |
`gemini-3.8-flash` (6.4s) | `gemini-3.1-flash-lite-preview` (13.6s).
**Jangan pakai `gemini-2.5-flash`** -> 404 "no longer available to new users".

Error yang sudah ditangani di `worker.js`:
- `429 quota exceeded` -> coba model berikutnya
- `404 model not found` -> coba model berikutnya
- `400 User location is not supported for the API use.` -> **retry** (kadang
  region egress Cloudflare tidak didukung; bersifat sementara)
- `400` + `thinkingConfig` -> retry tanpa thinking

`OCR_TOTAL_MS` (default 9000) = budget total satu permintaan OCR.

Skrip bantu test: `buat_struk_uji.py` -> membuat 4 foto struk sintetis
(`ocr-test-struk-<tahap>.jpg`) untuk menguji OCR tanpa struk asli.

### 11.13 Menjalankan services (semua background, tidak ada window)

Tidak ada CMD/terminal yang perlu dibiarkan terbuka. Semua service jalan
TERPISAH (detached) sehingga **tidak bisa ter-close** dan jendela yang
menaik-menaik boleh ditutup tanpa apa pun.

| Perintah | Fungsi |
|---|---|
| `MULAI-SEMUA.cmd` | Nyalakan semua: penjaga, MCP 8787, WA 19:00, Qwen 5000, kasir HP 8765, hotspot |
| `MATI-SEMUA.cmd` | Matikan semua (panggil `mati-semua.ps1`) |
| `mulai-semua.ps1` | Isi logika start (dipanggil MULAI-SEMUA.cmd) |
| `mati-semua.ps1` | Isi logika stop (dipanggil MATI-SEMUA.cmd) |

Startup Windows: shortcut **"MULAI-SEMUA (AR-RAHMAN).lnk"** di
`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup` (window
minimized) + shortcut lama **"KasirARRahman-Auto.lnk"** yang memanggil
`mulai-otomatis.ps1`. Jadi service otomatis hidup setiap login.

`jaga-server.ps1` (+ `jaga-hp.ps1`, `jaga-qwen.ps1`) adalah **penjaga**:
tiap 5 menit mengecek port 8787/5000/8765 + proses WA jadwal, dan
menyalakan ulang yang mati. Itu sebabnya menutup CMD tidak=rowan masalah.

Catatan: Rowboat (port 3220) **tidak** ikut start di MULAI-SEMUA. Dia
lazy-start on-demand dari chatbubble saat ada chat yang perlu. Itu normal.

### 11.14 Ringkasan status per 22 Okt 2026 (siang)

| Komponen | Status |
|---|---|
| Import Kulakan Excel | 178/178 baris, deploy production |
| Tombol Edit + Hapus di card Pemasok | live |
| Qwen Live + 20 tool kasir | 2.6-45s, data benar |
| Rantai AI 6 lapis (termasuk Workers AI) | terverifikasi |
| OCR struk 4 tahap | 4/4 tahap 100% benar |
| Cloudflare API token permanen | `cfat_` di HKCU\Environment |
| Grant Data API Supabase | dijalankan, terverifikasi |

## 12. Template Tugas dari User (Opsional)

```
TUJUAN: (apa yang ingin dicapai)
KRITERIA BERHASIL: (bagaimana saya tahu sudah benar, mis. "tombol X membuka halaman Y dan data tersimpan")
STACK/PROJECT: (folder atau repo)
BATASAN: (hal yang tidak boleh diubah)
```

Jika user hanya memberi tujuan singkat, agent menyusun sendiri kriteria berhasilnya di langkah 1 dan lanjut bekerja.
