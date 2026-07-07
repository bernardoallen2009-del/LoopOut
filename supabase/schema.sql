create extension if not exists "pgcrypto";

-- LoopOut backend schema for Supabase.
-- Architecture note: the PWA cannot automatically read iOS Screen Time data.
-- Current analytics must come from LoopOut-owned events: sessions, lock periods,
-- purposes, offline invites, meetups and optional manual Screen Time logs.
-- Future native iOS Screen Time integration can be added with Apple's
-- FamilyControls, ManagedSettings and DeviceActivity frameworks.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  username text unique,
  avatar_url text,
  city text default 'Lisbon',
  area text,
  show_offline_status boolean default true,
  show_locked_app boolean default true,
  show_area boolean default true,
  allow_offline_invites boolean default true,
  allow_friend_requests boolean default true,
  hide_profile_from_search boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.distracting_apps (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  category text,
  icon text,
  color text,
  is_default boolean default false
);

create table if not exists public.user_apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  app_id uuid references public.distracting_apps(id) on delete cascade,
  custom_name text,
  is_active boolean default true,
  default_timer_minutes integer default 10,
  default_lock_minutes integer default 30,
  created_at timestamptz default now(),
  unique(user_id, app_id)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  app_name text not null,
  purpose text,
  timer_minutes integer not null,
  lock_minutes integer not null,
  started_at timestamptz default now(),
  ended_at timestamptz,
  lock_started_at timestamptz,
  lock_ends_at timestamptz,
  status text check (status in ('active', 'completed', 'locked', 'cancelled')) default 'active',
  completed boolean default false
);

create table if not exists public.offline_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete cascade,
  is_offline boolean default false,
  locked_app text,
  lock_started_at timestamptz,
  lock_ends_at timestamptz,
  visible_to_friends boolean default true,
  area text,
  updated_at timestamptz default now()
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  status text check (status in ('pending', 'accepted', 'declined')) default 'pending',
  created_at timestamptz default now(),
  check (requester_id <> receiver_id),
  unique(requester_id, receiver_id)
);

create table if not exists public.phone_free_places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  city text default 'Lisbon',
  area text,
  description text,
  suggested_activity text,
  phone_free_score integer check (phone_free_score between 1 and 5),
  latitude numeric,
  longitude numeric,
  maps_url text,
  created_at timestamptz default now(),
  unique(name, city)
);

create table if not exists public.offline_invites (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  place_id uuid references public.phone_free_places(id) on delete set null,
  suggested_time timestamptz,
  message text,
  status text check (status in ('pending', 'accepted', 'declined', 'cancelled')) default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.impact_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  date date not null,
  sessions_completed integer default 0,
  total_intentional_minutes integer default 0,
  total_lock_minutes integer default 0,
  offline_invites_sent integer default 0,
  offline_invites_accepted integer default 0,
  purposes_written integer default 0,
  unique(user_id, date)
);

create table if not exists public.manual_screen_time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  date date not null,
  total_screen_time_minutes integer default 0,
  social_media_minutes integer default 0,
  most_used_app text,
  notes text,
  created_at timestamptz default now(),
  unique(user_id, date)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
begin
  base_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'loopout'), '[^a-zA-Z0-9]+', '_', 'g'));

  insert into public.profiles (id, email, full_name, username, city)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    trim(both '_' from base_username) || '_' || left(new.id::text, 5),
    coalesce(new.raw_user_meta_data->>'city', 'Lisbon')
  )
  on conflict (id) do nothing;

  insert into public.user_apps (user_id, app_id, is_active, default_timer_minutes, default_lock_minutes)
  select new.id, id, true, 10, 30
  from public.distracting_apps
  where is_default = true
  on conflict (user_id, app_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists sessions_user_status_started_idx on public.sessions (user_id, status, started_at desc);
create index if not exists offline_status_user_idx on public.offline_status (user_id);
create index if not exists friendships_requester_status_idx on public.friendships (requester_id, status);
create index if not exists friendships_receiver_status_idx on public.friendships (receiver_id, status);
create unique index if not exists friendships_unique_pair_idx
on public.friendships (least(requester_id, receiver_id), greatest(requester_id, receiver_id));
create index if not exists offline_invites_sender_status_idx on public.offline_invites (sender_id, status, created_at desc);
create index if not exists offline_invites_receiver_status_idx on public.offline_invites (receiver_id, status, created_at desc);
create index if not exists phone_free_places_city_type_idx on public.phone_free_places (city, type);
create index if not exists manual_screen_time_logs_user_date_idx on public.manual_screen_time_logs (user_id, date desc);

alter table public.profiles enable row level security;
alter table public.distracting_apps enable row level security;
alter table public.user_apps enable row level security;
alter table public.sessions enable row level security;
alter table public.offline_status enable row level security;
alter table public.friendships enable row level security;
alter table public.phone_free_places enable row level security;
alter table public.offline_invites enable row level security;
alter table public.impact_daily enable row level security;
alter table public.manual_screen_time_logs enable row level security;

drop policy if exists "Profiles can be read by owner, friends or public search" on public.profiles;
create policy "Profiles can be read by owner, friends or public search"
on public.profiles for select
using (
  id = auth.uid()
  or hide_profile_from_search = false
  or exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.receiver_id = profiles.id)
        or (f.receiver_id = auth.uid() and f.requester_id = profiles.id))
  )
);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Default apps are readable" on public.distracting_apps;
create policy "Default apps are readable"
on public.distracting_apps for select
using (is_default = true);

drop policy if exists "Users manage their own apps" on public.user_apps;
create policy "Users manage their own apps"
on public.user_apps for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users manage their own sessions" on public.sessions;
create policy "Users manage their own sessions"
on public.sessions for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Offline status visible to owner and accepted friends" on public.offline_status;
create policy "Offline status visible to owner and accepted friends"
on public.offline_status for select
using (
  user_id = auth.uid()
  or (
    visible_to_friends = true
    and exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.receiver_id = offline_status.user_id)
          or (f.receiver_id = auth.uid() and f.requester_id = offline_status.user_id))
    )
  )
);

drop policy if exists "Users manage their own offline status" on public.offline_status;
create policy "Users manage their own offline status"
on public.offline_status for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Friendships visible to both sides" on public.friendships;
create policy "Friendships visible to both sides"
on public.friendships for select
using (requester_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Users can send friend requests" on public.friendships;
create policy "Users can send friend requests"
on public.friendships for insert
with check (requester_id = auth.uid() and requester_id <> receiver_id);

drop policy if exists "Friend requests can be answered by either side" on public.friendships;
create policy "Friend requests can be answered by either side"
on public.friendships for update
using (requester_id = auth.uid() or receiver_id = auth.uid())
with check (requester_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Phone-free places are public" on public.phone_free_places;
create policy "Phone-free places are public"
on public.phone_free_places for select
using (true);

drop policy if exists "Offline invites visible to both sides" on public.offline_invites;
create policy "Offline invites visible to both sides"
on public.offline_invites for select
using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Users can send offline invites" on public.offline_invites;
create policy "Users can send offline invites"
on public.offline_invites for insert
with check (sender_id = auth.uid() and sender_id <> receiver_id);

drop policy if exists "Offline invites can be updated by both sides" on public.offline_invites;
create policy "Offline invites can be updated by both sides"
on public.offline_invites for update
using (sender_id = auth.uid() or receiver_id = auth.uid())
with check (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Users manage their own impact rows" on public.impact_daily;
create policy "Users manage their own impact rows"
on public.impact_daily for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users manage their own manual screen time logs" on public.manual_screen_time_logs;
create policy "Users manage their own manual screen time logs"
on public.manual_screen_time_logs for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into public.distracting_apps (name, category, icon, color, is_default)
values
  ('TikTok', 'Short video', 'Tk', '#111827', true),
  ('Instagram', 'Social', 'Ig', '#F0447A', true),
  ('YouTube Shorts', 'Short video', 'Yt', '#FF2D2D', true),
  ('Snapchat', 'Messaging', 'Sc', '#FACC15', true),
  ('X', 'News feed', 'X', '#0B1220', true),
  ('Netflix', 'Streaming', 'Nf', '#E50914', true),
  ('Discord', 'Community', 'Dc', '#5865F2', true),
  ('Games', 'Entertainment', 'Gm', '#22C55E', true)
on conflict (name) do update set
  category = excluded.category,
  icon = excluded.icon,
  color = excluded.color,
  is_default = excluded.is_default;

insert into public.phone_free_places
  (name, type, city, area, description, suggested_activity, phone_free_score, latitude, longitude, maps_url)
values
  ('Biblioteca Palacio Galveias', 'Libraries', 'Lisbon', 'Campo Pequeno', 'A quiet library for focused study, reading and reset time.', 'Study or read with phones face down for 45 minutes.', 5, 38.7409, -9.1446, 'https://www.google.com/maps/search/?api=1&query=38.7409,-9.1446'),
  ('Biblioteca de Marvila', 'Libraries', 'Lisbon', 'Marvila', 'A generous study space with calm corners for group focus.', 'Use this as a quiet focus zone.', 4, 38.7460, -9.1052, 'https://www.google.com/maps/search/?api=1&query=38.7460,-9.1052'),
  ('Biblioteca de Alcantara', 'Libraries', 'Lisbon', 'Alcantara', 'A practical meeting point for project work and reading.', 'Meet for distraction-free project work.', 4, 38.7057, -9.1788, 'https://www.google.com/maps/search/?api=1&query=38.7057,-9.1788'),
  ('Jardim da Estrela', 'Public gardens', 'Lisbon', 'Estrela', 'A relaxed outdoor place to meet friends after class.', 'Talk, walk or sit outside without checking notifications.', 4, 38.7138, -9.1604, 'https://www.google.com/maps/search/?api=1&query=38.7138,-9.1604'),
  ('Fundacao Calouste Gulbenkian Gardens', 'Parks & gardens', 'Lisbon', 'Praca de Espanha / Sao Sebastiao', 'A peaceful garden loop for short walks and deeper talks.', 'Go for a 30-minute walk without phones.', 5, 38.7370, -9.1543, 'https://www.google.com/maps/search/?api=1&query=38.7370,-9.1543'),
  ('Parque Eduardo VII', 'Parks & gardens', 'Lisbon', 'Marques de Pombal', 'Open space, long views and easy movement through the city.', 'Replace scrolling with movement.', 4, 38.7288, -9.1526, 'https://www.google.com/maps/search/?api=1&query=38.7288,-9.1526'),
  ('Jardim do Campo Grande', 'Parks & gardens', 'Lisbon', 'Campo Grande', 'A student-friendly meeting spot near university areas.', 'Meet near school or university areas.', 4, 38.7564, -9.1574, 'https://www.google.com/maps/search/?api=1&query=38.7564,-9.1574'),
  ('CCB / Belem area', 'Cultural spaces', 'Lisbon', 'Belem', 'A clean cultural route for a slow walk and conversation.', 'Explore the cultural route without scrolling.', 5, 38.6958, -9.2094, 'https://www.google.com/maps/search/?api=1&query=38.6958,-9.2094'),
  ('LX Factory area', 'Cultural spaces', 'Lisbon', 'Alcantara', 'A lively creative area that works well for planned offline meetups.', 'Meet for coffee, bookshops or a short walk.', 3, 38.7033, -9.1787, 'https://www.google.com/maps/search/?api=1&query=38.7033,-9.1787'),
  ('Saldanha study cafes placeholder', 'Cafes', 'Lisbon', 'Saldanha', 'A placeholder cluster for quiet study cafes around Saldanha.', 'Pick one cafe and agree on a phone-free study sprint.', 3, 38.7358, -9.1450, 'https://www.google.com/maps/search/?api=1&query=Saldanha%20study%20cafes%20Lisbon'),
  ('Chiado quiet cafes placeholder', 'Cafes', 'Lisbon', 'Chiado', 'A placeholder cluster for calmer cafes near Chiado.', 'Choose a table and keep phones away while you talk.', 3, 38.7107, -9.1425, 'https://www.google.com/maps/search/?api=1&query=Chiado%20quiet%20cafes%20Lisbon')
on conflict (name, city) do update set
  type = excluded.type,
  area = excluded.area,
  description = excluded.description,
  suggested_activity = excluded.suggested_activity,
  phone_free_score = excluded.phone_free_score,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  maps_url = excluded.maps_url;

-- LoopOut Pass, partner rewards and QR redemption foundation.

create table if not exists public.partner_places (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null,
  type text not null,
  city text default 'Lisbon',
  area text,
  address text,
  description text,
  phone_free_score integer check (phone_free_score between 1 and 5) default 4,
  latitude numeric,
  longitude numeric,
  maps_url text,
  tags text[] default '{}',
  status text check (status in ('pending', 'verified', 'rejected', 'paused')) default 'pending',
  is_featured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(name, city, area)
);

create table if not exists public.profile_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  role text check (role in ('user', 'partner_staff', 'partner_admin', 'admin')) default 'user',
  partner_place_id uuid references public.partner_places(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, role, partner_place_id)
);

create table if not exists public.partner_staff (
  id uuid primary key default gen_random_uuid(),
  partner_place_id uuid references public.partner_places(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text check (role in ('partner_staff', 'partner_admin')) default 'partner_staff',
  active boolean default true,
  created_at timestamptz default now(),
  unique(partner_place_id, user_id)
);

create table if not exists public.reward_campaigns (
  id uuid primary key default gen_random_uuid(),
  partner_place_id uuid references public.partner_places(id) on delete cascade,
  title text not null,
  description text,
  reward_type text check (reward_type in ('percentage_discount', 'free_item', 'group_reward', 'upgrade', 'custom')) default 'percentage_discount',
  discount_percent integer check (discount_percent between 0 and 100),
  free_item_name text,
  minimum_group_size integer default 1,
  group_boost boolean default false,
  terms text[] default '{}',
  valid_from timestamptz default now(),
  valid_until timestamptz,
  status text check (status in ('draft', 'active', 'paused', 'ended')) default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.loopout_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  reward_campaign_id uuid references public.reward_campaigns(id) on delete set null,
  partner_place_id uuid references public.partner_places(id) on delete set null,
  public_code text unique not null,
  status text check (status in ('active', 'redeemed', 'expired', 'cancelled')) default 'active',
  group_size integer default 1 check (group_size >= 1),
  user_display_name text,
  reward_snapshot jsonb default '{}'::jsonb,
  generated_at timestamptz default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.pass_redemptions (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid unique references public.loopout_passes(id) on delete cascade,
  partner_place_id uuid references public.partner_places(id) on delete set null,
  reward_campaign_id uuid references public.reward_campaigns(id) on delete set null,
  staff_user_id uuid references public.profiles(id) on delete set null,
  result text check (result in ('redeemed', 'already_redeemed', 'expired', 'wrong_partner', 'invalid', 'partner_access_required')) default 'redeemed',
  metadata jsonb default '{}'::jsonb,
  redeemed_at timestamptz default now()
);

create table if not exists public.reward_groups (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid references public.profiles(id) on delete cascade,
  pass_id uuid references public.loopout_passes(id) on delete cascade,
  reward_campaign_id uuid references public.reward_campaigns(id) on delete set null,
  status text check (status in ('open', 'locked', 'redeemed', 'cancelled')) default 'open',
  created_at timestamptz default now()
);

create table if not exists public.reward_group_members (
  id uuid primary key default gen_random_uuid(),
  reward_group_id uuid references public.reward_groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text check (status in ('invited', 'accepted', 'declined', 'locked')) default 'invited',
  joined_at timestamptz,
  created_at timestamptz default now(),
  unique(reward_group_id, user_id)
);

create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  contact_name text,
  business_name text not null,
  email text,
  phone text,
  city text default 'Lisbon',
  area text,
  reward_idea text,
  notes text,
  status text check (status in ('new', 'contacted', 'approved', 'rejected')) default 'new',
  created_at timestamptz default now()
);

create table if not exists public.partner_leads (
  id uuid primary key default gen_random_uuid(),
  contact_name text,
  business_name text,
  email text,
  city text default 'Lisbon',
  area text,
  reward_idea text,
  notes text,
  source text default 'public_partners_page',
  status text check (status in ('new', 'contacted', 'converted', 'closed')) default 'new',
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text,
  title text not null,
  body text,
  read_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.scan_events (
  id uuid primary key default gen_random_uuid(),
  partner_place_id uuid references public.partner_places(id) on delete set null,
  staff_user_id uuid references public.profiles(id) on delete set null,
  pass_id uuid references public.loopout_passes(id) on delete set null,
  public_code text,
  result text,
  metadata jsonb default '{}'::jsonb,
  scanned_at timestamptz default now()
);

create table if not exists public.manual_partner_revenue_estimates (
  id uuid primary key default gen_random_uuid(),
  partner_place_id uuid references public.partner_places(id) on delete cascade,
  month date not null,
  estimated_revenue_eur numeric default 0,
  estimated_customers integer default 0,
  notes text,
  created_at timestamptz default now(),
  unique(partner_place_id, month)
);

create index if not exists partner_places_status_city_idx on public.partner_places (status, city, area);
create index if not exists partner_staff_user_idx on public.partner_staff (user_id, active);
create index if not exists reward_campaigns_partner_status_idx on public.reward_campaigns (partner_place_id, status);
create index if not exists loopout_passes_user_generated_idx on public.loopout_passes (user_id, generated_at desc);
create index if not exists loopout_passes_public_code_idx on public.loopout_passes (public_code);
create index if not exists loopout_passes_partner_status_idx on public.loopout_passes (partner_place_id, status);
create unique index if not exists loopout_passes_one_active_session_idx on public.loopout_passes (session_id) where status = 'active';
create index if not exists pass_redemptions_partner_date_idx on public.pass_redemptions (partner_place_id, redeemed_at desc);
create index if not exists reward_group_members_user_idx on public.reward_group_members (user_id, status);
create index if not exists partner_applications_status_idx on public.partner_applications (status, created_at desc);
create index if not exists scan_events_partner_date_idx on public.scan_events (partner_place_id, scanned_at desc);
create index if not exists notifications_user_read_idx on public.notifications (user_id, read_at, created_at desc);

alter table public.partner_places enable row level security;
alter table public.profile_roles enable row level security;
alter table public.partner_staff enable row level security;
alter table public.reward_campaigns enable row level security;
alter table public.loopout_passes enable row level security;
alter table public.pass_redemptions enable row level security;
alter table public.reward_groups enable row level security;
alter table public.reward_group_members enable row level security;
alter table public.partner_applications enable row level security;
alter table public.partner_leads enable row level security;
alter table public.notifications enable row level security;
alter table public.scan_events enable row level security;
alter table public.manual_partner_revenue_estimates enable row level security;

create or replace function public.current_user_has_role(required_role text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_roles pr
    where pr.user_id = auth.uid()
      and pr.role = required_role
  );
$$;

create or replace function public.current_user_is_partner_staff(place_id uuid, required_role text default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_staff ps
    where ps.partner_place_id = place_id
      and ps.user_id = auth.uid()
      and ps.active = true
      and (required_role is null or ps.role = required_role)
  );
$$;

create or replace function public.current_user_daily_pass_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.loopout_passes p
  where p.user_id = auth.uid()
    and p.generated_at >= date_trunc('day', now())
    and p.generated_at < date_trunc('day', now()) + interval '1 day';
$$;

drop policy if exists "Verified partner places are public" on public.partner_places;
create policy "Verified partner places are public"
on public.partner_places for select
using (
  status = 'verified'
  or owner_id = auth.uid()
  or public.current_user_is_partner_staff(partner_places.id)
  or public.current_user_has_role('admin')
);

drop policy if exists "Admins and partner admins manage partner places" on public.partner_places;
create policy "Admins and partner admins manage partner places"
on public.partner_places for all
using (
  owner_id = auth.uid()
  or public.current_user_is_partner_staff(partner_places.id, 'partner_admin')
  or public.current_user_has_role('admin')
)
with check (
  owner_id = auth.uid()
  or public.current_user_has_role('admin')
);

drop policy if exists "Users can read their own roles" on public.profile_roles;
create policy "Users can read their own roles"
on public.profile_roles for select
using (
  user_id = auth.uid()
  or public.current_user_has_role('admin')
);

drop policy if exists "Admins manage roles" on public.profile_roles;
create policy "Admins manage roles"
on public.profile_roles for all
using (public.current_user_has_role('admin'))
with check (public.current_user_has_role('admin'));

drop policy if exists "Partner staff visible to same place or admins" on public.partner_staff;
create policy "Partner staff visible to same place or admins"
on public.partner_staff for select
using (
  user_id = auth.uid()
  or public.current_user_is_partner_staff(partner_staff.partner_place_id, 'partner_admin')
  or public.current_user_has_role('admin')
);

drop policy if exists "Partner admins manage staff" on public.partner_staff;
create policy "Partner admins manage staff"
on public.partner_staff for all
using (
  public.current_user_is_partner_staff(partner_staff.partner_place_id, 'partner_admin')
  or public.current_user_has_role('admin')
)
with check (
  public.current_user_is_partner_staff(partner_staff.partner_place_id, 'partner_admin')
  or public.current_user_has_role('admin')
);

drop policy if exists "Active reward campaigns are public" on public.reward_campaigns;
create policy "Active reward campaigns are public"
on public.reward_campaigns for select
using (
  status = 'active'
  or public.current_user_is_partner_staff(reward_campaigns.partner_place_id)
  or public.current_user_has_role('admin')
);

drop policy if exists "Partner admins manage campaigns" on public.reward_campaigns;
create policy "Partner admins manage campaigns"
on public.reward_campaigns for all
using (
  public.current_user_is_partner_staff(reward_campaigns.partner_place_id, 'partner_admin')
  or public.current_user_has_role('admin')
)
with check (
  public.current_user_is_partner_staff(reward_campaigns.partner_place_id, 'partner_admin')
  or public.current_user_has_role('admin')
);

drop policy if exists "Users and partner staff can read relevant passes" on public.loopout_passes;
create policy "Users and partner staff can read relevant passes"
on public.loopout_passes for select
using (
  user_id = auth.uid()
  or public.current_user_is_partner_staff(loopout_passes.partner_place_id)
  or public.current_user_has_role('admin')
);

drop policy if exists "Users create their own passes" on public.loopout_passes;
create policy "Users create their own passes"
on public.loopout_passes for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.sessions s
    where s.id = loopout_passes.session_id
      and s.user_id = auth.uid()
      and s.status = 'locked'
      and s.lock_ends_at > now()
  )
  and public.current_user_daily_pass_count() < 3
);

drop policy if exists "Users cancel their own passes" on public.loopout_passes;
create policy "Users cancel their own passes"
on public.loopout_passes for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Partner staff read redemptions" on public.pass_redemptions;
create policy "Partner staff read redemptions"
on public.pass_redemptions for select
using (
  public.current_user_is_partner_staff(pass_redemptions.partner_place_id)
  or public.current_user_has_role('admin')
);

drop policy if exists "Users manage reward groups they belong to" on public.reward_groups;
create policy "Users manage reward groups they belong to"
on public.reward_groups for all
using (
  creator_user_id = auth.uid()
  or exists (
    select 1 from public.reward_group_members rgm
    where rgm.reward_group_id = reward_groups.id and rgm.user_id = auth.uid()
  )
)
with check (creator_user_id = auth.uid());

drop policy if exists "Reward group members visible to group" on public.reward_group_members;
create policy "Reward group members visible to group"
on public.reward_group_members for all
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.reward_groups rg
    where rg.id = reward_group_members.reward_group_id and rg.creator_user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.reward_groups rg
    where rg.id = reward_group_members.reward_group_id and rg.creator_user_id = auth.uid()
  )
);

drop policy if exists "Anyone can submit partner applications" on public.partner_applications;
create policy "Anyone can submit partner applications"
on public.partner_applications for insert
with check (true);

drop policy if exists "Admins read partner applications" on public.partner_applications;
create policy "Admins read partner applications"
on public.partner_applications for select
using (public.current_user_has_role('admin'));

drop policy if exists "Anyone can submit partner leads" on public.partner_leads;
create policy "Anyone can submit partner leads"
on public.partner_leads for insert
with check (true);

drop policy if exists "Admins read partner leads" on public.partner_leads;
create policy "Admins read partner leads"
on public.partner_leads for select
using (public.current_user_has_role('admin'));

drop policy if exists "Users read their notifications" on public.notifications;
create policy "Users read their notifications"
on public.notifications for select
using (user_id = auth.uid());

drop policy if exists "Users update their notifications" on public.notifications;
create policy "Users update their notifications"
on public.notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Partner staff read scan events" on public.scan_events;
create policy "Partner staff read scan events"
on public.scan_events for select
using (
  public.current_user_is_partner_staff(scan_events.partner_place_id)
  or public.current_user_has_role('admin')
);

drop policy if exists "Partner staff read revenue estimates" on public.manual_partner_revenue_estimates;
create policy "Partner staff read revenue estimates"
on public.manual_partner_revenue_estimates for select
using (
  public.current_user_is_partner_staff(manual_partner_revenue_estimates.partner_place_id)
  or public.current_user_has_role('admin')
);

insert into public.partner_places
  (id, name, type, city, area, address, description, phone_free_score, latitude, longitude, maps_url, tags, status, is_featured)
values
  ('00000000-0000-0000-0000-000000000101', 'LoopOut Cafe Saldanha', 'Cafe', 'Lisbon', 'Saldanha', 'Saldanha, Lisbon', 'A calm verified partner concept for quick offline coffee breaks after a LoopOut session.', 5, 38.7358, -9.1450, 'https://www.google.com/maps/search/?api=1&query=Saldanha,Lisbon', array['Coffee', 'Students', 'Quiet hours'], 'verified', true),
  ('00000000-0000-0000-0000-000000000102', 'Blue Table Chiado', 'Cafe', 'Lisbon', 'Chiado', 'Chiado, Lisbon', 'A premium cafe concept for phone-free catch-ups and short creative breaks.', 4, 38.7107, -9.1425, 'https://www.google.com/maps/search/?api=1&query=Chiado,Lisbon', array['Coffee', 'Conversation', 'Central'], 'verified', true),
  ('00000000-0000-0000-0000-000000000103', 'Study Corner Alvalade', 'Study Space', 'Lisbon', 'Alvalade', 'Alvalade, Lisbon', 'A study cafe concept for students who want a quiet reward after focused app use.', 5, 38.7521, -9.1432, 'https://www.google.com/maps/search/?api=1&query=Alvalade,Lisbon', array['Study', 'Menu', 'Focus'], 'verified', true),
  ('00000000-0000-0000-0000-000000000104', 'Belem Social Spot', 'Cafe', 'Lisbon', 'Belem', 'Belem, Lisbon', 'A social cafe concept for small groups that want to meet without the scroll.', 4, 38.6958, -9.2094, 'https://www.google.com/maps/search/?api=1&query=Belem,Lisbon', array['Group', 'Walkable', 'Culture'], 'verified', false),
  ('00000000-0000-0000-0000-000000000105', 'Offline Coffee Campo Grande', 'Cafe', 'Lisbon', 'Campo Grande', 'Campo Grande, Lisbon', 'A student-friendly coffee concept near campus routes and gardens.', 4, 38.7564, -9.1574, 'https://www.google.com/maps/search/?api=1&query=Campo+Grande,Lisbon', array['Students', 'Upgrade', 'Near park'], 'verified', false)
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  area = excluded.area,
  address = excluded.address,
  description = excluded.description,
  phone_free_score = excluded.phone_free_score,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  maps_url = excluded.maps_url,
  tags = excluded.tags,
  status = excluded.status,
  is_featured = excluded.is_featured;

insert into public.reward_campaigns
  (id, partner_place_id, title, description, reward_type, discount_percent, free_item_name, minimum_group_size, group_boost, terms, status)
values
  ('10000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000101', '15% off drinks', 'Valid while your LoopOut lock is active.', 'percentage_discount', 15, null, 1, true, array['One use per user per day.', 'Valid only during an active LoopOut lock.', 'Cannot be combined with other offers.', 'Staff must scan or enter the code before purchase.'], 'active'),
  ('10000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000102', 'Free cookie with coffee', 'Get a free cookie when you buy a coffee during your offline break.', 'free_item', null, 'Cookie', 1, false, array['One use per user per day.', 'Coffee purchase required.', 'Valid during active lock time.'], 'active'),
  ('10000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000103', '20% off study menu', 'A study reward for users who stay offline during focused work.', 'percentage_discount', 20, null, 1, true, array['Valid on study menu items.', 'Staff may ask to see active lock screen.', 'Not valid after pass expiry.'], 'active'),
  ('10000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000104', 'Group discount', 'Invite friends who are also offline and unlock a better group reward.', 'group_reward', 10, null, 2, true, array['At least 2 locked LoopOut users for group reward.', 'One group redemption per visit.', 'Valid during active lock time.'], 'active'),
  ('10000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000105', 'Free size upgrade', 'Upgrade one drink size when you redeem your LoopOut Pass.', 'upgrade', null, null, 1, false, array['One drink upgrade per user.', 'Valid during active lock time.', 'Cannot be combined with happy hour.'], 'active')
on conflict (id) do update set
  partner_place_id = excluded.partner_place_id,
  title = excluded.title,
  description = excluded.description,
  reward_type = excluded.reward_type,
  discount_percent = excluded.discount_percent,
  free_item_name = excluded.free_item_name,
  minimum_group_size = excluded.minimum_group_size,
  group_boost = excluded.group_boost,
  terms = excluded.terms,
  status = excluded.status;

create or replace function public.validate_loopout_pass(public_code_input text, partner_place_id_input uuid default null)
returns table (
  result_status text,
  pass_id uuid,
  reward_title text,
  reward_summary text,
  partner_name text,
  group_size integer,
  expires_at timestamptz,
  user_display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_code text;
  v_pass record;
begin
  clean_code := upper(regexp_replace(coalesce(public_code_input, ''), '[^A-Za-z0-9]', '', 'g'));

  select
    p.*,
    rc.title as campaign_title,
    pp.name as place_name
  into v_pass
  from public.loopout_passes p
  left join public.reward_campaigns rc on rc.id = p.reward_campaign_id
  left join public.partner_places pp on pp.id = p.partner_place_id
  where p.public_code = clean_code
  limit 1;

  if not found then
    return query select 'invalid'::text, null::uuid, null::text, null::text, null::text, null::integer, null::timestamptz, null::text;
    return;
  end if;

  if partner_place_id_input is not null
    and not public.current_user_is_partner_staff(partner_place_id_input)
    and not public.current_user_has_role('admin') then
    return query select 'partner_access_required'::text, v_pass.id, v_pass.campaign_title, v_pass.reward_snapshot->>'summary', v_pass.place_name, v_pass.group_size, v_pass.expires_at, v_pass.user_display_name;
    return;
  end if;

  if v_pass.status = 'redeemed' then
    return query select 'already_redeemed'::text, v_pass.id, v_pass.campaign_title, v_pass.reward_snapshot->>'summary', v_pass.place_name, v_pass.group_size, v_pass.expires_at, v_pass.user_display_name;
    return;
  end if;

  if v_pass.status <> 'active' or v_pass.expires_at <= now() then
    return query select 'expired'::text, v_pass.id, v_pass.campaign_title, v_pass.reward_snapshot->>'summary', v_pass.place_name, v_pass.group_size, v_pass.expires_at, v_pass.user_display_name;
    return;
  end if;

  if partner_place_id_input is not null and v_pass.partner_place_id <> partner_place_id_input then
    return query select 'wrong_partner'::text, v_pass.id, v_pass.campaign_title, v_pass.reward_snapshot->>'summary', v_pass.place_name, v_pass.group_size, v_pass.expires_at, v_pass.user_display_name;
    return;
  end if;

  return query select 'valid'::text, v_pass.id, v_pass.campaign_title, v_pass.reward_snapshot->>'summary', v_pass.place_name, v_pass.group_size, v_pass.expires_at, v_pass.user_display_name;
end;
$$;

create or replace function public.redeem_loopout_pass(public_code_input text, partner_place_id_input uuid)
returns table (
  result_status text,
  pass_id uuid,
  redemption_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_validation record;
  v_redemption_id uuid;
begin
  select * into v_validation
  from public.validate_loopout_pass(public_code_input, partner_place_id_input);

  if v_validation.result_status <> 'valid' then
    insert into public.scan_events (partner_place_id, staff_user_id, pass_id, public_code, result)
    values (partner_place_id_input, auth.uid(), v_validation.pass_id, upper(regexp_replace(coalesce(public_code_input, ''), '[^A-Za-z0-9]', '', 'g')), v_validation.result_status);

    return query select v_validation.result_status, v_validation.pass_id, null::uuid;
    return;
  end if;

  update public.loopout_passes
  set status = 'redeemed',
      redeemed_at = now()
  where id = v_validation.pass_id
    and status = 'active';

  insert into public.pass_redemptions (pass_id, partner_place_id, reward_campaign_id, staff_user_id, result)
  select id, partner_place_id, reward_campaign_id, auth.uid(), 'redeemed'
  from public.loopout_passes
  where id = v_validation.pass_id
  returning id into v_redemption_id;

  insert into public.scan_events (partner_place_id, staff_user_id, pass_id, public_code, result)
  values (partner_place_id_input, auth.uid(), v_validation.pass_id, upper(regexp_replace(coalesce(public_code_input, ''), '[^A-Za-z0-9]', '', 'g')), 'redeemed');

  return query select 'redeemed'::text, v_validation.pass_id, v_redemption_id;
exception
  when unique_violation then
    return query select 'already_redeemed'::text, v_validation.pass_id, null::uuid;
end;
$$;
