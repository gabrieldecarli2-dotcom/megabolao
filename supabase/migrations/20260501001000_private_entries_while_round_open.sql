do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'entries'
      and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.entries', policy_record.policyname);
  end loop;
end $$;

create policy "entries_select_private_until_round_closed"
on public.entries
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
  or (
    payment_status = 'paid'
    and exists (
      select 1
      from public.rounds r
      where r.id = public.entries.round_id
        and r.status <> 'open'
    )
  )
);
