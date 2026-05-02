alter table public.rounds
add column if not exists end_time time;

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
