-- Run once in a new Supabase project's SQL Editor.
create schema if not exists taxi_private;
revoke all on schema taxi_private from public, anon, authenticated;
create table taxi_private.admins (user_id uuid primary key references auth.users(id));
create function public.taxi_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from taxi_private.admins where user_id=auth.uid());
$$;
revoke all on function public.taxi_is_admin() from public, anon;
grant execute on function public.taxi_is_admin() to authenticated;
create table public.taxi_slots (
 id uuid primary key default gen_random_uuid(),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 service text not null check(service in ('Transfer','Day Trip')),
 label text not null default '' check(length(label)<=200),
 closed boolean not null default false,
 check(ends_at>starts_at and ends_at<=starts_at+interval '12 hours'),
 exclude using gist (tstzrange(starts_at,ends_at,'[)') with &&)
);
create table public.taxi_requests (
 id uuid primary key default gen_random_uuid(),
 slot_id uuid not null references public.taxi_slots(id),
 status text not null default 'pending' check(status in ('pending','approved','declined','cancelled')),
 name text not null check(length(name) between 2 and 120),
 phone text not null check(length(phone) between 6 and 40),
 email text not null check(length(email) between 5 and 254),
 pickup text not null check(length(pickup) between 2 and 500),
 dropoff text not null check(length(dropoff) between 2 and 500),
 passengers integer not null check(passengers between 1 and 3),
 luggage integer not null check(luggage between 0 and 4),
 notes text not null default '' check(length(notes)<=2000),
 service text not null check(service in ('Transfer','Day Trip')),
 trip text not null default '',
 estimated_price numeric check(estimated_price between 0 and 10000),
 final_price numeric check(final_price between 0 and 10000),
 created_at timestamptz not null default now()
);
create unique index taxi_one_active_request on public.taxi_requests(slot_id) where status in ('pending','approved');
alter table public.taxi_slots enable row level security;
alter table public.taxi_requests enable row level security;
revoke all on public.taxi_slots, public.taxi_requests from anon, authenticated;
grant select,insert,update on public.taxi_slots to authenticated;
grant select on public.taxi_requests to authenticated;
create policy slots_admin on public.taxi_slots for all to authenticated using(public.taxi_is_admin()) with check(public.taxi_is_admin());
create policy requests_admin on public.taxi_requests for select to authenticated using(public.taxi_is_admin());
-- Only non-personal availability is exposed to customers.
create function public.taxi_availability(p_day date,p_service text) returns table(id uuid,starts_at timestamptz,ends_at timestamptz,label text)
language sql stable security definer set search_path='' as $$
 select s.id,s.starts_at,s.ends_at,s.label from public.taxi_slots s
 where s.service=p_service and not s.closed
 and (s.starts_at at time zone 'Europe/Brussels')::date=p_day
 and s.starts_at>=now()+interval '4 hours' and s.starts_at<=now()+interval '90 days'
 and not exists(select 1 from public.taxi_requests r where r.slot_id=s.id and r.status in ('pending','approved'))
 order by s.starts_at;
$$;
create function public.taxi_request(p_slot uuid,p_name text,p_phone text,p_email text,p_pickup text,p_dropoff text,p_passengers integer,p_luggage integer,p_notes text,p_service text,p_trip text,p_price numeric) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.taxi_slots; result uuid; required_hours integer;
begin
 select * into s from public.taxi_slots where id=p_slot for update;
 if not found or s.closed or s.service<>p_service or s.starts_at<now()+interval '4 hours' or s.starts_at>now()+interval '90 days' then
  raise exception 'This time is unavailable. Please choose another slot.';
 end if;
 if p_service='Day Trip' then
  required_hours:=case p_trip when 'Bruges Day Trip' then 8 when 'Ghent Day Trip' then 7 when 'Knokke Seaside Trip' then 8 when 'Brussels Private Tour' then 5 else 99 end;
  if s.ends_at-s.starts_at<make_interval(hours=>required_hours) then raise exception 'Choose a longer window for this trip.'; end if;
 end if;
 if exists(select 1 from public.taxi_requests where slot_id=p_slot and status in ('pending','approved')) then
  raise exception 'This time has just been reserved. Please choose another slot.';
 end if;
 if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Please enter a valid email.'; end if;
 insert into public.taxi_requests(slot_id,name,phone,email,pickup,dropoff,passengers,luggage,notes,service,trip,estimated_price)
 values(p_slot,trim(p_name),trim(p_phone),trim(p_email),trim(p_pickup),trim(p_dropoff),p_passengers,p_luggage,coalesce(p_notes,''),p_service,coalesce(p_trip,''),p_price) returning id into result;
 return result;
end;
$$;
create function public.taxi_decide(p_request uuid,p_status text,p_price numeric default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.taxi_requests; s public.taxi_slots;
begin
 if not public.taxi_is_admin() then raise exception 'Admin access required.'; end if;
 if p_status not in ('approved','declined','cancelled') then raise exception 'Invalid decision.'; end if;
 -- Lock slot before request, using the same lock order as submission.
 select * into r from public.taxi_requests where id=p_request;
 if not found then raise exception 'Request not found.'; end if;
 select * into s from public.taxi_slots where id=r.slot_id for update;
 select * into r from public.taxi_requests where id=p_request for update;
 if r.status not in ('pending','approved') or (r.status='approved' and p_status<>'cancelled') then raise exception 'This request has already been processed.'; end if;
 if p_status='approved' and (p_price is null or p_price<=0 or s.closed or s.starts_at<=now()) then raise exception 'Set a final price and verify this future slot is open.'; end if;
 update public.taxi_requests set status=p_status,final_price=case when p_status='approved' then p_price else final_price end where id=p_request;
end;
$$;
revoke all on function public.taxi_availability(date,text),public.taxi_request(uuid,text,text,text,text,text,integer,integer,text,text,text,numeric),public.taxi_decide(uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.taxi_availability(date,text),public.taxi_request(uuid,text,text,text,text,text,integer,integer,text,text,text,numeric) to anon,authenticated;
grant execute on function public.taxi_decide(uuid,text,numeric) to authenticated;
-- AFTER creating your admin user in Supabase Auth, run separately:
-- insert into taxi_private.admins(user_id) values ('YOUR-ADMIN-USER-UUID');
