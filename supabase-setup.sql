-- Safe Land: Supabase database setup
-- Run this whole file once: Supabase dashboard > SQL Editor > New query > paste > Run.
-- It is safe to run again. It holds DUMMY data only.
-- Passwords are hashed with bcrypt inside the database. The site can only reach the
-- data through the functions below, never by reading the tables directly.

create extension if not exists pgcrypto with schema extensions;

-- Tables
create table if not exists lt_users (
  nid text primary key, first_name text not null, last_name text not null,
  phone text not null, pw_hash text not null, created_at timestamptz default now());
create table if not exists lt_officers (
  id text primary key, name text not null, phone text not null, pw_hash text not null);
create table if not exists lt_sessions (
  token uuid primary key default gen_random_uuid(), kind text not null, who text not null,
  created_at timestamptz default now());
create table if not exists lt_plots (
  id text primary key, place text, owner_name text, buyer_name text default '',
  state text, history jsonb default '[]'::jsonb);
create table if not exists lt_lands (
  id bigserial primary key, nid text not null, place text, district text,
  khatian text, area numeric, tax text default 'Cleared');
create table if not exists lt_guard (nid text primary key, on_ boolean default true);
create table if not exists lt_reports (id text primary key, data jsonb, created_at timestamptz default now());
create table if not exists lt_log (
  id bigserial primary key, kind text, who text, ok boolean, at timestamptz default now());

-- Lock the tables: with no policies, the public key cannot read or write them directly
alter table lt_users enable row level security;
alter table lt_officers enable row level security;
alter table lt_sessions enable row level security;
alter table lt_plots enable row level security;
alter table lt_lands enable row level security;
alter table lt_guard enable row level security;
alter table lt_reports enable row level security;
alter table lt_log enable row level security;

-- Helper: who owns this session token
create or replace function lt_who(p_token uuid, p_kind text) returns text
language sql stable security definer set search_path = public as $$
  select who from lt_sessions where token = p_token and kind = p_kind
$$;

-- Accounts
create or replace function lt_register(p_nid text, p_first text, p_last text, p_phone text, p_pw text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from lt_users where nid = p_nid) then return false; end if;
  insert into lt_users(nid, first_name, last_name, phone, pw_hash)
  values (p_nid, p_first, p_last, p_phone, crypt(p_pw, gen_salt('bf')));
  insert into lt_log(kind, who, ok) values ('account created', p_nid, true);
  return true;
end $$;

create or replace function lt_login(p_kind text, p_id text, p_pw text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare t uuid; u lt_users; o lt_officers;
begin
  if p_kind = 'user' then
    select * into u from lt_users where nid = p_id and pw_hash = crypt(p_pw, pw_hash);
    if found then
      insert into lt_sessions(kind, who) values ('user', p_id) returning token into t;
      insert into lt_log(kind, who, ok) values ('user password ok', p_id, true);
      return json_build_object('token', t, 'name', u.first_name || ' ' || u.last_name,
        'first', u.first_name, 'last', u.last_name, 'phone', u.phone);
    end if;
  elsif p_kind = 'corp' then
    select * into o from lt_officers where id = p_id and pw_hash = crypt(p_pw, pw_hash);
    if found then
      insert into lt_sessions(kind, who) values ('corp', p_id) returning token into t;
      insert into lt_log(kind, who, ok) values ('corporate password ok', p_id, true);
      return json_build_object('token', t, 'name', o.name, 'first', o.name, 'last', '', 'phone', o.phone);
    end if;
  end if;
  insert into lt_log(kind, who, ok) values (p_kind || ' login failed', p_id, false);
  return null;
end $$;

create or replace function lt_forgot(p_nid text, p_last text) returns text
language plpgsql security definer set search_path = public as $$
declare ph text;
begin
  select phone into ph from lt_users where nid = p_nid and lower(last_name) = lower(p_last);
  return ph;
end $$;

create or replace function lt_reset(p_nid text, p_last text, p_pw text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  update lt_users set pw_hash = crypt(p_pw, gen_salt('bf'))
  where nid = p_nid and lower(last_name) = lower(p_last);
  if found then
    insert into lt_log(kind, who, ok) values ('password reset', p_nid, true);
    return true;
  end if;
  return false;
end $$;

-- Load everything a logged-in person needs
create or replace function lt_load(p_token uuid, p_kind text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare w text := lt_who(p_token, p_kind);
begin
  if w is null then return null; end if;
  if p_kind = 'user' and not exists (select 1 from lt_lands where nid = w) then
    insert into lt_lands(nid, place, area) values
      (w, 'Plot #402, Baipail, Savar', 18.2),
      (w, 'Plot #88, Sonargaon, Narayanganj', 12.0);
  end if;
  return json_build_object(
    'plots', (select coalesce(json_object_agg(id, json_build_object('place', place, 'owner', owner_name,
              'buyer', buyer_name, 'state', state, 'history', history)), '{}'::json) from lt_plots),
    'lands', (select coalesce(json_agg(json_build_object('place', place, 'district', district,
              'khatian', khatian, 'area', area, 'tax', tax) order by id), '[]'::json) from lt_lands where nid = w),
    'guard', (select on_ from lt_guard where nid = w));
end $$;

-- E-Registration (officers only)
create or replace function lt_plot_lock(p_token uuid, p_id text, p_buyer text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if lt_who(p_token, 'corp') is null then return false; end if;
  update lt_plots set state = 'TEMPORARY_ESCROW_LOCK', buyer_name = p_buyer,
    history = history || jsonb_build_array(jsonb_build_object('at', now(), 'm', 'Deed registered for ' || p_buyer || '. Plot locked.'))
  where id = p_id;
  insert into lt_log(kind, who, ok) values ('plot locked', p_id, true);
  return true;
end $$;

create or replace function lt_plot_complete(p_token uuid, p_id text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if lt_who(p_token, 'corp') is null then return false; end if;
  update lt_plots set owner_name = buyer_name, buyer_name = '', state = 'PERMANENT_RECORD_UPDATED',
    history = history || jsonb_build_array(jsonb_build_object('at', now(), 'm', 'e-Mutation completed. ' || buyer_name || ' is the permanent titleholder.'))
  where id = p_id;
  insert into lt_log(kind, who, ok) values ('mutation completed', p_id, true);
  return true;
end $$;

create or replace function lt_reset_plots(p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if lt_who(p_token, 'corp') is null then return false; end if;
  delete from lt_plots;
  insert into lt_plots(id, place, owner_name, buyer_name, state) values
    ('512', 'Daag #512, Savar', 'Rahim Uddin', '', 'ACTIVE_VERIFIED'),
    ('204', 'Daag #204, Dhamrai', 'Salma Begum', 'Karim Traders', 'TEMPORARY_ESCROW_LOCK'),
    ('88', 'Daag #88, Keraniganj', 'Nasir Ahmed', '', 'PERMANENT_RECORD_UPDATED');
  return true;
end $$;

-- Citizen portal
create or replace function lt_add_land(p_token uuid, p_place text, p_district text, p_khatian text, p_area numeric)
returns boolean language plpgsql security definer set search_path = public as $$
declare w text := lt_who(p_token, 'user');
begin
  if w is null then return false; end if;
  insert into lt_lands(nid, place, district, khatian, area) values (w, p_place, p_district, p_khatian, p_area);
  return true;
end $$;

create or replace function lt_set_guard(p_token uuid, p_on boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare w text := lt_who(p_token, 'user');
begin
  if w is null then return false; end if;
  insert into lt_guard(nid, on_) values (w, p_on) on conflict (nid) do update set on_ = p_on;
  return true;
end $$;

-- Reports are anonymous: no login and no name or NID stored
create or replace function lt_add_report(p_id text, p_data jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into lt_reports(id, data) values (p_id, p_data) on conflict (id) do nothing;
  return true;
end $$;

-- Dummy starting data
insert into lt_plots(id, place, owner_name, buyer_name, state) values
  ('512', 'Daag #512, Savar', 'Rahim Uddin', '', 'ACTIVE_VERIFIED'),
  ('204', 'Daag #204, Dhamrai', 'Salma Begum', 'Karim Traders', 'TEMPORARY_ESCROW_LOCK'),
  ('88', 'Daag #88, Keraniganj', 'Nasir Ahmed', '', 'PERMANENT_RECORD_UPDATED')
on conflict (id) do nothing;

-- Demo accounts used by the one-click demo buttons (made-up details)
insert into lt_users(nid, first_name, last_name, phone, pw_hash)
values ('1234567890123', 'Demo', 'Citizen', '01000000000', extensions.crypt('demo-citizen-1', extensions.gen_salt('bf')))
on conflict (nid) do nothing;
insert into lt_officers(id, name, phone, pw_hash)
values ('DEMO-OFFICER', 'Demo Officer', '01000000000', extensions.crypt('demo-officer-1', extensions.gen_salt('bf')))
on conflict (id) do nothing;

-- OPTIONAL: your own officer account. Fill in your values and run this in the
-- Supabase editor only. Do not save a real ID or password in a file you publish.
-- insert into lt_officers(id, name, phone, pw_hash)
-- values ('YOUR-ID', 'Your Name', '01000000000', extensions.crypt('YOUR-PASSWORD', extensions.gen_salt('bf')))
-- on conflict (id) do nothing;
