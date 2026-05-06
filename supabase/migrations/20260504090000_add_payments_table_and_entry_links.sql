create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  method text not null check (method in ('manual', 'mercado_pago_pix')),
  provider text check (provider is null or provider in ('mercado_pago')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'expired', 'failed')),
  amount numeric(10, 2) not null check (amount > 0),
  entry_count integer not null default 1 check (entry_count > 0),
  external_reference text not null unique,
  mercado_pago_order_id text unique,
  mercado_pago_payment_id text,
  mercado_pago_status text,
  mercado_pago_status_detail text,
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  webhook_last_payload jsonb,
  raw_response jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.payments
add column if not exists user_id uuid references public.users(id) on delete cascade,
add column if not exists round_id uuid references public.rounds(id) on delete cascade,
add column if not exists method text,
add column if not exists provider text,
add column if not exists status text default 'pending',
add column if not exists amount numeric(10, 2),
add column if not exists entry_count integer default 1,
add column if not exists external_reference text,
add column if not exists mercado_pago_order_id text,
add column if not exists mercado_pago_payment_id text,
add column if not exists mercado_pago_status text,
add column if not exists mercado_pago_status_detail text,
add column if not exists qr_code text,
add column if not exists qr_code_base64 text,
add column if not exists ticket_url text,
add column if not exists expires_at timestamptz,
add column if not exists paid_at timestamptz,
add column if not exists cancelled_at timestamptz,
add column if not exists webhook_last_payload jsonb,
add column if not exists raw_response jsonb,
add column if not exists created_at timestamptz default timezone('utc', now()),
add column if not exists updated_at timestamptz default timezone('utc', now());

create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_round_id_idx on public.payments(round_id);
create index if not exists payments_status_idx on public.payments(status);
create index if not exists payments_method_idx on public.payments(method);

alter table public.entries
add column if not exists payment_id uuid references public.payments(id) on delete set null;

create index if not exists entries_payment_id_idx on public.entries(payment_id);

alter table public.payments enable row level security;

drop policy if exists "payments_select_own_or_admin" on public.payments;
create policy "payments_select_own_or_admin"
on public.payments
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
);

drop policy if exists "payments_update_admin_only" on public.payments;
create policy "payments_update_admin_only"
on public.payments
for update
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

create or replace function public.close_expired_rounds()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.entries e
  set payment_status = 'cancelled'
  from public.rounds r
  where e.round_id = r.id
    and r.status = 'open'
    and r.end_date is not null
    and (
      r.end_date::timestamp + coalesce(r.end_time, time '23:59:00')
    ) <= timezone('America/Sao_Paulo', now())
    and e.payment_status = 'pending';

  update public.payments p
  set status = 'cancelled',
      cancelled_at = coalesce(p.cancelled_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  from public.rounds r
  where p.round_id = r.id
    and r.status = 'open'
    and r.end_date is not null
    and (
      r.end_date::timestamp + coalesce(r.end_time, time '23:59:00')
    ) <= timezone('America/Sao_Paulo', now())
    and p.status = 'pending';

  update public.rounds r
  set status = 'closed'
  where r.status = 'open'
    and r.end_date is not null
    and (
      r.end_date::timestamp + coalesce(r.end_time, time '23:59:00')
    ) <= timezone('America/Sao_Paulo', now());
end;
$$;

grant execute on function public.close_expired_rounds() to authenticated;
