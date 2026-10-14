-- ============================================================================
-- Supabase setup untuk Toko Grosir AR-Rahman
-- Jalankan di: Supabase Dashboard > SQL Editor > New query > Run
--
-- SEBELUM menjalankan file ini:
--   1) Buat akun pengguna: Authentication > Users > Add user (isi email + password,
--      centang "Auto Confirm User"). Pastikan Anda bisa masuk ke aplikasi dengan akun itu.
--   2) Matikan pendaftaran publik: Authentication > Sign In / Providers >
--      matikan "Allow new users to sign up". Jika tidak dimatikan, siapa pun bisa mendaftar
--      sendiri lalu ikut mengakses data (kebijakan di bawah mengizinkan semua pengguna login).
--
-- Setelah file ini dijalankan, akses tanpa login (kunci "anon") ke data keuangan DITOLAK.
-- Versi aplikasi lama (tanpa login) berhenti bisa membaca data, jadi deploy versi baru dulu.
-- ============================================================================

begin;

-- ---------- 1. Tabel transactions: hanya pengguna login ----------
alter table public.transactions enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'transactions' loop
    execute format('drop policy %I on public.transactions', p.policyname);
  end loop;
end $$;

create policy "transactions_select_login" on public.transactions for select to authenticated using (true);
create policy "transactions_insert_login" on public.transactions for insert to authenticated with check (true);
create policy "transactions_update_login" on public.transactions for update to authenticated using (true) with check (true);
create policy "transactions_delete_login" on public.transactions for delete to authenticated using (true);

revoke all on public.transactions from anon;
grant select, insert, update, delete on public.transactions to authenticated;

-- ---------- 2. Hutang & piutang ----------
create table if not exists public.receivables (
  id             text primary key,
  tipe           text not null check (tipe in ('piutang', 'hutang')),  -- piutang = pelanggan berutang ke toko; hutang = toko berutang ke supplier
  pihak          text not null,                                         -- nama pelanggan / supplier
  nominal        bigint not null check (nominal > 0),
  tanggal        date not null,                                         -- tanggal transaksi kredit
  jatuh_tempo    date,
  status         text not null default 'belum' check (status in ('belum', 'lunas')),
  catatan        text,
  dibayar_tanggal date,
  created_at     timestamptz not null default now()
);

alter table public.receivables enable row level security;
drop policy if exists "receivables_all_login" on public.receivables;
create policy "receivables_all_login" on public.receivables for all to authenticated using (true) with check (true);
revoke all on public.receivables from anon;
grant select, insert, update, delete on public.receivables to authenticated;

-- ---------- 3. Pengaturan bisnis (target omzet, batas biaya, dll.) ----------
create table if not exists public.business_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.business_settings enable row level security;
drop policy if exists "settings_all_login" on public.business_settings;
create policy "settings_all_login" on public.business_settings for all to authenticated using (true) with check (true);
revoke all on public.business_settings from anon;
grant select, insert, update, delete on public.business_settings to authenticated;

commit;
