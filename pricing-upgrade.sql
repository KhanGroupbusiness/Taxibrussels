-- Run this upgrade once in your existing Supabase SQL Editor.
-- It preserves all bookings, availability and admin accounts.
begin;
create table if not exists public.taxi_pricing (
 id integer primary key default 1 check (id=1),
 base_fee numeric(12,2) not null default 15 check (base_fee between 0 and 10000),
 per_km numeric(12,2) not null default 2.2 check (per_km between 0.01 and 100),
 minimum_fare numeric(12,2) not null default 45 check (minimum_fare between 0.01 and 10000),
 airport_fee numeric(12,2) not null default 10 check (airport_fee between 0 and 10000),
 night_fee numeric(12,2) not null default 20 check (night_fee between 0 and 10000),
 standard_multiplier numeric(12,2) not null default 1 check (standard_multiplier between 0.1 and 10),
 van_multiplier numeric(12,2) not null default 1.3 check (van_multiplier between 0.1 and 10),
 premium_multiplier numeric(12,2) not null default 1.55 check (premium_multiplier between 0.1 and 10),
 trip_bruges numeric(12,2) not null default 360 check (trip_bruges between 0.01 and 10000),
 trip_ghent numeric(12,2) not null default 290 check (trip_ghent between 0.01 and 10000),
 trip_knokke numeric(12,2) not null default 420 check (trip_knokke between 0.01 and 10000),
 trip_brussels numeric(12,2) not null default 240 check (trip_brussels between 0.01 and 10000),
 route_brussels numeric(12,2) not null default 55 check (route_brussels between 0.01 and 10000),
 route_charleroi numeric(12,2) not null default 120 check (route_charleroi between 0.01 and 10000),
 route_schiphol numeric(12,2) not null default 320 check (route_schiphol between 0.01 and 10000),
 route_cdg numeric(12,2) not null default 430 check (route_cdg between 0.01 and 10000),
 route_orly numeric(12,2) not null default 450 check (route_orly between 0.01 and 10000),
 updated_at timestamptz not null default now()
);
insert into public.taxi_pricing(id) values(1) on conflict(id) do nothing;
alter table public.taxi_pricing enable row level security;
revoke all on public.taxi_pricing from public,anon,authenticated;
grant select on public.taxi_pricing to anon,authenticated;
grant update on public.taxi_pricing to authenticated;
drop policy if exists taxi_prices_public on public.taxi_pricing;
create policy taxi_prices_public on public.taxi_pricing for select to anon,authenticated using (true);
drop policy if exists taxi_prices_driver on public.taxi_pricing;
create policy taxi_prices_driver on public.taxi_pricing for update to authenticated using(public.taxi_is_admin()) with check(public.taxi_is_admin());
create or replace function public.taxi_pricing_timestamp() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=clock_timestamp(); return new; end;
$$;
revoke all on function public.taxi_pricing_timestamp() from public,anon,authenticated;
drop trigger if exists taxi_prices_timestamp on public.taxi_pricing;
create trigger taxi_prices_timestamp before update on public.taxi_pricing for each row execute function public.taxi_pricing_timestamp();
commit;
