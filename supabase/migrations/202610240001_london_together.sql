-- Apply once to a new Supabase project. No service-role key is used by the app.
begin;
revoke create on schema public from public;
create table public.trips (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 settings jsonb not null, created_at timestamptz not null default now(),
 constraint trip_settings_valid check (
 jsonb_typeof(settings)='object' and settings ?& array['name','travelers','limit','start','end'] and
 jsonb_typeof(settings->'name')='string' and length(trim(settings->>'name')) between 1 and 100 and
 jsonb_typeof(settings->'travelers')='number' and (settings->>'travelers')::numeric between 1 and 100 and (settings->>'travelers')::numeric=trunc((settings->>'travelers')::numeric) and
 (settings->'limit'='null'::jsonb or (jsonb_typeof(settings->'limit')='number' and (settings->>'limit')::numeric between 0 and 10000000)) and
 jsonb_typeof(settings->'start')='string' and jsonb_typeof(settings->'end')='string' and
 (settings->>'start'='' or settings->>'start' ~ '^\d{4}-\d{2}-\d{2}$') and
 (settings->>'end'='' or settings->>'end' ~ '^\d{4}-\d{2}-\d{2}$') and
 (settings->>'start'='' or settings->>'end'='' or settings->>'end'>=settings->>'start')
 )
);
create table public.trip_members (trip_id uuid not null references public.trips on delete cascade,user_id uuid not null references auth.users on delete cascade,role text not null check(role in ('owner','member')),primary key(trip_id,user_id));
create index trip_members_user on public.trip_members(user_id);
create table public.trip_invitations (id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips on delete cascade,email text not null check(length(email) between 3 and 320 and email=lower(trim(email)) and position('@' in email)>1),created_at timestamptz not null default now(),unique(trip_id,email));
create index trip_invitations_email on public.trip_invitations(email);
create function public.valid_place(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text; v jsonb;
begin
 if jsonb_typeof(d)<>'object' or not d ?& array['id','name','category','subcategory','description','address','area','lat','lng','images','attribution','price','priceType','currency','notes','favorite','visited','planned','createdAt','updatedAt'] then return false; end if;
 foreach k in array array['id','name','category','subcategory','description','address','area','attribution','priceType','currency','notes','createdAt','updatedAt'] loop if jsonb_typeof(d->k)<>'string' then return false; end if; end loop;
 if length(trim(d->>'name')) not between 1 and 150 or length(d->>'subcategory')>100 or length(d->>'description')>3000 or length(d->>'address')>500 or length(d->>'area')>100 or length(d->>'attribution')>500 or length(d->>'notes')>5000 then return false;end if;
 if d->>'category' not in ('Food','Activities') or d->>'currency'<>'GBP' or d->>'priceType' not in ('person','group','free','unknown') then return false;end if;
 foreach k in array array['favorite','visited','planned'] loop if jsonb_typeof(d->k)<>'boolean' then return false;end if;end loop;
 if (d->'lat'='null'::jsonb)<>(d->'lng'='null'::jsonb) then return false;end if;
 if d->'lat'<>'null'::jsonb and (jsonb_typeof(d->'lat')<>'number' or jsonb_typeof(d->'lng')<>'number' or (d->>'lat')::numeric not between -90 and 90 or (d->>'lng')::numeric not between -180 and 180) then return false;end if;
 if d->'price'<>'null'::jsonb and (jsonb_typeof(d->'price')<>'number' or (d->>'price')::numeric not between 0 and 1000000) then return false;end if;
 if d->>'priceType' in ('person','group') and d->'price'='null'::jsonb then return false;end if;
 if jsonb_typeof(d->'images')<>'array' or jsonb_array_length(d->'images')>5 then return false;end if;
 for v in select jsonb_array_elements(d->'images') loop if jsonb_typeof(v)<>'string' or length(v#>>'{}')>3000 or (v#>>'{}') !~ '^(https?://|/photos/[a-zA-Z0-9_-]+\.webp$|storage:[a-zA-Z0-9_/-]+\.[a-zA-Z0-9]+$)' then return false;end if;end loop;
 perform (d->>'id')::uuid; perform (d->>'createdAt')::timestamptz; perform (d->>'updatedAt')::timestamptz;
 return true;
exception when others then return false;
end $$;
create table public.places (
 id uuid primary key,trip_id uuid not null references public.trips on delete cascade,data jsonb not null,
 created_by uuid not null default auth.uid() references auth.users,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint place_valid check (public.valid_place(data) and data->>'id'=id::text)
);
create index places_trip on public.places(trip_id,created_at desc);
create unique index places_duplicate_name on public.places(trip_id,lower(regexp_replace(data->>'name','[^[:alnum:]]','','g')));
create function public.is_trip_member(t uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.trip_members where trip_id=t and user_id=(select auth.uid()))$$;
create function public.is_trip_owner(t uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.trips where id=t and owner_id=(select auth.uid()))$$;
create function public.can_access_image(path text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.trip_members where trip_id::text=split_part(path,'/',1) and user_id=(select auth.uid()))$$;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invitations enable row level security;
alter table public.places enable row level security;
create policy trips_read on public.trips for select to authenticated using(public.is_trip_member(id));
create policy trips_owner_update on public.trips for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy members_read on public.trip_members for select to authenticated using(public.is_trip_member(trip_id));
create policy invitations_owner_read on public.trip_invitations for select to authenticated using(public.is_trip_owner(trip_id));
create policy invitations_owner_delete on public.trip_invitations for delete to authenticated using(public.is_trip_owner(trip_id));
create policy places_read on public.places for select to authenticated using(public.is_trip_member(trip_id));
create policy places_insert on public.places for insert to authenticated with check(public.is_trip_member(trip_id) and created_by=(select auth.uid()));
create policy places_update on public.places for update to authenticated using(public.is_trip_member(trip_id)) with check(public.is_trip_member(trip_id));
create policy places_delete on public.places for delete to authenticated using(public.is_trip_member(trip_id));
-- Prevent a member from moving a record into a different trip or changing attribution.
create function public.protect_place_identity() returns trigger language plpgsql set search_path='' as $$begin if new.trip_id<>old.trip_id or new.id<>old.id or new.created_by<>old.created_by or new.created_at<>old.created_at then raise exception 'Place identity cannot change';end if;new.updated_at=now();return new;end$$;
create trigger protect_place before update on public.places for each row execute function public.protect_place_identity();
create function public.create_trip(trip_name text,trip_settings jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare t uuid;begin if auth.uid() is null then raise exception 'Sign in required';end if;if length(trim(trip_name)) not between 1 and 100 then raise exception 'Invalid trip name';end if;insert into public.trips(owner_id,settings) values(auth.uid(),trip_settings||jsonb_build_object('name',trim(trip_name))) returning id into t;insert into public.trip_members values(t,auth.uid(),'owner');return t;end$$;
create function public.invite_companion(target_trip uuid,invite_email text) returns void language plpgsql security definer set search_path='' as $$begin if not public.is_trip_owner(target_trip) then raise exception 'Owner permission required';end if;insert into public.trip_invitations(trip_id,email) values(target_trip,lower(trim(invite_email))) on conflict(trip_id,email) do nothing;end$$;
create function public.accept_invitations() returns integer language plpgsql security definer set search_path='' as $$declare e text; n integer;begin select lower(email) into e from auth.users where id=auth.uid() and email_confirmed_at is not null;if e is null then raise exception 'A verified email is required';end if;insert into public.trip_members(trip_id,user_id,role) select trip_id,auth.uid(),'member' from public.trip_invitations where email=e on conflict do nothing;get diagnostics n=row_count;delete from public.trip_invitations where email=e;return n;end$$;
create function public.remove_companion(target_trip uuid,member_id uuid) returns void language plpgsql security definer set search_path='' as $$begin if not public.is_trip_owner(target_trip) or member_id=auth.uid() then raise exception 'Only the owner can remove a companion; the owner cannot be removed';end if;delete from public.trip_members where trip_id=target_trip and user_id=member_id;end$$;
-- This function uses the caller's RLS permissions. Imports are one transaction.
create function public.save_places(target_trip uuid,items jsonb,allow_update boolean) returns void language plpgsql security invoker set search_path='' as $$declare item jsonb; existing_trip uuid;begin if not public.is_trip_member(target_trip) then raise exception 'Trip membership required';end if;if jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 200 then raise exception 'Expected 1 to 200 places';end if;for item in select jsonb_array_elements(items) loop if not public.valid_place(item) then raise exception 'Invalid place';end if;
 if allow_update then
 select trip_id into existing_trip from public.places where id=(item->>'id')::uuid;
 if existing_trip is not null and existing_trip<>target_trip then raise exception 'Place belongs to another trip';end if;
 insert into public.places(id,trip_id,data) values((item->>'id')::uuid,target_trip,item) on conflict(id) do update set data=excluded.data where public.places.trip_id=target_trip;
 else insert into public.places(id,trip_id,data) values((item->>'id')::uuid,target_trip,item);end if;end loop;end$$;
revoke all on function public.is_trip_member(uuid),public.is_trip_owner(uuid),public.can_access_image(text),public.create_trip(text,jsonb),public.invite_companion(uuid,text),public.accept_invitations(),public.remove_companion(uuid,uuid),public.save_places(uuid,jsonb,boolean) from public,anon;
grant execute on function public.is_trip_member(uuid),public.is_trip_owner(uuid),public.can_access_image(text),public.create_trip(text,jsonb),public.invite_companion(uuid,text),public.accept_invitations(),public.remove_companion(uuid,uuid),public.save_places(uuid,jsonb,boolean) to authenticated;
grant select,update on public.trips to authenticated;
grant select on public.trip_members to authenticated;
grant select,delete on public.trip_invitations to authenticated;
grant select,insert,update,delete on public.places to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('place-images','place-images',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy images_read on storage.objects for select to authenticated using(bucket_id='place-images' and public.can_access_image(name));
create policy images_insert on storage.objects for insert to authenticated with check(bucket_id='place-images' and public.can_access_image(name));
create policy images_delete on storage.objects for delete to authenticated using(bucket_id='place-images' and public.can_access_image(name));
alter publication supabase_realtime add table public.places,public.trips;
commit;
