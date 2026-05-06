revoke all on function public.close_expired_rounds() from public;
revoke all on function public.close_expired_rounds() from anon;
grant execute on function public.close_expired_rounds() to authenticated;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;
