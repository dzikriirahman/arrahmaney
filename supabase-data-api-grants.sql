-- supabase-data-api-grants.sql
-- CARA PAKAI: buka file ini, SALIN SEMUA (Ctrl+A lalu Ctrl+C),
-- lalu paste di Supabase > SQL Editor > New query > Run.
-- JANGAN tulis nama file di SQL Editor.
--
-- Untuk aksi: Supabase (akun) berhenti memberi grant Data API otomatis ke
-- tabel BARU di schema "public" yang dibuat setelah 30 Oktober 2026.
-- Tabel yang SUDAH ADA tidak terpengaruh - grantnya tetap.
--
-- File ini aman dijalankan kapan saja (idempotent): hanya memberi grant yang
-- belum ada, tidak menghapus apa pun, tidak mengubah policy.

-- ---------- 1. Tabel utama ----------
grant select on public.transactions to anon;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.transactions to service_role;

grant select on public.receivables to anon;
grant select, insert, update, delete on public.receivables to authenticated;
grant select, insert, update, delete on public.receivables to service_role;

grant select on public.business_settings to anon;
grant select, insert, update, delete on public.business_settings to authenticated;
grant select, insert, update, delete on public.business_settings to service_role;

grant select on public.kulakan to anon;
grant select, insert, update, delete on public.kulakan to authenticated;
grant select, insert, update, delete on public.kulakan to service_role;

grant select on public.supplier_kulakan to anon;
grant select, insert, update, delete on public.supplier_kulakan to authenticated;
grant select, insert, update, delete on public.supplier_kulakan to service_role;

-- ---------- 2. Sequence (hanya tabel yang pakai generated always as identity) ----------
-- transactions & receivables memakai id text, jadi TIDAK punya sequence.
grant usage, select on sequence public.kulakan_id_seq to authenticated, service_role;
grant usage, select on sequence public.supplier_kulakan_id_seq to authenticated, service_role;

-- ============================================================================
-- CARA CEK HASIL (jalankan terpisah, boleh juga kosong):
--   select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and table_name in ('transactions','receivables','business_settings','kulakan','supplier_kulakan')
--   order by table_name, grantee, privilege_type;
-- ============================================================================
