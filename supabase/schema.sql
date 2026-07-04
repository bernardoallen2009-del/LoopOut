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
