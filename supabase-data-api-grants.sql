-- supabase-data-api-grants.sql
--
-- Untuk aksi: Supabase (akun) berhenti memberi grant Data API otomatis ke
-- tabel BARU di schema "public" yang dibuat setelah 30 Oktober 2026.
-- Tabel yang SUDAH ADA tidak terpengaruh — grantnya tetap.
--
-- File ini aman dijalankan kapan saja (idempotent): hanya memberi grant yang
-- belum ada, tidak menghapus apa pun, tidak mengubah policy.
--
-- Jalankan di Supabase > SQL Editor. Satu kali cukup untuk tabel yang sekarang.

begin;

-- 1. Tabel yang sudah dipakai aplikasi
do $$
declare
  t text;
begin
  foreach t in array array[
    'transactions',
    'receivables',
    'business_settings',
    'kulakan',
    'supplier_kulakan'
  ]
  loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;

    -- Tampilan publik: baca saja untuk anon (policy RLS yang menentukan baris mana).
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);

    -- Sequence identity (kalau tabel pakai generated always as identity)
    if exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = t
        and c.column_name = 'id'
        and c.is_identity = 'YES'
    ) then
      execute format(
        'grant usage, select on sequence public.%I to authenticated, service_role',
        t || '_id_seq'
      );
    end if;
  end loop;
end
$$;

commit;

-- Cara cek hasil (jalankan terpisah, boleh kosong):
--   select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public' and table_name in
--     ('transactions','receivables','business_settings','kulakan','supplier_kulakan')
--   order by table_name, grantee, privilege_type;
