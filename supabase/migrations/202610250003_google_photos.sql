-- Run once in Supabase SQL Editor. No existing place data is changed.
begin;
create table public.google_photo_usage (
 month date primary key,
 requests integer not null check(requests between 1 and 800)
);
alter table public.google_photo_usage enable row level security;
revoke all on public.google_photo_usage from public,anon,authenticated;

create function public.reserve_google_photo_request(request_limit integer default 800)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;cap integer:=least(greatest(coalesce(request_limit,0),0),800);
begin
 if cap=0 then return false;end if;
 insert into public.google_photo_usage(month,requests)
 values(date_trunc('month',now() at time zone 'UTC')::date,1)
 on conflict(month) do update set requests=public.google_photo_usage.requests+1
 where public.google_photo_usage.requests<cap
 returning requests into n;
 return n is not null;
end $$;
revoke all on function public.reserve_google_photo_request(integer) from public,anon,authenticated;
grant execute on function public.reserve_google_photo_request(integer) to service_role;
-- Counts persist across Vercel instances. No Google photo, URL or metadata is stored.
commit;
