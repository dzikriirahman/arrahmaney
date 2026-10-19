-- Public read-only access for shared family viewing.
-- Only dzikrii.rahman@gmail.com may insert, update, or delete application data.
-- Run in Supabase SQL Editor after reviewing: data in these tables will be readable
-- without login by anyone who can reach the Supabase project API.

begin;

create or replace function public.is_arrahmaney_owner()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'dzikrii.rahman@gmail.com';
$$;

revoke all on function public.is_arrahmaney_owner() from public;
grant execute on function public.is_arrahmaney_owner() to anon, authenticated;

do $$
declare
  target_table text;
  policy_name text;
  table_oid regclass;
  sequence_oid regclass;
begin
  foreach target_table in array array[
    'transactions',
    'receivables',
    'business_settings',
    'kulakan',
    'supplier_kulakan'
  ]
  loop
    table_oid := to_regclass(format('public.%I', target_table));
    if table_oid is null then
      continue;
    end if;

    execute format('alter table %s enable row level security', table_oid);

    for policy_name in
      select p.policyname
      from pg_policies p
      where p.schemaname = 'public' and p.tablename = target_table
    loop
      execute format('drop policy %I on %s', policy_name, table_oid);
    end loop;

    execute format(
      'create policy arrahmaney_public_read on %s for select to anon, authenticated using (true)',
      table_oid
    );
    execute format(
      'create policy arrahmaney_owner_write on %s for all to authenticated using (public.is_arrahmaney_owner()) with check (public.is_arrahmaney_owner())',
      table_oid
    );

    execute format('revoke all on %s from anon', table_oid);
    execute format('grant select on %s to anon, authenticated', table_oid);
    execute format(
      'grant insert, update, delete on %s to authenticated',
      table_oid
    );

    if exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = target_table
        and c.column_name = 'id'
    ) then
      sequence_oid := pg_get_serial_sequence(format('public.%I', target_table), 'id');
      if sequence_oid is not null then
        execute format('grant usage, select on sequence %s to authenticated', sequence_oid);
      end if;
    end if;
  end loop;
end
$$;

commit;
