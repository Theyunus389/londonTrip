-- Run once after the original migration. Old private trips remain unchanged.
begin;
create table public.shared_places (
 id uuid primary key,
 data jsonb not null check(jsonb_typeof(data)='object' and data->>'id'=id::text),
 name_key text generated always as (lower(regexp_replace(data->>'name','[^[:alnum:]]','','g'))) stored unique,
 created_at timestamptz not null default now()
);
alter table public.shared_places enable row level security;
revoke all on public.shared_places from public,anon,authenticated;
grant select,insert,update,delete on public.shared_places to service_role;
-- Tiny revision checks avoid downloading the entire list on every device refresh.
create table public.shared_list_state(singleton boolean primary key default true check(singleton),revision bigint not null default 0);
insert into public.shared_list_state values(true,0);
alter table public.shared_list_state enable row level security;
revoke all on public.shared_list_state from public,anon,authenticated;
create function public.bump_shared_revision() returns trigger language plpgsql security definer set search_path='' as $$begin update public.shared_list_state set revision=revision+1 where singleton;return null;end$$;
revoke all on function public.bump_shared_revision() from public,anon,authenticated;
create trigger shared_revision after insert or update or delete on public.shared_places for each statement execute function public.bump_shared_revision();
create function public.shared_list_revision() returns bigint language sql security definer set search_path='' as $$select revision from public.shared_list_state where singleton$$;
revoke all on function public.shared_list_revision() from public,anon,authenticated;
grant execute on function public.shared_list_revision() to service_role;
-- The public website reads through its server. Direct anonymous database writes are forbidden.
create table public.shared_pin_attempts (key text primary key,started timestamptz not null,hits integer not null check(hits>0));
alter table public.shared_pin_attempts enable row level security;
revoke all on public.shared_pin_attempts from public,anon,authenticated;
create function public.consume_shared_pin_attempt(fingerprint text) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;g integer;
begin
 -- Same lock order across all requests; the limits persist across serverless instances.
 insert into public.shared_pin_attempts values('global',now(),1)
 on conflict(key) do update set hits=case when public.shared_pin_attempts.started<now()-interval '15 minutes' then 1 else public.shared_pin_attempts.hits+1 end,started=case when public.shared_pin_attempts.started<now()-interval '15 minutes' then now() else public.shared_pin_attempts.started end returning hits into g;
 insert into public.shared_pin_attempts values(fingerprint,now(),1)
 on conflict(key) do update set hits=case when public.shared_pin_attempts.started<now()-interval '15 minutes' then 1 else public.shared_pin_attempts.hits+1 end,started=case when public.shared_pin_attempts.started<now()-interval '15 minutes' then now() else public.shared_pin_attempts.started end returning hits into n;
 delete from public.shared_pin_attempts where started<now()-interval '1 day';
 return n<=5 and g<=50;
end $$;
create function public.import_shared_places(items jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare item jsonb;n integer;total integer:=0;
begin
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 200 then raise exception 'Expected 1 to 200 places';end if;
 for item in select jsonb_array_elements(items) loop
 insert into public.shared_places(id,data) values((item->>'id')::uuid,item) on conflict do nothing;
 get diagnostics n=row_count;total:=total+n;
 end loop;return total;
end $$;
revoke all on function public.consume_shared_pin_attempt(text),public.import_shared_places(jsonb) from public,anon,authenticated;
grant execute on function public.consume_shared_pin_attempt(text),public.import_shared_places(jsonb) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('shared-place-images','shared-place-images',false,2097152,array['image/jpeg','image/png','image/webp']);
-- No anonymous/authenticated storage policies. Only the server can upload/read this bucket.
commit;
