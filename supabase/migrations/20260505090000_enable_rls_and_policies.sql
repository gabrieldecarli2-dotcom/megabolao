create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'users',
        'rounds',
        'entries',
        'draw_results',
        'entry_hits',
        'prize_rules',
        'payments'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

alter table public.users enable row level security;
alter table public.rounds enable row level security;
alter table public.entries enable row level security;
alter table public.draw_results enable row level security;
alter table public.entry_hits enable row level security;
alter table public.prize_rules enable row level security;
alter table public.payments enable row level security;

create policy "users_select_authenticated"
on public.users
for select
to authenticated
using (true);

create policy "users_insert_own"
on public.users
for insert
to authenticated
with check (id = auth.uid());

create policy "users_update_own_or_admin"
on public.users
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "users_delete_admin"
on public.users
for delete
to authenticated
using (public.is_admin());

create policy "rounds_select_visible_or_admin"
on public.rounds
for select
to authenticated
using (
  status = any (array['open', 'closed', 'finished'])
  or public.is_admin()
);

create policy "rounds_insert_admin"
on public.rounds
for insert
to authenticated
with check (public.is_admin());

create policy "rounds_update_admin"
on public.rounds
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "rounds_delete_admin"
on public.rounds
for delete
to authenticated
using (public.is_admin());

create policy "entries_select_private_until_round_closed"
on public.entries
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
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

create policy "entries_insert_own_pending"
on public.entries
for insert
to authenticated
with check (
  user_id = auth.uid()
  and payment_status = 'pending'
);

create policy "entries_update_admin"
on public.entries
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "entries_delete_admin"
on public.entries
for delete
to authenticated
using (public.is_admin());

create policy "draw_results_select_authenticated"
on public.draw_results
for select
to authenticated
using (true);

create policy "draw_results_insert_admin"
on public.draw_results
for insert
to authenticated
with check (public.is_admin());

create policy "draw_results_update_admin"
on public.draw_results
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "draw_results_delete_admin"
on public.draw_results
for delete
to authenticated
using (public.is_admin());

create policy "entry_hits_select_authenticated"
on public.entry_hits
for select
to authenticated
using (true);

create policy "entry_hits_insert_admin"
on public.entry_hits
for insert
to authenticated
with check (public.is_admin());

create policy "entry_hits_update_admin"
on public.entry_hits
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "entry_hits_delete_admin"
on public.entry_hits
for delete
to authenticated
using (public.is_admin());

create policy "prize_rules_select_authenticated"
on public.prize_rules
for select
to authenticated
using (true);

create policy "prize_rules_insert_admin"
on public.prize_rules
for insert
to authenticated
with check (public.is_admin());

create policy "prize_rules_update_admin"
on public.prize_rules
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "prize_rules_delete_admin"
on public.prize_rules
for delete
to authenticated
using (public.is_admin());

create policy "payments_select_own_or_admin"
on public.payments
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy "payments_update_admin"
on public.payments
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "payments_delete_admin"
on public.payments
for delete
to authenticated
using (public.is_admin());
