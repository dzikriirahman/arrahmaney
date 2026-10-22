-- Tab "Kulakan": tabel supplier_kulakan dan kulakan. Jalankan di Supabase > SQL Editor.
-- Catatan: tabel bernama "supplier" sudah dipakai sistem gudang di proyek ini, maka tab Kulakan memakai supplier_kulakan.
-- Sama seperti supabase-setup.sql: hanya pengguna yang sudah login yang boleh membaca/menulis.
create table if not exists public.supplier_kulakan(
  id bigint generated always as identity primary key,
  nama text unique not null, kategori text, kontak text, telp text, lokasi text, pembayaran text);
create table if not exists public.kulakan(
  id bigint generated always as identity primary key,
  tanggal date not null, no_nota text, kategori text, supplier text, barang text not null,
  qty numeric not null, satuan text, harga_beli numeric not null, biaya_angkut numeric default 0,
  harga_jual numeric, isi_per_satuan numeric default 1,
  total_modal numeric generated always as (qty*harga_beli+coalesce(biaya_angkut,0)) stored,
  margin numeric generated always as (case when harga_jual>0 then (harga_jual-(qty*harga_beli+coalesce(biaya_angkut,0))/nullif(qty,0))/harga_jual end) stored);
comment on column public.kulakan.margin is
  'Margin kotor = (harga_jual per satuan - HPP per satuan) / harga_jual. Harga beli, jumlah, dan harga jual harus memakai satuan yang sama; nilai negatif berarti harga jual di bawah HPP.';

alter table public.supplier_kulakan enable row level security;
alter table public.kulakan enable row level security;
revoke all on public.supplier_kulakan, public.kulakan from anon;
grant select,insert,update,delete on public.supplier_kulakan, public.kulakan to authenticated;
drop policy if exists "login_all" on public.supplier_kulakan; create policy "login_all" on public.supplier_kulakan for all to authenticated using(true) with check(true);
drop policy if exists "login_all" on public.kulakan;  create policy "login_all" on public.kulakan  for all to authenticated using(true) with check(true);

-- Grant Data API (Wajib sejak 30 Okt 2026).
-- Supabase berhenti memberi grant otomatis ke tabel yang dibuat setelah tanggal itu,
-- jadi tabel baru WAJIB diberi grant eksplisit di file yang sama yang membuat tabelnya.
-- Jalankan supabase-public-viewer.sql setelah file ini untuk mengaktifkan
-- tampilan publik (baca saja) + hak tulis khusus pemilik.
grant select on public.supplier_kulakan, public.kulakan to anon;
grant select,insert,update,delete on public.supplier_kulakan, public.kulakan to authenticated;
grant select,insert,update,delete on public.supplier_kulakan, public.kulakan to service_role;
grant usage, select on sequence public.supplier_kulakan_id_seq to authenticated, service_role;
grant usage, select on sequence public.kulakan_id_seq to authenticated, service_role;
