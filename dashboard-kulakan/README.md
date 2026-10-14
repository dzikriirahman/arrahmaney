# Dashboard Kulakan — Toko Grosir AR-Rahman
Dashboard widget (ringkasan, buku kulakan, supplier & pemasukan) yang berdiri sendiri di folder ini. Tidak mengubah aplikasi utama.

## Menjalankan lokal
1. Supabase > SQL Editor: jalankan `schema.sql` (akses hanya untuk pengguna login, sama seperti tabel `transactions`).
2. Isi `config.js` dengan Project URL dan anon key. Buat akun di Authentication > Users, matikan pendaftaran publik.
3. `python3 -m http.server 8080` lalu buka http://localhost:8080 dan masuk dengan akun tersebut.

## Data awal
`seed.sql` dan `data.json` (hasil konversi Excel BELANJA_KULAKAN) berisi harga beli dan kontak supplier, jadi **sengaja tidak di-commit** ke repo publik (lihat `.gitignore`). Simpan di komputer Anda, jalankan `seed.sql` di SQL Editor. Tanpa `config.js` dan `data.json`, halaman tampil kosong.
