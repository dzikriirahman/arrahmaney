-- Tab "Kulakan": tabel supplier, kulakan, pemasukan. Jalankan di Supabase > SQL Editor.
-- Sama seperti supabase-setup.sql: hanya pengguna yang sudah login yang boleh membaca/menulis.
create table if not exists public.supplier(
  id bigint generated always as identity primary key,
  nama text unique not null, kategori text, kontak text, telp text, lokasi text, pembayaran text);
create table if not exists public.kulakan(
  id bigint generated always as identity primary key,
  tanggal date not null, no_nota text, kategori text, supplier text, barang text not null,
  qty numeric not null, satuan text, harga_beli numeric not null, biaya_angkut numeric default 0,
  harga_jual numeric, isi_per_satuan numeric default 1,
  total_modal numeric generated always as (qty*harga_beli+coalesce(biaya_angkut,0)) stored,
  margin numeric generated always as (case when harga_jual>0 then (harga_jual-(qty*harga_beli+coalesce(biaya_angkut,0))/nullif(qty,0))/harga_jual end) stored);
create table if not exists public.pemasukan(
  tanggal date primary key, pemasukan numeric not null, keuntungan numeric);

alter table public.supplier enable row level security;
alter table public.kulakan enable row level security;
alter table public.pemasukan enable row level security;
revoke all on public.supplier, public.kulakan, public.pemasukan from anon;
grant select,insert,update,delete on public.supplier, public.kulakan, public.pemasukan to authenticated;
drop policy if exists "login_all" on public.supplier; create policy "login_all" on public.supplier for all to authenticated using(true) with check(true);
drop policy if exists "login_all" on public.kulakan;  create policy "login_all" on public.kulakan  for all to authenticated using(true) with check(true);
drop policy if exists "login_all" on public.pemasukan; create policy "login_all" on public.pemasukan for all to authenticated using(true) with check(true);
