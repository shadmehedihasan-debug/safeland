-- Safe Land: parcel verification
-- Run this in the Supabase SQL Editor AFTER supabase-setup.sql. It is safe to run again.
-- A parcel a citizen tries to link is checked against these land records. It is added
-- to the citizen's vault only if the owner NID and every detail match. Dummy data only.

create table if not exists lt_land_records (
  id bigserial primary key,
  owner_nid text not null,
  district text not null, upazila text not null, mouza text not null,
  daag text not null, khatian text not null,
  area numeric not null, tax text default 'Cleared'
);
create unique index if not exists lt_land_records_uq
  on lt_land_records(owner_nid, district, upazila, mouza, daag, khatian);

-- Every attempt is kept here for audit, whether it matched or not
create table if not exists lt_verifications (
  id bigserial primary key,
  nid text, district text, upazila text, mouza text, daag text, khatian text,
  result text,                    -- 'verified', 'denied' or 'linked'
  at timestamptz default now()
);
alter table lt_land_records enable row level security;
alter table lt_verifications enable row level security;

-- Adding a parcel directly is no longer allowed: it must pass verification
drop function if exists lt_add_land(uuid, text, text, text, numeric);

create or replace function lt_verify_parcel(p_token uuid, p_district text, p_upazila text,
  p_mouza text, p_daag text, p_khatian text)
returns json language plpgsql security definer set search_path = public as $$
declare w text := lt_who(p_token, 'user'); r lt_land_records; v_place text;
begin
  if w is null then return json_build_object('result', 'denied'); end if;
  select * into r from lt_land_records
   where owner_nid = w
     and lower(trim(district)) = lower(trim(p_district))
     and lower(trim(upazila)) = lower(trim(p_upazila))
     and lower(trim(mouza)) = lower(trim(p_mouza))
     and lower(trim(daag)) = lower(trim(p_daag))
     and lower(trim(khatian)) = lower(trim(p_khatian))
   limit 1;
  if not found then
    insert into lt_verifications(nid, district, upazila, mouza, daag, khatian, result)
    values (w, p_district, p_upazila, p_mouza, p_daag, p_khatian, 'denied');
    return json_build_object('result', 'denied');
  end if;
  v_place := 'Plot #' || r.daag || ', ' || r.mouza || ', ' || r.upazila;
  if exists (select 1 from lt_lands where nid = w and lower(place) = lower(v_place)) then
    insert into lt_verifications(nid, district, upazila, mouza, daag, khatian, result)
    values (w, p_district, p_upazila, p_mouza, p_daag, p_khatian, 'linked');
    return json_build_object('result', 'linked');
  end if;
  insert into lt_lands(nid, place, district, khatian, area, tax)
  values (w, v_place, r.district, r.khatian, r.area, r.tax);
  insert into lt_verifications(nid, district, upazila, mouza, daag, khatian, result)
  values (w, p_district, p_upazila, p_mouza, p_daag, p_khatian, 'verified');
  return json_build_object('result', 'verified', 'place', v_place, 'area', r.area, 'tax', r.tax);
end $$;

-- Dummy land records. The first belongs to the demo citizen and is not linked yet,
-- so it shows a successful match. The second belongs to someone else, so it shows
-- Access denied for the demo citizen.
insert into lt_land_records(owner_nid, district, upazila, mouza, daag, khatian, area) values
  ('1234567890123', 'Dhaka', 'Savar', 'Ashulia', '1187', '3302', 6.4),
  ('0000000000001', 'Dhaka', 'Savar', 'Hemayetpur', '77', '1450', 4.2)
on conflict do nothing;
