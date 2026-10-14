create table if not exists supplier(
  id bigint generated always as identity primary key,
  nama text unique not null, kategori text, kontak text, telp text, lokasi text, pembayaran text);
create table if not exists kulakan(
  id bigint generated always as identity primary key,
  tanggal date not null, no_nota text, kategori text, supplier text, barang text not null,
  qty numeric not null, satuan text, harga_beli numeric not null, biaya_angkut numeric default 0,
  harga_jual numeric, isi_per_satuan numeric default 1,
  total_modal numeric generated always as (qty*harga_beli+coalesce(biaya_angkut,0)) stored,
  margin numeric generated always as (case when harga_jual>0 then (harga_jual-(qty*harga_beli+coalesce(biaya_angkut,0))/nullif(qty,0))/harga_jual end) stored);
create table if not exists pemasukan(
  tanggal date primary key, pemasukan numeric not null, keuntungan numeric);
alter table supplier enable row level security; alter table kulakan enable row level security; alter table pemasukan enable row level security;
-- Hanya pengguna yang sudah login (Supabase Auth) yang boleh membaca/menulis, sama seperti tabel transactions.
revoke all on supplier, kulakan, pemasukan from anon;
grant select,insert,update,delete on supplier, kulakan, pemasukan to authenticated;
create policy "login_all" on supplier for all to authenticated using(true) with check(true);
create policy "login_all" on kulakan for all to authenticated using(true) with check(true);
create policy "login_all" on pemasukan for all to authenticated using(true) with check(true);
