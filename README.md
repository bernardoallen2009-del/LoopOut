# LoopOut

LoopOut is a mobile-first PWA for intentional phone use. It helps a user pause before opening distracting apps, write a purpose, set a timer, enter a protected break period, see accepted friends who are offline, and find phone-free places in Lisbon.

## Production Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run `supabase/schema.sql`.
4. In Supabase Auth, enable email/password.
5. Copy `.env.example` to `.env.local` for local development.
6. Add these variables in Vercel:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`VITE_SUPABASE_URL` must be the **Project URL** from Supabase **Settings > API**, for example `https://your-project-ref.supabase.co`. Do not use the dashboard URL.

7. Deploy with Vercel using the existing `vercel.json`.

## Current MVP Scope

- Supabase Auth for accounts.
- Profiles, privacy settings and Row Level Security.
- Persistent LoopOut sessions and active timer recovery from timestamps.
- Automatic lock state and friend-visible offline status.
- Friend requests, accepted friends and offline invites.
- Phone-free places seeded in Supabase.
- LoopOut analytics from sessions, locks, purposes and invites.
- Manual Screen Time Import for comparing iPhone Screen Time with LoopOut activity.
- iPhone Shortcuts setup page and PWA install support.

## iOS Screen Time Limitation

LoopOut is currently a PWA. Safari websites cannot automatically read iPhone Screen Time data. Real analytics are based on LoopOut-owned activity. A future native iOS app can integrate Apple FamilyControls, ManagedSettings and DeviceActivity.
