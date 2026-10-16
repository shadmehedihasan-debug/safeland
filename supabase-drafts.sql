-- Safe Land: draft registrations
-- Run this in the Supabase SQL Editor AFTER supabase-setup.sql. It is safe to run again.
-- "Register deed and lock plot" now saves a draft here and locks the plot.
-- When an officer opens the same plot again, the draft is shown and the officer
-- completes e-Mutation from it. Dummy data only.

create table if not exists lt_drafts (
  id text primary key,            -- deed number, for example DEED-A1B2C3
  plot_id text not null,
  buyer_name text not null,
  by_officer text,
  status text default 'draft',    -- 'draft' or 'completed'
  created_at timestamptz default now(),
  completed_at timestamptz
);
alter table lt_drafts enable row level security;

-- Register a deed: lock the plot and save the draft (officers only)
drop function if exists lt_plot_lock(uuid, text, text);
create or replace function lt_plot_lock(p_token uuid, p_id text, p_buyer text, p_deed text)
returns boolean language plpgsql security definer set search_path = public as $$
declare w text := lt_who(p_token, 'corp');
begin
  if w is null then return false; end if;
  if exists (select 1 from lt_plots where id = p_id and state = 'TEMPORARY_ESCROW_LOCK') then return false; end if;
  update lt_plots set state = 'TEMPORARY_ESCROW_LOCK', buyer_name = p_buyer,
    history = history || jsonb_build_array(jsonb_build_object('at', now(),
      'm', 'Deed ' || p_deed || ' registered for ' || p_buyer || ' and saved as a draft. Plot locked.'))
  where id = p_id;
  insert into lt_drafts(id, plot_id, buyer_name, by_officer) values (p_deed, p_id, p_buyer, w)
  on conflict (id) do nothing;
  insert into lt_log(kind, who, ok) values ('plot locked', p_id, true);
  return true;
end $$;

-- Complete e-Mutation: release the lock and mark the draft completed
create or replace function lt_plot_complete(p_token uuid, p_id text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if lt_who(p_token, 'corp') is null then return false; end if;
  update lt_plots set owner_name = buyer_name, buyer_name = '', state = 'PERMANENT_RECORD_UPDATED',
    history = history || jsonb_build_array(jsonb_build_object('at', now(),
      'm', 'e-Mutation completed. ' || buyer_name || ' is the permanent titleholder.'))
  where id = p_id and state = 'TEMPORARY_ESCROW_LOCK';
  if not found then return false; end if;
  update lt_drafts set status = 'completed', completed_at = now() where plot_id = p_id and status = 'draft';
  insert into lt_log(kind, who, ok) values ('mutation completed', p_id, true);
  return true;
end $$;

-- Reset the demo plots (also clears the drafts)
create or replace function lt_reset_plots(p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if lt_who(p_token, 'corp') is null then return false; end if;
  delete from lt_drafts;
  delete from lt_plots;
  insert into lt_plots(id, place, owner_name, buyer_name, state) values
    ('512', 'Daag #512, Savar', 'Rahim Uddin', '', 'ACTIVE_VERIFIED'),
    ('204', 'Daag #204, Dhamrai', 'Salma Begum', 'Karim Traders', 'TEMPORARY_ESCROW_LOCK'),
    ('88', 'Daag #88, Keraniganj', 'Nasir Ahmed', '', 'PERMANENT_RECORD_UPDATED');
  insert into lt_drafts(id, plot_id, buyer_name, by_officer) values ('DEED-000204', '204', 'Karim Traders', 'DEMO-OFFICER');
  return true;
end $$;

-- Load the pending drafts, one per plot
create or replace function lt_load_drafts(p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  if lt_who(p_token, 'corp') is null then return null; end if;
  return (select coalesce(json_object_agg(plot_id, json_build_object('id', id, 'buyer', buyer_name,
            'by', by_officer, 'at', created_at)), '{}'::json) from lt_drafts where status = 'draft');
end $$;

-- Dummy starting draft for the plot that begins locked
insert into lt_drafts(id, plot_id, buyer_name, by_officer)
values ('DEED-000204', '204', 'Karim Traders', 'DEMO-OFFICER')
on conflict (id) do nothing;
