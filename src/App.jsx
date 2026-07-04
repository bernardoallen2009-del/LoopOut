import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  CircleUserRound,
  Compass,
  Copy,
  Gamepad2,
  Heart,
  Home,
  Library,
  LogOut,
  LockKeyhole,
  MapPin,
  PauseCircle,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Timer,
  Trees,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  createInviteRecord,
  createScreenTimeLog,
  createSessionRecord,
  fetchActiveSession,
  fetchFriends,
  fetchInvites,
  fetchPlaces,
  fetchProfile,
  fetchProgressSnapshot,
  fetchScreenTimeLogs,
  getAuthSession,
  getInitials,
  getReadableSupabaseError,
  isSupabaseConfigured,
  respondToFriendRequest,
  respondToInvite,
  searchProfiles,
  sendFriendRequest,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
  subscribeToAuthChanges,
  supabaseConfigError,
  supabaseConfigWarning,
  supabaseProjectHost,
  updateSessionRecord,
  upsertOfflineStatus,
  upsertProfile,
} from './lib/supabase';
import {
  appOptions,
  lisbonPlaces,
  lockDurations,
  onboardingSlides,
  purposeExamples,
  quickTimers,
  setupSteps,
} from './data';

const storageKeys = {
  profile: 'loopout.profile',
  settings: 'loopout.settings',
  session: 'loopout.session',
  draft: 'loopout.sessionDraft',
  invites: 'loopout.invites',
  screenTimeLogs: 'loopout.screenTimeLogs',
  onboarded: 'loopout.onboarded',
};

const defaultProfile = {
  name: 'You',
  email: '',
  username: '',
  city: 'Lisbon',
  area: '',
  avatar: 'L',
};

const defaultSettings = {
  defaultTimer: 10,
  defaultLock: 30,
  distractingApps: ['TikTok', 'Instagram', 'YouTube Shorts'],
  showOfflineStatus: true,
  showLockedApp: true,
  allowInvites: true,
  shareArea: true,
  allowFriendRequests: true,
  hideProfileFromSearch: false,
};

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => readStorage(key, initialValue));

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname || '/');

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (nextPath) => {
    if (nextPath === path) return;
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return { path, navigate };
}

function useNow() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return now;
}

function classNames(...items) {
  return items.filter(Boolean).join(' ');
}

function getGoogleMapsUrl(place) {
  if (place.mapsUrl) return place.mapsUrl;

  if (place.coordinates) {
    return `https://www.google.com/maps/search/?api=1&query=${place.coordinates.lat},${place.coordinates.lng}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, Lisbon`)}`;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(from, to) {
  if (!from || !to) return null;

  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDistance(distanceKm) {
  if (distanceKm == null) return '';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km away`;
}

let leafletLoadPromise;

function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Leaflet needs a browser'));
  if (window.L) return Promise.resolve(window.L);

  if (!leafletLoadPromise) {
    leafletLoadPromise = new Promise((resolve, reject) => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const existingScript = document.getElementById('leaflet-js');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.L), { once: true });
        existingScript.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => resolve(window.L);
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  return leafletLoadPromise;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function minutesToMs(minutes) {
  return minutes * 60 * 1000;
}

function formatTimer(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatShort(ms) {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatTime(timestamp) {
  if (!timestamp) return 'Soon';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

function getAppById(appId) {
  return appOptions.find((app) => app.id === appId) || appOptions[1];
}

function getSessionApp(session) {
  if (!session) return null;
  const app = getAppById(session.appId);
  return session.appName ? { ...app, name: session.appName } : app;
}

function dateMs(value) {
  return value ? new Date(value).getTime() : null;
}

function isoFromMs(value) {
  return value ? new Date(value).toISOString() : null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
}

function formatMinutes(minutes) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  if (safeMinutes < 60) return `${safeMinutes} min`;
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function profileFromRow(row, user) {
  const name = row?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'LoopOut user';
  return {
    id: row?.id || user?.id,
    name,
    email: row?.email || user?.email || '',
    username: row?.username || '',
    city: row?.city || 'Lisbon',
    area: row?.area || '',
    avatar: row?.avatar_url ? null : getInitials(name),
    avatarUrl: row?.avatar_url || '',
    privacy: {
      showOfflineStatus: row?.show_offline_status ?? true,
      showLockedApp: row?.show_locked_app ?? true,
      shareArea: row?.show_area ?? true,
      allowInvites: row?.allow_offline_invites ?? true,
      allowFriendRequests: row?.allow_friend_requests ?? true,
      hideProfileFromSearch: row?.hide_profile_from_search ?? false,
    },
  };
}

function sessionFromRecord(row) {
  if (!row) return null;
  const app = appOptions.find((item) => item.name === row.app_name) || appOptions.find((item) => item.id === 'custom');
  const startedAt = dateMs(row.started_at) || Date.now();
  const timerMinutes = Number(row.timer_minutes || 10);
  return {
    id: row.id,
    remoteId: row.id,
    appId: app?.id || 'custom',
    appName: row.app_name,
    purpose: row.purpose || '',
    timerMinutes,
    lockDurationMinutes: Number(row.lock_minutes || 30),
    startedAt,
    endsAt: startedAt + minutesToMs(timerMinutes),
    endedAt: dateMs(row.ended_at),
    lockStartedAt: dateMs(row.lock_started_at),
    lockEndsAt: dateMs(row.lock_ends_at),
    status: row.status,
    completedAt: row.status === 'completed' ? dateMs(row.lock_ends_at) || dateMs(row.ended_at) : null,
  };
}

function placeFromRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    area: row.area,
    description: row.description,
    activity: row.suggested_activity || 'Phone-free moment',
    suggestion: row.suggested_activity || 'Keep phones away and stay present.',
    score: row.phone_free_score || 3,
    mapsUrl: row.maps_url,
    coordinates:
      row.latitude && row.longitude ? { lat: Number(row.latitude), lng: Number(row.longitude) } : null,
  };
}

function screenTimeLogFromRecord(row) {
  return {
    id: row.id,
    date: row.date,
    totalScreenTimeMinutes: row.total_screen_time_minutes,
    socialMediaMinutes: row.social_media_minutes,
    mostUsedApp: row.most_used_app || '',
    notes: row.notes || '',
  };
}

function friendFromBundle(item) {
  const profile = item.profile;
  const status = item.offlineStatus;
  const name = profile.full_name || profile.username || profile.email || 'LoopOut friend';
  const isOffline = Boolean(status?.is_offline);
  const lockEndsAt = dateMs(status?.lock_ends_at);
  const endingSoon = isOffline && lockEndsAt && lockEndsAt - Date.now() < minutesToMs(15);

  return {
    id: profile.id,
    name,
    username: profile.username,
    avatar: getInitials(name),
    status: isOffline ? (endingSoon ? `Lock ending at ${formatTime(lockEndsAt)}` : `Offline until ${formatTime(lockEndsAt)}`) : 'Available now',
    lockedApp: status?.locked_app ? `${status.locked_app} locked` : 'App hidden',
    area: status?.area || profile.area || profile.city || 'Lisbon',
    available: isOffline,
    isOffline,
    school: profile.area || profile.city || 'Lisbon',
  };
}

function friendRequestFromBundle(item) {
  const profile = item.profile;
  const name = profile.full_name || profile.username || profile.email || 'LoopOut user';
  return {
    id: item.friendship.id,
    direction: item.direction,
    requesterId: item.friendship.requester_id,
    receiverId: item.friendship.receiver_id,
    name,
    username: profile.username,
    avatar: getInitials(name),
  };
}

function suggestedTimeToIso(option) {
  const date = new Date();
  if (option === 'In 15 minutes') date.setMinutes(date.getMinutes() + 15);
  if (option === 'In 30 minutes') date.setMinutes(date.getMinutes() + 30);
  if (option === 'Later today') date.setHours(19, 0, 0, 0);
  return date.toISOString();
}

function fallbackProgressSnapshot(session, invites, screenTimeLogs) {
  const nowMs = Date.now();
  const completed = session?.status === 'completed';
  const lockedOrCompleted = session?.status === 'locked' || completed;
  const usedMinutes = session
    ? Math.max(0, Math.round(((session.endedAt || Math.min(nowMs, session.endsAt || nowMs)) - session.startedAt) / 60000))
    : 0;
  const lockMinutes = lockedOrCompleted ? Number(session.lockDurationMinutes || 0) : 0;
  const app = session ? getSessionApp(session) : null;
  const purposeWord = (session?.purpose || '')
    .toLowerCase()
    .match(/[a-z0-9]{4,}/g)
    ?.find((word) => !['with', 'from', 'then', 'this', 'that', 'para', 'mais'].includes(word));

  return {
    completedSessions: completed ? 1 : 0,
    totalIntentionalMinutes: usedMinutes,
    totalLockMinutes: lockMinutes,
    mostUsedApp: app?.name || 'None yet',
    mostCommonPurpose: purposeWord || 'None yet',
    weeklySaved: [0, 0, 0, 0, 0, 0, lockMinutes],
    currentStreak: completed ? 1 : 0,
    invitesSent: invites.length,
    invitesAccepted: invites.filter((invite) => invite.status === 'accepted').length,
    estimatedTimeSaved: lockMinutes,
    sessionsByApp: app ? [{ label: app.name, value: 100 }] : [],
    latestScreenTime: screenTimeLogs[0] || null,
    today: {
      completedSessions: completed ? 1 : 0,
      intentionalMinutes: usedMinutes,
      lockMinutes,
    },
  };
}

function Button({ children, variant = 'primary', className, icon: Icon, disabled, ...props }) {
  return (
    <button
      className={classNames(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
        variant === 'primary' && 'bg-primary text-white shadow-[0_10px_24px_rgba(0,122,255,0.24)]',
        variant === 'secondary' && 'border border-line bg-white text-ink shadow-sm',
        variant === 'ghost' && 'bg-transparent text-deep',
        variant === 'soft' && 'bg-soft text-deep',
        className
      )}
      disabled={disabled}
      type="button"
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

function BrandMark({ compact = false }) {
  return (
    <div className="flex items-center gap-2">
      <div className="brand-symbol h-10 w-10 rounded-[10px] border border-line bg-white shadow-sm">
        <img src="/loopout-logo-512.png" alt="" aria-hidden="true" />
      </div>
      {!compact ? (
        <div>
          <p className="text-base font-semibold text-ink">LoopOut</p>
          <p className="text-xs leading-tight text-muted">Turn screen time into real-life connection.</p>
        </div>
      ) : null}
    </div>
  );
}

function PageHeader({ title, subtitle, backTo, navigate, action }) {
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-line/70 bg-canvas/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center gap-3">
        {backTo ? (
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white text-deep"
            onClick={() => navigate(backTo)}
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-ink">{title}</h1>
          {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-soft text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-semibold text-ink">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function ProgressRing({ progress, label }) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const degrees = Math.round(safeProgress * 360);

  return (
    <div className="relative grid h-56 w-56 place-items-center rounded-full bg-white shadow-soft">
      <div
        className="absolute inset-4 rounded-full"
        style={{ background: `conic-gradient(#007AFF ${degrees}deg, #EAF4FF ${degrees}deg)` }}
      />
      <div className="absolute inset-8 rounded-full bg-white" />
      <div className="relative text-center">
        <p className="text-5xl font-semibold tabular-nums text-ink">{label}</p>
        <p className="mt-2 text-sm text-muted">Use this time intentionally.</p>
      </div>
    </div>
  );
}

function AppLogo({ app, className }) {
  const baseClass = classNames(
    'grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[12px] text-white shadow-sm',
    className
  );
  const logo = app.logo || app.id;

  if (logo === 'tiktok') {
    return (
      <div className={baseClass} style={{ backgroundColor: '#050505' }}>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" className="h-8 w-8">
          <path
            d="M28 8.5h5c.6 4.7 3.4 7.6 7.8 8.6v5.4c-3.1-.1-5.8-1-7.9-2.8V31c0 6.4-4.8 11-11.2 11-5.7 0-10.2-3.8-10.2-9.3 0-5.9 4.7-10 11-10 .7 0 1.4.1 2.1.2v5.5c-.8-.3-1.6-.4-2.4-.4-3.1 0-5.3 1.8-5.3 4.4 0 2.4 2 4 4.6 4 3.1 0 5.1-2 5.1-5.5V8.5Z"
            fill="#25F4EE"
            opacity="0.9"
            transform="translate(-2 1)"
          />
          <path
            d="M28 8.5h5c.6 4.7 3.4 7.6 7.8 8.6v5.4c-3.1-.1-5.8-1-7.9-2.8V31c0 6.4-4.8 11-11.2 11-5.7 0-10.2-3.8-10.2-9.3 0-5.9 4.7-10 11-10 .7 0 1.4.1 2.1.2v5.5c-.8-.3-1.6-.4-2.4-.4-3.1 0-5.3 1.8-5.3 4.4 0 2.4 2 4 4.6 4 3.1 0 5.1-2 5.1-5.5V8.5Z"
            fill="#FE2C55"
            opacity="0.9"
            transform="translate(2 -1)"
          />
          <path
            d="M28 8.5h5c.6 4.7 3.4 7.6 7.8 8.6v5.4c-3.1-.1-5.8-1-7.9-2.8V31c0 6.4-4.8 11-11.2 11-5.7 0-10.2-3.8-10.2-9.3 0-5.9 4.7-10 11-10 .7 0 1.4.1 2.1.2v5.5c-.8-.3-1.6-.4-2.4-.4-3.1 0-5.3 1.8-5.3 4.4 0 2.4 2 4 4.6 4 3.1 0 5.1-2 5.1-5.5V8.5Z"
            fill="#fff"
          />
        </svg>
      </div>
    );
  }

  if (logo === 'instagram') {
    return (
      <div
        className={baseClass}
        style={{ background: 'radial-gradient(circle at 30% 105%, #FEDA75 0 20%, #FA7E1E 38%, #D62976 58%, #962FBF 78%, #4F5BD5 100%)' }}
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" className="h-8 w-8">
          <rect x="12.5" y="12.5" width="23" height="23" rx="7" fill="none" stroke="currentColor" strokeWidth="3.2" />
          <circle cx="24" cy="24" r="5.5" fill="none" stroke="currentColor" strokeWidth="3.2" />
          <circle cx="31.5" cy="16.5" r="2" fill="currentColor" />
        </svg>
      </div>
    );
  }

  if (logo === 'youtube') {
    return (
      <div className={baseClass} style={{ backgroundColor: '#FF0033' }}>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" className="h-8 w-8">
          <path d="M20 16.5v15l13-7.5-13-7.5Z" fill="#fff" />
        </svg>
      </div>
    );
  }

  if (logo === 'snapchat') {
    return (
      <div className={baseClass} style={{ backgroundColor: '#FFFC00' }}>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" className="h-9 w-9 text-ink">
          <path
            d="M24 7.8c-6 0-9.6 4.2-9.6 10.4v5.3c0 1-.5 1.9-1.3 2.5l-2.7 1.8c-1 .7-.6 2.2.6 2.4l3.8.8c1.1.2 2 1.1 2.2 2.3l.2 1c.2 1.2 1.5 1.8 2.6 1.2l1.2-.6c1-.5 2-.8 3.1-.8s2.1.3 3.1.8l1.2.6c1.1.6 2.4 0 2.6-1.2l.2-1c.2-1.2 1.1-2 2.2-2.3l3.8-.8c1.2-.2 1.6-1.8.6-2.4L35 26c-.8-.6-1.3-1.5-1.3-2.5v-5.3c-.1-6.2-3.7-10.4-9.7-10.4Z"
            fill="#fff"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </div>
    );
  }

  if (logo === 'x') {
    return (
      <div className={baseClass} style={{ backgroundColor: '#000' }}>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" className="h-8 w-8">
          <path
            d="M29.8 11.5h5.7L26 22.4 37.2 36.5h-8.8l-6.9-8.7-7.7 8.7H8.1L18.3 25 7.6 11.5h9l6.3 7.9 6.9-7.9Zm-2 22.5h3.1L15.2 13.9h-3.3L27.8 34Z"
            fill="#fff"
          />
        </svg>
      </div>
    );
  }

  if (logo === 'netflix') {
    return (
      <div className={baseClass} style={{ backgroundColor: '#111' }}>
        <span className="text-3xl font-black text-[#E50914]" style={{ fontFamily: 'Arial Black, Impact, sans-serif' }}>
          N
        </span>
      </div>
    );
  }

  if (logo === 'discord') {
    return (
      <div className={baseClass} style={{ backgroundColor: '#5865F2' }}>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" className="h-8 w-8">
          <path
            d="M17.2 14.4c2.1-1 4.2-1.5 6.8-1.5s4.8.5 6.9 1.5c3.7 4.9 5 10.3 4.6 15.5-2.4 1.8-4.8 2.9-7.2 3.4l-1.2-2.2c.8-.3 1.6-.7 2.3-1.1-1.7.8-3.5 1.2-5.4 1.2s-3.7-.4-5.4-1.2c.7.5 1.5.8 2.3 1.1l-1.2 2.2c-2.4-.5-4.8-1.6-7.2-3.4-.4-5.2.9-10.6 4.7-15.5Z"
            fill="#fff"
          />
          <circle cx="20" cy="24" r="2.2" fill="#5865F2" />
          <circle cx="28" cy="24" r="2.2" fill="#5865F2" />
        </svg>
      </div>
    );
  }

  if (logo === 'games') {
    return (
      <div className={baseClass} style={{ backgroundColor: app.tone }}>
        <Gamepad2 className="h-6 w-6" />
      </div>
    );
  }

  if (logo === 'custom') {
    return (
      <div className={baseClass} style={{ backgroundColor: app.tone }}>
        <Plus className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className={classNames(baseClass, 'text-sm font-bold')} style={{ backgroundColor: app.tone }}>
      {app.glyph}
    </div>
  );
}

function AppCard({ app, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        'flex min-h-24 w-full items-center gap-4 rounded-lg border bg-white p-4 text-left shadow-sm transition active:scale-[0.99]',
        selected ? 'border-primary ring-4 ring-primary/10' : 'border-line'
      )}
    >
      <AppLogo app={app} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{app.name}</p>
        <p className="text-sm text-muted">{app.category}</p>
      </div>
      <div
        className={classNames(
          'grid h-7 w-7 place-items-center rounded-full border',
          selected ? 'border-primary bg-primary text-white' : 'border-line text-transparent'
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
      </div>
    </button>
  );
}

function FriendCard({ friend, onInvite, privacyOn, shareArea = true }) {
  const statusLabel = friend.isOffline ? 'Offline now' : friend.available ? 'Available' : 'Recent';

  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-soft font-semibold text-deep">
          {friend.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-ink">{friend.name}</p>
            <span className="rounded-full bg-[#E8F8EF] px-2.5 py-1 text-xs font-medium text-[#137A3D]">
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{friend.username ? `@${friend.username} · ` : ''}{friend.status}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
            <span className="rounded-full bg-soft px-2.5 py-1">{privacyOn ? friend.lockedApp : 'App hidden'}</span>
            <span className="rounded-full bg-soft px-2.5 py-1">{shareArea ? friend.area : 'Area hidden'}</span>
          </div>
        </div>
      </div>
      <Button className="mt-4 w-full" variant="soft" icon={Heart} onClick={() => onInvite(friend)}>
        Invite offline
      </Button>
    </div>
  );
}

function PlaceCard({ place, onInvite }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{place.type}</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{place.name}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="h-3.5 w-3.5" />
            {place.area}
          </p>
          {place.distanceKm != null ? (
            <p className="mt-2 inline-flex rounded-full bg-soft px-2.5 py-1 text-xs font-semibold text-deep">
              {formatDistance(place.distanceKm)}
            </p>
          ) : null}
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-full bg-soft text-primary">
          {place.type === 'Libraries' ? <Library className="h-5 w-5" /> : <Trees className="h-5 w-5" />}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">{place.description}</p>
      <div className="mt-4 rounded-lg bg-canvas p-3">
        <p className="text-sm font-medium text-ink">{place.activity}</p>
        <p className="mt-1 text-sm text-muted">{place.suggestion}</p>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1" aria-label={`Phone-free score ${place.score} out of 5`}>
          {Array.from({ length: 5 }).map((_, index) => (
            <span
              className={classNames('h-2 w-5 rounded-full', index < place.score ? 'bg-primary' : 'bg-line')}
              key={index}
            />
          ))}
        </div>
        <p className="text-xs font-medium text-muted">{place.score}/5</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="soft" className="px-3" onClick={() => onInvite(null, place)}>
          Invite here
        </Button>
        <Button
          variant="secondary"
          className="px-3"
          onClick={() => window.open(getGoogleMapsUrl(place), '_blank', 'noopener,noreferrer')}
        >
          Google Maps
        </Button>
      </div>
    </div>
  );
}

function PhoneFreeMap({ places, userLocation }) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapElementRef.current || mapRef.current) return;

        const map = L.map(mapElementRef.current, {
          attributionControl: true,
          scrollWheelZoom: false,
          zoomControl: false,
        }).setView([38.7223, -9.1393], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);
        markerLayerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerLayerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready' || !window.L || !mapRef.current || !markerLayerRef.current) return;

    const L = window.L;
    const points = places.filter((place) => place.coordinates);
    markerLayerRef.current.clearLayers();

    const markerIcon = L.divIcon({
      className: 'loopout-map-pin',
      html: '<span></span>',
      iconAnchor: [14, 30],
      iconSize: [28, 34],
      popupAnchor: [0, -28],
    });

    if (userLocation) {
      L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        fillColor: '#007AFF',
        fillOpacity: 1,
        color: '#fff',
        opacity: 1,
        weight: 3,
      })
        .bindPopup('<strong>Your location</strong>')
        .addTo(markerLayerRef.current);
    }

    points.forEach((place) => {
      L.marker([place.coordinates.lat, place.coordinates.lng], { icon: markerIcon })
        .bindPopup(
          `<strong>${place.name}</strong><br/><span>${place.area}</span><br/><small>${place.distanceKm != null ? `${formatDistance(place.distanceKm)} &middot; ` : ''}${place.activity}</small>`
        )
        .addTo(markerLayerRef.current);
    });

    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((place) => [place.coordinates.lat, place.coordinates.lng]));
      mapRef.current.fitBounds(bounds, { padding: [26, 26], maxZoom: 13 });
    } else if (points.length === 1) {
      mapRef.current.setView([points[0].coordinates.lat, points[0].coordinates.lng], 14);
    }
  }, [places, status, userLocation]);

  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-line bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="font-semibold text-ink">Phone-free map</h2>
          <p className="text-sm text-muted">{places.length} suggested pins in Lisbon</p>
        </div>
        <span className="rounded-full bg-soft px-3 py-1 text-xs font-semibold text-deep">Live pins</span>
      </div>
      <div className="relative h-80 bg-soft">
        <div ref={mapElementRef} className="h-full w-full" />
        {status === 'loading' ? (
          <div className="absolute inset-0 grid place-items-center bg-soft text-sm font-semibold text-deep">
            Loading map...
          </div>
        ) : null}
        {status === 'error' ? (
          <div className="absolute inset-0 grid place-items-center bg-soft px-6 text-center text-sm leading-6 text-deep">
            Map tiles need an internet connection. The exact Google Maps links still work from each place card.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function InviteModal({ friend, place, friends = [], places = [], onClose, onSend, sending }) {
  const friendOptions = friends.length ? friends : [];
  const placeOptions = places.length ? places : lisbonPlaces;
  const [selectedFriend, setSelectedFriend] = useState(friend?.id || friendOptions[0]?.id || '');
  const [selectedPlace, setSelectedPlace] = useState(place?.id || placeOptions[0]?.id || '');
  const [time, setTime] = useState('Now');
  const [message, setMessage] = useState('Hey, we both finished our screen time. Want to go offline together?');
  const canSend = Boolean(selectedFriend && selectedPlace && !sending);

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/25 p-3 backdrop-blur-sm sm:place-items-center">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lift">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Invite offline</h2>
            <p className="text-sm text-muted">Turn screen time into real time.</p>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-canvas text-muted"
            onClick={onClose}
            aria-label="Close invite"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          {friendOptions.length ? (
            <label className="block">
              <span className="text-sm font-medium text-ink">Choose friend</span>
              <select
                className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-3 text-sm text-ink outline-none focus:border-primary"
                value={selectedFriend}
                onChange={(event) => setSelectedFriend(event.target.value)}
              >
                {friendOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-lg bg-soft p-3 text-sm leading-6 text-deep">
              Add friends first to send offline invites.
            </div>
          )}
          <label className="block">
            <span className="text-sm font-medium text-ink">Choose place</span>
            <select
              className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-3 text-sm text-ink outline-none focus:border-primary"
              value={selectedPlace}
              onChange={(event) => setSelectedPlace(event.target.value)}
            >
              {placeOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="text-sm font-medium text-ink">Choose time</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {['Now', 'In 15 minutes', 'In 30 minutes', 'Later today'].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={classNames(
                    'min-h-11 rounded-full border px-3 text-sm font-medium',
                    time === option ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink'
                  )}
                  onClick={() => setTime(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-ink">Message</span>
            <textarea
              className="mt-2 min-h-24 w-full resize-none rounded-lg border border-line bg-white px-3 py-3 text-sm text-ink outline-none focus:border-primary"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
        </div>
        <Button
          className="mt-5 w-full"
          icon={ArrowRight}
          disabled={!canSend}
          onClick={() => onSend({ friendId: selectedFriend, placeId: selectedPlace, time, message })}
        >
          {sending ? 'Sending...' : 'Send invite'}
        </Button>
      </div>
    </div>
  );
}

function HeroPhone() {
  return (
    <div className="hero-phone" aria-hidden="true">
      <div className="phone-shell">
        <div className="phone-island" />
        <div className="phone-screen">
          <div className="flex items-center justify-between text-xs font-semibold text-muted">
            <span>9:41</span>
            <span className="rounded-full bg-[#E8F8EF] px-2.5 py-1 text-[#137A3D]">Ready</span>
          </div>
          <div className="mt-6 rounded-[22px] border border-line bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Before Instagram</p>
            <h3 className="mt-2 text-xl font-semibold leading-tight text-ink">What are you here to do?</h3>
            <div className="mt-4 rounded-lg bg-canvas p-3">
              <p className="text-sm font-medium leading-6 text-ink">Reply to Ana, then leave.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map((minutes) => (
              <div
                className={classNames(
                  'grid min-h-10 place-items-center rounded-full text-sm font-semibold',
                  minutes === 10 ? 'bg-primary text-white' : 'bg-white text-deep'
                )}
                key={minutes}
              >
                {minutes}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[22px] bg-deep p-4 text-white">
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4" />
              <p className="text-sm font-semibold">10:00 intentional minutes</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-2/3 rounded-full bg-white" />
            </div>
          </div>
          <div className="mt-auto rounded-[18px] bg-white p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-soft text-primary">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Gulbenkian Gardens</p>
                <p className="text-xs text-muted">1.2 km away | phone-free walk</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Landing({ navigate }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <nav className="fixed inset-x-0 top-0 z-40 border-b border-line/70 bg-canvas/85 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <BrandMark />
          <Button variant="secondary" className="hidden sm:inline-flex" onClick={() => navigate('/setup-iphone')}>
            Setup
          </Button>
        </div>
      </nav>

      <section className="hero-stage">
        <div className="mx-auto grid min-h-[88vh] max-w-6xl items-center gap-10 px-4 pb-14 pt-28 lg:min-h-[92vh] lg:grid-cols-[minmax(0,1fr)_380px] lg:pt-24">
          <div className="max-w-3xl text-center lg:text-left">
            <p className="mx-auto inline-flex rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-deep shadow-sm lg:mx-0">
              Digital wellbeing for real-life connection
            </p>
            <h1 className="mt-5 text-balance text-6xl font-semibold leading-[0.98] tracking-normal text-ink sm:text-7xl lg:text-8xl">
              LoopOut
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-2xl font-semibold leading-tight text-ink lg:text-3xl">
              Break the scroll loop before it starts.
            </p>
            <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-muted">
              Choose the app, write the reason, set a timer, then turn the end of screen time into a real offline plan.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:justify-start">
              <Button icon={Play} onClick={() => navigate('/onboarding')}>
                Start LoopOut
              </Button>
              <Button variant="secondary" icon={Compass} onClick={() => navigate('/setup-iphone')}>
                See setup
              </Button>
            </div>
            <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
              {[
                ['Purpose first', 'Pause before opening distracting apps.'],
                ['Clear limits', 'Preset timers and lock windows.'],
                ['Nearby plans', 'Meet friends in phone-free places.'],
              ].map(([title, text]) => (
                <div className="rounded-lg border border-line bg-white/80 p-4 shadow-sm" key={title}>
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden justify-center lg:flex lg:justify-end">
            <HeroPhone />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8">
        <section className="grid gap-4 py-10 md:grid-cols-3">
          <InfoPanel
            eyebrow="Pause"
            title="Open apps with intention instead of autopilot."
            body="LoopOut asks for a purpose before the scroll begins."
            icon={Sparkles}
          />
          <InfoPanel
            eyebrow="Limit"
            title="Use preset timers and finish with a real stopping point."
            body="No endless custom loop. Clear choices keep the flow simple."
            icon={Timer}
          />
          <InfoPanel
            eyebrow="Reconnect"
            title="Find nearby phone-free places when the timer ends."
            body="Turn protected time into walks, study sessions and offline invites."
            icon={MapPin}
          />
        </section>

        <section className="grid gap-4 py-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionTitle eyebrow="How it works" title="One clean flow from impulse to intention." />
            <p className="mt-3 max-w-md leading-7 text-muted">
              LoopOut is built around the moment before you open a distracting app, not a complicated dashboard.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['1', 'Choose the app', 'Pick the social app you are about to open.'],
              ['2', 'Name the purpose', 'Write one reason before continuing.'],
              ['3', 'Set the limit', 'Choose a preset timer and lock duration.'],
              ['4', 'Go offline', 'Use places and invites when the loop ends.'],
            ].map(([step, title, text]) => (
              <div className="rounded-lg border border-line bg-white p-4 shadow-sm" key={step}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-soft text-sm font-semibold text-deep">
                  {step}
                </span>
                <p className="mt-4 font-semibold text-ink">{title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 py-10 md:grid-cols-2">
          <InfoPanel
            eyebrow="Built like an MVP"
            title="Accounts, friends, places and privacy settings are ready for a real backend."
            icon={Bell}
          />
          <InfoPanel
            eyebrow="Practical constraint"
            title="A PWA-friendly flow that works with iPhone Shortcuts today."
            body="Native blocking can come later; the current product focuses on the real habit loop."
            icon={ShieldCheck}
          />
        </section>

        <section className="py-10">
          <SectionTitle eyebrow="Why it's different" title="Purpose first, then connection." />
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              ['Purpose before screen time', Sparkles],
              ['Timers instead of endless scrolling', Timer],
              ['Social accountability', Users],
              ['Phone-free places in Lisbon', MapPin],
            ].map(([label, Icon]) => (
              <div className="rounded-lg border border-line bg-white p-4 shadow-sm" key={label}>
                <div className="grid h-10 w-10 place-items-center rounded-full bg-soft text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 font-semibold text-ink">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg bg-deep p-6 text-center text-white shadow-soft sm:p-10">
          <h2 className="text-3xl font-semibold">Ready to use screen time on purpose?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/70">
            Start with one app, one purpose and one limit. The rest can become a habit.
          </p>
          <Button variant="secondary" className="mt-6" icon={ArrowRight} onClick={() => navigate('/onboarding')}>
            Start LoopOut
          </Button>
        </section>
      </main>
    </div>
  );
}

function InfoPanel({ eyebrow, title, body, icon: Icon }) {
  return (
    <div className="rounded-lg border border-line bg-white p-6 shadow-sm">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-soft text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-5 text-sm font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold leading-tight text-ink">{title}</h2>
      {body ? <p className="mt-3 leading-7 text-muted">{body}</p> : null}
    </div>
  );
}

function SectionTitle({ eyebrow, title }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold text-ink">{title}</h2>
    </div>
  );
}

function Onboarding({ navigate, setOnboarded }) {
  const [index, setIndex] = useState(0);
  const slide = onboardingSlides[index];
  const isLast = index === onboardingSlides.length - 1;

  const finish = (path = '/login') => {
    setOnboarded(true);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-canvas px-4 py-[calc(env(safe-area-inset-top)+20px)] text-ink">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-md flex-col">
        <div className="flex items-center justify-between">
          <BrandMark />
          <Button variant="ghost" onClick={() => finish('/dashboard')}>
            Skip
          </Button>
        </div>
        <div className="flex flex-1 flex-col justify-center">
          <div className="rounded-lg border border-line bg-white p-6 shadow-soft">
            <div className="grid h-16 w-16 place-items-center rounded-[16px] bg-soft text-primary">
              {index === 0 ? <Sparkles className="h-8 w-8" /> : null}
              {index === 1 ? <Timer className="h-8 w-8" /> : null}
              {index === 2 ? <Users className="h-8 w-8" /> : null}
              {index === 3 ? <Smartphone className="h-8 w-8" /> : null}
            </div>
            <h1 className="mt-8 text-3xl font-semibold leading-tight text-ink">{slide.title}</h1>
            <p className="mt-4 text-lg leading-8 text-muted">{slide.text}</p>
            {index === 3 ? (
              <p className="mt-5 rounded-lg bg-canvas p-3 text-sm leading-6 text-muted">
                LoopOut currently simulates app locking. Connect it with iPhone Shortcuts to create a pause before
                opening distracting apps.
              </p>
            ) : null}
          </div>
          <div className="mt-6 flex justify-center gap-2">
            {onboardingSlides.map((item, dotIndex) => (
              <span
                className={classNames('h-2 rounded-full transition-all', dotIndex === index ? 'w-8 bg-primary' : 'w-2 bg-line')}
                key={item.title}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-3 pb-4">
          <Button
            icon={ArrowRight}
            onClick={() => {
              if (isLast) finish('/login');
              else setIndex((current) => current + 1);
            }}
          >
            Continue
          </Button>
          <Button variant="secondary" onClick={() => finish('/setup-iphone')}>
            Set up later
          </Button>
        </div>
      </div>
    </div>
  );
}

function AuthPage({ navigate, profile, onAuthReady }) {
  const [mode, setMode] = useState('signup');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: profile.name || '',
    email: profile.email || '',
    password: '',
    city: profile.city || 'Lisbon',
  });

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');

    const name = form.name.trim() || 'LoopOut user';
    const email = form.email.trim();

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not connected in this environment.');
      }

      if (!email || !form.password) {
        throw new Error('Add your email and password.');
      }

      const result =
        mode === 'signup'
          ? await signUpWithEmail({ email, password: form.password, name, city: form.city.trim() || 'Lisbon' })
          : await signInWithEmail({ email, password: form.password });

      if (result.session || mode === 'login') {
        await onAuthReady?.(result.user);
        navigate('/dashboard');
      } else {
        setMessage('Account created. Check your email if your Supabase project requires confirmation.');
      }
    } catch (err) {
      setError(getReadableSupabaseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas px-4 py-[calc(env(safe-area-inset-top)+24px)] text-ink">
      <div className="mx-auto max-w-md">
        <button type="button" className="mb-8" onClick={() => navigate('/')}>
          <BrandMark />
        </button>
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">
            Secure account
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">
            {mode === 'signup' ? 'Create your LoopOut account.' : 'Welcome back.'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Your account, sessions, friends and privacy settings are protected with Supabase Auth and RLS.
          </p>
          {supabaseConfigWarning ? (
            <div className="mt-4 rounded-lg bg-[#FFF7E6] p-3 text-sm leading-6 text-[#B54708]">
              {supabaseConfigWarning} Update Vercel later to use the clean Project URL.
            </div>
          ) : null}
          {message ? (
            <div className="mt-4 rounded-lg bg-[#E8F8EF] p-3 text-sm leading-6 text-[#137A3D]">{message}</div>
          ) : null}
          {error ? (
            <div className="mt-4 flex gap-2 rounded-lg bg-[#FFF1F0] p-3 text-sm leading-6 text-[#B42318]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {error}
                {error.includes('Supabase URL') ? (
                  <span className="mt-2 block text-xs leading-5 text-[#B42318]/80">
                    Current detected Supabase host: {supabaseProjectHost || 'missing'}. It should end in supabase.co.
                  </span>
                ) : null}
              </span>
            </div>
          ) : null}
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {mode === 'signup' ? (
              <Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
            ) : null}
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(value) => setForm({ ...form, email: value })}
            />
            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={(value) => setForm({ ...form, password: value })}
            />
            {mode === 'signup' ? (
              <Field label="City" value={form.city} onChange={(value) => setForm({ ...form, city: value })} />
            ) : null}
            <Button className="w-full" icon={ArrowRight} disabled={submitting} type="submit">
              {submitting ? 'Please wait...' : mode === 'signup' ? 'Sign up' : 'Log in'}
            </Button>
          </form>
          <button
            type="button"
            className="mt-5 w-full text-center text-sm font-semibold text-deep"
            onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
          >
            {mode === 'signup' ? 'Already have an account? Log in' : 'New to LoopOut? Create account'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        className="mt-2 min-h-12 w-full rounded-lg border border-line bg-white px-3 text-base text-ink outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function AppShell({ children, navigate, path, session }) {
  const sessionRoute =
    session?.status === 'active' ? '/session/active' : session?.status === 'locked' ? '/session/locked' : '/session/select-app';

  const navItems = [
    { label: 'Home', path: '/dashboard', icon: Home },
    { label: 'Session', path: sessionRoute, match: '/session', icon: Timer },
    { label: 'Friends', path: '/friends', icon: Users },
    { label: 'Places', path: '/places', icon: MapPin },
    { label: 'Progress', path: '/progress', icon: BarChart3 },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <main className="mx-auto max-w-md px-4 pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/92 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-md grid-cols-6 gap-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.match ? path.startsWith(item.match) : path === item.path;
            return (
              <button
                type="button"
                className={classNames(
                  'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition',
                  active ? 'bg-soft text-primary' : 'text-muted'
                )}
                key={item.label}
                onClick={() => navigate(item.path)}
              >
                <Icon className="h-5 w-5" />
                <span className="leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Dashboard({ navigate, profile, session, now, stats, friends = [], invites = [], loading, isRemote }) {
  const active = session?.status === 'active';
  const locked = session?.status === 'locked';
  const currentApp = session ? getSessionApp(session) : null;
  const remaining = active ? session.endsAt - now : locked ? session.lockEndsAt - now : 0;
  const today = stats?.today || {};
  const offlineFriends = friends.filter((friend) => friend.isOffline || friend.available).length;
  const pendingInvites = invites.filter((invite) => invite.status === 'pending' || invite.status === 'sent').length;
  const todayCards = [
    ['Intentional sessions', loading ? '...' : String(today.completedSessions ?? 0)],
    ['Intentional minutes', loading ? '...' : formatMinutes(today.intentionalMinutes ?? 0)],
    ['Lock minutes', loading ? '...' : formatMinutes(today.lockMinutes ?? 0)],
    ['Friends offline', loading ? '...' : String(offlineFriends)],
  ];

  return (
    <>
      <div className="pt-[calc(env(safe-area-inset-top)+22px)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">{getGreeting()}, {profile.name}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">Ready to break the loop?</h1>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-lg font-semibold text-deep shadow-sm">
            {profile.avatar || profile.name.charAt(0)}
          </div>
        </div>
      </div>

      <section className="mt-6 rounded-lg border border-line bg-soft p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-deep">Today</p>
            <p className="mt-1 text-sm text-muted">Your intentional screen time.</p>
          </div>
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {todayCards.map(([label, value]) => (
            <div className="rounded-lg bg-white/80 p-3" key={label}>
              <p className="text-2xl font-semibold text-ink">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-soft text-primary">
            <Play className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-ink">Start a LoopOut session</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Choose an app, write your purpose and set your limit.</p>
          </div>
        </div>
        <Button className="mt-5 w-full" icon={ArrowRight} onClick={() => navigate('/session/select-app')}>
          Start
        </Button>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        {pendingInvites > 0 ? (
          <button
            type="button"
            className="mb-4 flex w-full items-center justify-between rounded-lg bg-soft p-3 text-left"
            onClick={() => navigate('/friends')}
          >
            <span className="text-sm font-semibold text-deep">
              {pendingInvites} pending offline invite{pendingInvites === 1 ? '' : 's'}
            </span>
            <ArrowRight className="h-4 w-4 text-primary" />
          </button>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted">Current lock</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">
              {active ? `${currentApp.name} in session` : locked ? `${currentApp.name} locked` : 'No app locked right now'}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {active || locked ? `${formatShort(remaining)} remaining` : 'Start a session to protect your focus.'}
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-full bg-soft text-primary">
            <LockKeyhole className="h-5 w-5" />
          </div>
        </div>
        {active || locked ? (
          <div className="mt-5">
            <div className="h-2 rounded-full bg-line">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      active
                        ? ((now - session.startedAt) / (session.endsAt - session.startedAt)) * 100
                        : ((now - session.lockStartedAt) / (session.lockEndsAt - session.lockStartedAt)) * 100
                    )
                  )}%`,
                }}
              />
            </div>
            <Button
              className="mt-4 w-full"
              variant="soft"
              onClick={() => navigate(active ? '/session/active' : '/session/locked')}
            >
              Open session
            </Button>
          </div>
        ) : null}
      </section>

    </>
  );
}

function SelectAppPage({ navigate, draft, setDraft }) {
  const selectedApp = draft.appId;

  return (
    <>
      <PageHeader title="Choose an app" subtitle="What are you about to open?" navigate={navigate} backTo="/dashboard" />
      <div className="space-y-3">
        {appOptions.map((app) => (
          <AppCard
            app={app}
            key={app.id}
            selected={selectedApp === app.id}
            onClick={() => setDraft({ ...draft, appId: app.id })}
          />
        ))}
      </div>
      <Button
        className="mt-5 w-full"
        icon={ArrowRight}
        disabled={!selectedApp}
        onClick={() => navigate('/session/purpose')}
      >
        Continue
      </Button>
    </>
  );
}

function PurposePage({ navigate, draft, setDraft }) {
  const app = getAppById(draft.appId);
  const purpose = draft.purpose || '';
  const ready = purpose.trim().length >= 4;

  return (
    <>
      <PageHeader
        title={`Why are you opening ${app.name}?`}
        subtitle="A short pause helps you stay in control."
        navigate={navigate}
        backTo="/session/select-app"
      />
      <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <AppLogo app={app} />
          <div>
            <p className="text-sm font-medium text-muted">Opening {app.name}</p>
            <h1 className="text-2xl font-semibold leading-tight text-ink">Name the reason first.</h1>
          </div>
        </div>
        <div className="mt-5 rounded-lg bg-soft p-4">
          <p className="text-sm leading-6 text-deep">
            One clear sentence is enough. LoopOut is just helping you turn the tap into a choice.
          </p>
        </div>
        <label className="block">
          <span className="mt-5 block text-sm font-semibold text-ink">Write your purpose.</span>
          <textarea
            className="mt-3 min-h-40 w-full resize-none rounded-lg border border-line bg-canvas px-4 py-4 text-xl font-medium leading-8 text-ink outline-none transition placeholder:text-muted/60 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
            placeholder="Example: reply to one message, then stop."
            value={purpose}
            onChange={(event) => setDraft({ ...draft, purpose: event.target.value })}
            autoFocus
          />
        </label>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm leading-6 text-muted">Use this app with intention, not autopilot.</p>
          <span className={classNames('rounded-full px-3 py-1 text-xs font-semibold', ready ? 'bg-[#E8F8EF] text-[#137A3D]' : 'bg-canvas text-muted')}>
            {ready ? 'Ready' : 'Keep it clear'}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-ink">Tap a calm starting point</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {purposeExamples.map((example) => (
            <button
              type="button"
              key={example}
              className="min-h-16 rounded-lg border border-line bg-white px-4 py-3 text-left text-sm font-semibold leading-5 text-deep shadow-sm transition active:scale-[0.99]"
              onClick={() => setDraft({ ...draft, purpose: example })}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
      <Button
        className="mt-5 w-full"
        icon={ArrowRight}
        disabled={!ready}
        onClick={() => navigate('/session/timer')}
      >
        Continue
      </Button>
    </>
  );
}

function TimerPage({ navigate, draft, setDraft, settings, startSession }) {
  const app = getAppById(draft.appId);
  const defaultLock = lockDurations.includes(draft.lockDurationMinutes)
    ? draft.lockDurationMinutes
    : lockDurations.includes(settings.defaultLock)
      ? settings.defaultLock
      : 30;
  const [timer, setTimer] = useState(draft.timerMinutes || settings.defaultTimer);
  const [lock, setLock] = useState(defaultLock);
  const [timerCustom, setTimerCustom] = useState(false);

  useEffect(() => {
    setDraft({ ...draft, timerMinutes: timer, lockDurationMinutes: lock });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, lock]);

  return (
    <>
      <PageHeader title="Set your limit" subtitle="Choose a clear stopping point." navigate={navigate} backTo="/session/purpose" />

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <AppLogo app={app} />
          <div>
            <p className="font-semibold text-ink">{app.name}</p>
            <p className="text-sm text-muted">{draft.purpose}</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-ink">Timer</p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {quickTimers.map((minutes) => (
            <ChoiceButton selected={timer === minutes && !timerCustom} key={minutes} onClick={() => {
              setTimerCustom(false);
              setTimer(minutes);
            }}>
              {minutes}m
            </ChoiceButton>
          ))}
          <ChoiceButton selected={timerCustom} onClick={() => setTimerCustom(true)}>
            Custom
          </ChoiceButton>
        </div>
        {timerCustom ? (
          <NumberField label="Minutes" value={timer} min={1} max={90} onChange={setTimer} />
        ) : null}
      </section>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-ink">Lock after timer: {lock} minutes</p>
        <p className="mt-1 text-sm leading-6 text-muted">Choose one of the preset recovery windows.</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {lockDurations.map((minutes) => (
            <ChoiceButton selected={lock === minutes} key={minutes} onClick={() => {
              setLock(minutes);
            }}>
              {minutes}m
            </ChoiceButton>
          ))}
        </div>
      </section>

      <Button
        className="mt-5 w-full"
        icon={Play}
        onClick={() => startSession({ ...draft, timerMinutes: timer, lockDurationMinutes: lock })}
      >
        Start timer
      </Button>
    </>
  );
}

function ChoiceButton({ selected, children, onClick }) {
  return (
    <button
      type="button"
      className={classNames(
        'min-h-11 rounded-full border px-2 text-sm font-semibold transition',
        selected ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink'
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function NumberField({ label, value, min, max, onChange }) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-medium text-muted">{label}</span>
      <input
        className="mt-2 min-h-12 w-full rounded-lg border border-line bg-canvas px-3 text-base text-ink outline-none focus:border-primary"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ActiveTimerPage({ navigate, session, setSession, now, onSessionLock }) {
  if (!session || session.status !== 'active') {
    return <EmptyState navigate={navigate} title="No active timer" action="Start a session" path="/session/select-app" />;
  }

  const app = getSessionApp(session);
  const total = session.endsAt - session.startedAt;
  const remaining = Math.max(0, session.endsAt - now);
  const progress = total > 0 ? (now - session.startedAt) / total : 0;

  const startLock = () => {
    const lockStartedAt = Date.now();
    setSession({
      ...session,
      status: 'locked',
      endedAt: lockStartedAt,
      lockStartedAt,
      lockEndsAt: lockStartedAt + minutesToMs(session.lockDurationMinutes),
    });
    onSessionLock?.({
      ...session,
      status: 'locked',
      endedAt: lockStartedAt,
      lockStartedAt,
      lockEndsAt: lockStartedAt + minutesToMs(session.lockDurationMinutes),
    });
    navigate('/session/locked');
  };

  return (
    <>
      <PageHeader title="Session active" subtitle="Stay with your purpose." navigate={navigate} backTo="/dashboard" />
      <section className="rounded-lg border border-line bg-white p-5 text-center shadow-soft">
        <AppLogo app={app} className="mx-auto h-14 w-14 rounded-[14px]" />
        <p className="mt-4 text-sm font-medium text-muted">{app.name}</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{session.purpose}</h1>
        <div className="mt-8 flex justify-center">
          <ProgressRing progress={progress} label={formatTimer(remaining)} />
        </div>
        <div className="mt-6 grid gap-3">
          <Button variant="secondary" icon={PauseCircle} onClick={startLock}>
            End session early
          </Button>
          <Button icon={CheckCircle2} onClick={startLock}>
            I'm done
          </Button>
        </div>
      </section>
    </>
  );
}

function LockedPage({ navigate, session, now }) {
  if (!session || session.status !== 'locked') {
    return <EmptyState navigate={navigate} title="No active lock" action="Start a session" path="/session/select-app" />;
  }

  const app = getSessionApp(session);
  const remaining = Math.max(0, session.lockEndsAt - now);
  const timeUsed = formatShort((session.endedAt || session.lockStartedAt) - session.startedAt);

  return (
    <>
      <PageHeader title="Your break has started" subtitle="Meet without the scroll." navigate={navigate} backTo="/dashboard" />
      <section className="rounded-lg bg-deep p-5 text-white shadow-soft">
        <div className="flex items-center justify-between">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white/12">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold">Simulated lock</span>
        </div>
        <h1 className="mt-8 text-3xl font-semibold">Time's up. {app.name} is locked.</h1>
        <p className="mt-3 text-white/75">Take {session.lockDurationMinutes} minutes away from the loop.</p>
        <div className="mt-8 rounded-lg bg-white/10 p-4">
          <p className="text-sm text-white/70">Lock countdown</p>
          <p className="mt-1 text-5xl font-semibold tabular-nums">{formatTimer(remaining)}</p>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="grid gap-3">
          <DetailRow label="Locked app" value={app.name} />
          <DetailRow label="Purpose" value={session.purpose} />
          <DetailRow label="Time used" value={timeUsed} />
          <DetailRow label="Next unlock" value={formatTime(session.lockEndsAt)} />
        </div>
      </section>

      <div className="mt-4 grid gap-3">
        <Button icon={Users} onClick={() => navigate('/friends')}>
          See friends offline
        </Button>
        <Button variant="secondary" icon={MapPin} onClick={() => navigate('/places')}>
          Find phone-free places
        </Button>
      </div>
    </>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0">
      <p className="text-sm text-muted">{label}</p>
      <p className="max-w-[60%] text-right text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function EmptyState({ navigate, title, action, path }) {
  return (
    <>
      <PageHeader title={title} subtitle="LoopOut is ready when you are." navigate={navigate} backTo="/dashboard" />
      <div className="rounded-lg border border-line bg-white p-6 text-center shadow-soft">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-soft text-primary">
          <Timer className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-muted">Write your purpose, choose a limit and begin again with intention.</p>
        <Button className="mt-6 w-full" onClick={() => navigate(path)}>
          {action}
        </Button>
      </div>
    </>
  );
}

function SkeletonStack({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm" key={index}>
          <div className="flex animate-pulse gap-3">
            <div className="h-11 w-11 rounded-full bg-soft" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-2/3 rounded-full bg-soft" />
              <div className="h-3 w-full rounded-full bg-canvas" />
              <div className="h-3 w-1/2 rounded-full bg-canvas" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FriendsPage({
  navigate,
  settings,
  openInvite,
  friends = [],
  requests = [],
  invites = [],
  currentUserId,
  isRemote,
  loading,
  onSearch,
  onSendFriendRequest,
  onRespondFriendRequest,
  onRespondInvite,
}) {
  const [filter, setFilter] = useState('Available now');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const visibleFriends = friends;
  const pendingOfflineInvites = invites.filter((invite) => invite.status === 'pending');
  const filteredFriends = visibleFriends.filter((friend) => {
    if (filter === 'Available now') return friend.available;
    if (filter === 'Nearby') return ['Campo Grande', 'Saldanha', 'Chiado'].includes(friend.area);
    if (filter === 'Same school/university') return friend.school.includes('Universidade') || friend.school === 'IST';
    return true;
  });

  const runSearch = async () => {
    if (!onSearch || query.trim().length < 2) return;
    setSearching(true);
    setActionError('');
    setActionMessage('');
    try {
      setSearchResults(await onSearch(query));
      setHasSearched(true);
    } catch (err) {
      setActionError(err.message || 'Could not search right now.');
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (profileId) => {
    setActionError('');
    setActionMessage('');
    try {
      await onSendFriendRequest(profileId);
      setActionMessage('Friend request sent.');
      setSearchResults((items) => items.filter((item) => item.id !== profileId));
    } catch (err) {
      setActionError(err.message || 'Could not send friend request.');
    }
  };

  const respond = async (request, status) => {
    setActionError('');
    setActionMessage('');
    try {
      await onRespondFriendRequest(request.id, status);
      setActionMessage(status === 'accepted' ? 'Friend request accepted.' : 'Friend request declined.');
    } catch (err) {
      setActionError(err.message || 'Could not update the request.');
    }
  };

  const respondOfflineInvite = async (invite, status) => {
    setActionError('');
    setActionMessage('');
    try {
      await onRespondInvite(invite.id, status);
      setActionMessage(status === 'accepted' ? 'Offline invite accepted.' : 'Offline invite updated.');
    } catch (err) {
      setActionError(err.message || 'Could not update the invite.');
    }
  };

  return (
    <>
      <PageHeader title="Friends also offline" subtitle="You're not disconnecting alone." navigate={navigate} backTo="/dashboard" />

      {!isRemote ? (
        <section className="mb-4 rounded-lg border border-line bg-white p-5 shadow-sm">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-soft text-primary">
            <UserPlus className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-ink">Sign in to add friends.</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Friends are powered by Supabase. Search by username or email, send requests, and share offline status only
            with accepted friends.
          </p>
          <Button className="mt-4 w-full" variant="soft" icon={Settings} onClick={() => navigate('/settings')}>
            View launch setup
          </Button>
        </section>
      ) : null}

      {isRemote ? (
        <section className="mb-4 rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className="min-h-12 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-base text-ink outline-none focus:border-primary focus:bg-white"
                placeholder="Search username or email"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runSearch();
                }}
              />
            </div>
            <Button className="px-4" icon={Search} disabled={searching || query.trim().length < 2} onClick={runSearch}>
              {searching ? 'Searching' : 'Search'}
            </Button>
          </div>
          {actionMessage ? <p className="mt-3 rounded-lg bg-[#E8F8EF] p-3 text-sm text-[#137A3D]">{actionMessage}</p> : null}
          {actionError ? <p className="mt-3 rounded-lg bg-[#FFF1F0] p-3 text-sm text-[#B42318]">{actionError}</p> : null}
          {searchResults.length ? (
            <div className="mt-3 space-y-2">
              {searchResults.map((item) => {
                const name = item.full_name || item.username || item.email;
                return (
                  <div className="flex items-center gap-3 rounded-lg bg-canvas p-3" key={item.id}>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white font-semibold text-deep">
                      {getInitials(name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{name}</p>
                      <p className="truncate text-xs text-muted">{item.username ? `@${item.username}` : item.email}</p>
                    </div>
                    <Button variant="soft" className="px-3" icon={UserPlus} onClick={() => sendRequest(item.id)}>
                      Add
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : hasSearched && !searching ? (
            <p className="mt-3 rounded-lg bg-canvas p-3 text-sm leading-6 text-muted">
              No visible LoopOut profile matched that search. Try a username or email.
            </p>
          ) : null}
        </section>
      ) : null}

      {isRemote && requests.length ? (
        <section className="mb-4 rounded-lg border border-line bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-ink">Friend requests</h2>
          <div className="mt-3 space-y-2">
            {requests.map((request) => (
              <div className="rounded-lg bg-canvas p-3" key={request.id}>
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-white font-semibold text-deep">
                    {request.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{request.name}</p>
                    <p className="text-xs text-muted">
                      {request.direction === 'received' ? 'Wants to go offline together' : 'Request sent'}
                    </p>
                  </div>
                </div>
                {request.direction === 'received' ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="soft" onClick={() => respond(request, 'accepted')}>
                      Accept
                    </Button>
                    <Button variant="secondary" onClick={() => respond(request, 'declined')}>
                      Decline
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isRemote && pendingOfflineInvites.length ? (
        <section className="mb-4 rounded-lg border border-line bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-ink">Offline invites</h2>
          <div className="mt-3 space-y-2">
            {pendingOfflineInvites.map((invite) => {
              const incoming = invite.receiver_id === currentUserId;
              return (
                <div className="rounded-lg bg-canvas p-3" key={invite.id}>
                  <p className="text-sm font-semibold text-ink">
                    {incoming ? 'New invite' : 'Invite sent'} · {invite.place?.name || 'Phone-free place'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {invite.message || 'Meet offline after this LoopOut session.'}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {incoming ? (
                      <>
                        <Button variant="soft" onClick={() => respondOfflineInvite(invite, 'accepted')}>
                          Accept
                        </Button>
                        <Button variant="secondary" onClick={() => respondOfflineInvite(invite, 'declined')}>
                          Decline
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" className="col-span-2" onClick={() => respondOfflineInvite(invite, 'cancelled')}>
                        Cancel invite
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {visibleFriends.length ? (
        <div className="flex gap-2 overflow-x-auto pb-3">
          {['Available now', 'Nearby', 'Same school/university', 'Offline today'].map((item) => (
            <button
              type="button"
              className={classNames(
                'min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold',
                filter === item ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink'
              )}
              key={item}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
      {loading ? (
        <SkeletonStack />
      ) : filteredFriends.length ? (
        <div className="space-y-3">
          {filteredFriends.map((friend) => (
            <FriendCard
              friend={friend}
              key={friend.id}
              privacyOn={settings.showLockedApp}
              shareArea={settings.shareArea}
              onInvite={(item) => openInvite(item, null)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-white p-6 text-center shadow-soft">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-soft text-primary">
            <Users className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-ink">Add friends to go offline together.</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {isRemote
              ? 'Search by username or email, then invite accepted friends to a phone-free place.'
              : 'Sign in with Supabase to search for friends and send requests.'}
          </p>
        </div>
      )}
      <p className="mt-4 rounded-lg bg-soft p-3 text-sm leading-6 text-deep">
        Privacy is adjustable in settings. Friends only see your offline status, area and app details when you allow it.
      </p>
    </>
  );
}

function PlacesPage({ navigate, openInvite, places = lisbonPlaces, loading }) {
  const [category, setCategory] = useState('All');
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const categories = ['All', 'Public gardens', 'Parks & gardens', 'Libraries', 'Study spots', 'Cafes', 'Cultural spaces'];

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      return;
    }

    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus('ready');
      },
      (error) => {
        setUserLocation(null);
        setLocationStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000 * 60 * 5,
        timeout: 10000,
      }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const placesByDistance = useMemo(() => {
    if (!userLocation) return places;

    return places
      .map((place) => ({
        ...place,
        distanceKm: place.coordinates ? getDistanceKm(userLocation, place.coordinates) : null,
      }))
      .sort((first, second) => {
        const firstDistance = first.distanceKm ?? Number.POSITIVE_INFINITY;
        const secondDistance = second.distanceKm ?? Number.POSITIVE_INFINITY;
        return firstDistance - secondDistance;
      });
  }, [places, userLocation]);

  const visiblePlaces =
    category === 'All' ? placesByDistance : placesByDistance.filter((place) => place.type === category);

  const locationCopy = {
    idle: 'Preparing nearby places.',
    requesting: 'Requesting your location...',
    ready: 'Nearest places first.',
    denied: 'Location is off. Showing the curated order.',
    error: 'Could not read your location. Showing the curated order.',
    unsupported: 'Location is not available in this browser.',
  };

  return (
    <>
      <PageHeader title="Phone-free places in Lisbon" subtitle="Meet, study, walk or talk without the scroll." navigate={navigate} backTo="/dashboard" />
      <div className="mb-4 rounded-lg border border-line bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-soft text-primary">
            <Compass className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-6 text-muted">
              These are suggested places for phone-free moments, not official phone-free zones yet.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={classNames(
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  locationStatus === 'ready' ? 'bg-[#E8F8EF] text-[#137A3D]' : 'bg-soft text-deep'
                )}
              >
                {locationCopy[locationStatus]}
              </span>
              {['denied', 'error'].includes(locationStatus) ? (
                <button type="button" className="text-xs font-semibold text-primary" onClick={requestLocation}>
                  Try location again
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-3">
        {categories.map((item) => (
          <button
            type="button"
            className={classNames(
              'min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold',
              category === item ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink'
            )}
            key={item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {loading ? <SkeletonStack /> : null}
      <PhoneFreeMap places={visiblePlaces} userLocation={userLocation} />
      <div className="space-y-3">
        {visiblePlaces.map((place) => (
          <PlaceCard place={place} key={place.id} onInvite={openInvite} />
        ))}
      </div>
    </>
  );
}

function ProgressPage({ navigate, session, invites, stats, screenTimeLogs = [], loading }) {
  const snapshot = stats || fallbackProgressSnapshot(session, invites, screenTimeLogs);
  const weeklyValues = snapshot.weeklySaved?.length ? snapshot.weeklySaved : [0, 0, 0, 0, 0, 0, 0];
  const maxWeekly = Math.max(1, ...weeklyValues);
  const appRows = snapshot.sessionsByApp || [];
  const latestLog = screenTimeLogs[0] || snapshot.latestScreenTime;

  return (
    <>
      <PageHeader title="LoopOut analytics" subtitle="Measured from LoopOut activity." navigate={navigate} backTo="/dashboard" />
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h1 className="text-2xl font-semibold text-ink">
          {loading ? 'Loading your LoopOut analytics...' : `You protected ${formatMinutes(snapshot.estimatedTimeSaved)} from scrolling this week.`}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Based on sessions started, timers completed, lock periods, purposes and offline invites inside LoopOut.
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">
          iPhone Screen Time is not read automatically by this PWA.
        </p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Sessions completed" value={loading ? '...' : snapshot.completedSessions} icon={CheckCircle2} />
        <StatCard label="Intentional time" value={loading ? '...' : formatMinutes(snapshot.totalIntentionalMinutes)} icon={Timer} />
        <StatCard label="Lock time" value={loading ? '...' : formatMinutes(snapshot.totalLockMinutes)} icon={LockKeyhole} />
        <StatCard label="Current streak" value={loading ? '...' : `${snapshot.currentStreak}d`} icon={BookOpen} />
        <StatCard label="Offline invites sent" value={loading ? '...' : snapshot.invitesSent} icon={Users} />
        <StatCard label="Meetups accepted" value={loading ? '...' : snapshot.invitesAccepted} icon={Heart} />
      </div>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">Weekly lock time</h2>
          <span className="text-sm text-muted">minutes</span>
        </div>
        <div className="mt-5 flex h-36 items-end gap-2">
          {weeklyValues.map((value, index) => (
            <div className="flex flex-1 flex-col items-center gap-2" key={index}>
              <div
                className="w-full rounded-t-lg bg-primary"
                style={{ height: `${Math.max(18, (value / maxWeekly) * 100)}%`, opacity: 0.42 + index * 0.07 }}
              />
              <span className="text-[11px] text-muted">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Sessions by app</h2>
        {appRows.length ? (
        <div className="mt-5 space-y-4">
          {appRows.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-ink">{item.label}</span>
                <span className="text-muted">{item.value}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-line">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${item.value}%` }} />
              </div>
            </div>
          ))}
        </div>
        ) : (
          <p className="mt-4 rounded-lg bg-canvas p-3 text-sm leading-6 text-muted">
            Start a session to see your app breakdown.
          </p>
        )}
      </section>

      <section className="mt-4 grid gap-3 pb-2">
        <button
          type="button"
          className="rounded-lg border border-line bg-white p-4 text-left shadow-sm"
          onClick={() => navigate('/screen-time-import')}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted">Screen Time Import</p>
              <p className="mt-1 text-lg font-semibold text-ink">
                {latestLog ? `${formatMinutes(latestLog.totalScreenTimeMinutes)} on ${formatDate(latestLog.date)}` : 'Add manual iPhone Screen Time'}
              </p>
            </div>
            <UploadCloud className="h-5 w-5 text-primary" />
          </div>
        </button>
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="text-sm text-muted">Estimated time saved from scrolling</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatMinutes(snapshot.estimatedTimeSaved)}</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="text-sm text-muted">Most used distracting app</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{snapshot.mostUsedApp}</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="text-sm text-muted">Most common purpose word</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{snapshot.mostCommonPurpose}</p>
        </div>
      </section>
    </>
  );
}

function ScreenTimeImportPage({ navigate, logs = [], onSave, saving, isRemote }) {
  const [form, setForm] = useState({
    date: todayInputValue(),
    totalScreenTimeMinutes: 240,
    socialMediaMinutes: 90,
    mostUsedApp: 'Instagram',
    notes: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      await onSave(form);
      setMessage('Screen Time log saved.');
    } catch (err) {
      setError(getReadableSupabaseError(err) || 'Could not save this log.');
    }
  };

  return (
    <>
      <PageHeader title="Screen Time Import" subtitle="Manual comparison for now." navigate={navigate} backTo="/progress" />
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-soft text-primary">
          <UploadCloud className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-ink">Compare iPhone Screen Time with LoopOut progress.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          LoopOut PWA cannot automatically read iPhone Screen Time yet. For now, you can manually enter your daily
          Screen Time to compare it with your LoopOut progress. Native iOS Screen Time integration can be added later.
        </p>
        {!isRemote ? (
          <p className="mt-3 rounded-lg bg-soft p-3 text-sm leading-6 text-deep">
            These logs are saved to your LoopOut account when you are signed in.
          </p>
        ) : null}
      </section>

      <form className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm" onSubmit={submit}>
        <div className="grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">Date</span>
            <input
              className="mt-2 min-h-12 w-full rounded-lg border border-line bg-canvas px-3 text-base text-ink outline-none focus:border-primary"
              type="date"
              value={form.date}
              onChange={(event) => updateForm('date', event.target.value)}
            />
          </label>
          <NumberField
            label="Total iPhone Screen Time"
            value={form.totalScreenTimeMinutes}
            min={0}
            max={1440}
            onChange={(value) => updateForm('totalScreenTimeMinutes', value)}
          />
          <NumberField
            label="Social media time"
            value={form.socialMediaMinutes}
            min={0}
            max={1440}
            onChange={(value) => updateForm('socialMediaMinutes', value)}
          />
          <Field label="Most used app" value={form.mostUsedApp} onChange={(value) => updateForm('mostUsedApp', value)} />
          <label className="block">
            <span className="text-sm font-medium text-ink">Notes</span>
            <textarea
              className="mt-2 min-h-24 w-full resize-none rounded-lg border border-line bg-canvas px-3 py-3 text-base text-ink outline-none focus:border-primary"
              value={form.notes}
              onChange={(event) => updateForm('notes', event.target.value)}
              placeholder="What changed today?"
            />
          </label>
        </div>
        {message ? <p className="mt-4 rounded-lg bg-[#E8F8EF] p-3 text-sm text-[#137A3D]">{message}</p> : null}
        {error ? <p className="mt-4 rounded-lg bg-[#FFF1F0] p-3 text-sm text-[#B42318]">{error}</p> : null}
        <Button className="mt-5 w-full" icon={Calendar} type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save daily Screen Time'}
        </Button>
      </form>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Recent manual logs</h2>
        {logs.length ? (
          <div className="mt-3 space-y-2">
            {logs.slice(0, 7).map((log) => (
              <div className="rounded-lg bg-canvas p-3" key={log.id || log.date}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{formatDate(log.date)}</p>
                    <p className="text-xs text-muted">{log.mostUsedApp || 'No app noted'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">{formatMinutes(log.totalScreenTimeMinutes)}</p>
                    <p className="text-xs text-muted">{formatMinutes(log.socialMediaMinutes)} social</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-canvas p-3 text-sm leading-6 text-muted">
            No manual Screen Time logs yet.
          </p>
        )}
      </section>
    </>
  );
}

function SettingsPage({
  navigate,
  profile,
  setProfile,
  settings,
  setSettings,
  isRemote,
  onSaveProfile,
  onSavePrivacy,
  onLogout,
}) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const loopoutUrl = `${window.location.origin}/session/select-app`;

  const updateProfile = (key, value) => {
    const next = { ...profile, [key]: value };
    if (key === 'name') next.avatar = value.charAt(0).toUpperCase() || 'B';
    setProfile(next);
  };

  const saveProfile = async () => {
    setSaving(true);
    setNotice('');
    setError('');
    try {
      await onSaveProfile?.({
        full_name: profile.name,
        username: profile.username,
        email: profile.email,
        city: profile.city,
        area: profile.area,
      });
      setNotice('Profile saved.');
    } catch (err) {
      setError(getReadableSupabaseError(err) || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const updatePrivacy = async (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setNotice('');
    setError('');
    try {
      await onSavePrivacy?.(next);
    } catch (err) {
      setError(getReadableSupabaseError(err) || 'Could not update privacy settings.');
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(loopoutUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Tune LoopOut to your habits." navigate={navigate} backTo="/dashboard" />

      <SettingsGroup title="Profile" icon={CircleUserRound}>
        <Field label="Name" value={profile.name} onChange={(value) => updateProfile('name', value)} />
        <Field label="Username" value={profile.username || ''} onChange={(value) => updateProfile('username', value)} />
        <Field label="Email" type="email" value={profile.email} onChange={(value) => updateProfile('email', value)} />
        <Field label="City" value={profile.city} onChange={(value) => updateProfile('city', value)} />
        <Field label="Area / neighbourhood" value={profile.area || ''} onChange={(value) => updateProfile('area', value)} />
        <div className="flex items-center gap-3 rounded-lg bg-canvas p-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-white font-semibold text-deep shadow-sm">
            {profile.avatar}
          </div>
          <p className="text-sm text-muted">Avatar initials update from your name.</p>
        </div>
        {notice ? <p className="rounded-lg bg-[#E8F8EF] p-3 text-sm text-[#137A3D]">{notice}</p> : null}
        {error ? <p className="rounded-lg bg-[#FFF1F0] p-3 text-sm text-[#B42318]">{error}</p> : null}
        <Button className="w-full" variant="soft" icon={CheckCircle2} disabled={saving} onClick={saveProfile}>
          {saving ? 'Saving...' : 'Save profile'}
        </Button>
      </SettingsGroup>

      <SettingsGroup title="Session settings" icon={SlidersHorizontal}>
        <SelectRow
          label="Default timer"
          value={settings.defaultTimer}
          options={[5, 10, 15, 20, 30]}
          suffix="minutes"
          onChange={(value) => setSettings({ ...settings, defaultTimer: Number(value) })}
        />
        <SelectRow
          label="Default lock duration"
          value={settings.defaultLock}
          options={[15, 30, 45, 60]}
          suffix="minutes"
          onChange={(value) => setSettings({ ...settings, defaultLock: Number(value) })}
        />
        <div className="rounded-lg bg-canvas p-3 text-sm text-muted">
          Default distracting apps: {settings.distractingApps.join(', ')}
        </div>
      </SettingsGroup>

      <SettingsGroup title="Privacy" icon={ShieldCheck}>
        <ToggleRow
          label="Show offline status to friends"
          checked={settings.showOfflineStatus}
          onChange={(value) => updatePrivacy('showOfflineStatus', value)}
        />
        <ToggleRow
          label="Show locked app name"
          checked={settings.showLockedApp}
          onChange={(value) => updatePrivacy('showLockedApp', value)}
        />
        <ToggleRow
          label="Show area/neighbourhood"
          checked={settings.shareArea}
          onChange={(value) => updatePrivacy('shareArea', value)}
        />
        <ToggleRow
          label="Allow offline invites"
          checked={settings.allowInvites}
          onChange={(value) => updatePrivacy('allowInvites', value)}
        />
        <ToggleRow
          label="Allow friend requests"
          checked={settings.allowFriendRequests}
          onChange={(value) => updatePrivacy('allowFriendRequests', value)}
        />
        <ToggleRow
          label="Hide profile from search"
          checked={settings.hideProfileFromSearch}
          onChange={(value) => updatePrivacy('hideProfileFromSearch', value)}
        />
      </SettingsGroup>

      <SettingsGroup title="iPhone Automation Setup" icon={Smartphone}>
        <Button className="w-full" variant="soft" icon={Copy} onClick={copyUrl}>
          {copied ? 'Copied' : 'Copy my LoopOut URL'}
        </Button>
        <button
          type="button"
          className="w-full rounded-lg border border-line bg-white p-3 text-left text-sm font-semibold text-deep"
          onClick={() => navigate('/setup-iphone')}
        >
          Show step-by-step setup instructions
        </button>
        <div className="rounded-lg bg-canvas p-3 text-sm text-muted">
          Connect manually in Shortcuts: TikTok, Instagram, YouTube Shorts, Snapchat, X.
        </div>
      </SettingsGroup>

      <SettingsGroup title="PWA Setup" icon={Smartphone}>
        <ol className="space-y-3 text-sm leading-6 text-muted">
          <li>1. Open LoopOut in Safari.</li>
          <li>2. Tap Share.</li>
          <li>3. Tap Add to Home Screen.</li>
          <li>4. Tap Add.</li>
        </ol>
        <p className="rounded-lg bg-soft p-3 text-sm leading-6 text-deep">
          Adding LoopOut to your Home Screen makes it feel more like a real app.
        </p>
      </SettingsGroup>

      <SettingsGroup title="Data" icon={UploadCloud}>
        <button
          type="button"
          className="w-full rounded-lg border border-line bg-white p-3 text-left text-sm font-semibold text-deep"
          onClick={() => navigate('/screen-time-import')}
        >
          Open Screen Time Import
        </button>
        {isRemote ? (
          <Button className="w-full" variant="secondary" icon={LogOut} onClick={onLogout}>
            Log out
          </Button>
        ) : null}
      </SettingsGroup>

      <p className="rounded-lg bg-white p-4 text-sm leading-6 text-muted shadow-sm">
        LoopOut currently simulates app locking. Connect it with iPhone Shortcuts to create a pause before opening
        distracting apps. Native app blocking can be added in a future version.
      </p>
    </>
  );
}

function SettingsGroup({ title, icon: Icon, children }) {
  return (
    <section className="mb-4 rounded-lg border border-line bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-soft text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-semibold text-ink">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SelectRow({ label, value, options, suffix, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-ink">{label}</span>
      <select
        className="min-h-11 rounded-full border border-line bg-canvas px-3 text-sm font-semibold text-ink outline-none focus:border-primary"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option} {suffix}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input className="sr-only" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span
        className={classNames(
          'relative h-8 w-14 rounded-full transition',
          checked ? 'bg-primary' : 'bg-line'
        )}
      >
        <span
          className={classNames(
            'absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition',
            checked ? 'left-7' : 'left-1'
          )}
        />
      </span>
    </label>
  );
}

function SetupPage({ navigate }) {
  const [copied, setCopied] = useState(false);
  const loopoutUrl = `${window.location.origin}/session/select-app`;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(loopoutUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <main className="mx-auto max-w-md px-4 pb-12">
        <PageHeader title="Connect LoopOut to iPhone Shortcuts" subtitle="Open LoopOut before distracting apps." navigate={navigate} backTo="/" />
        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="grid h-14 w-14 place-items-center rounded-[16px] bg-soft text-primary">
            <Smartphone className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-semibold leading-tight text-ink">Connect LoopOut to iPhone Shortcuts.</h1>
          <p className="mt-3 leading-7 text-muted">
            Whenever you open a selected app, iPhone can open LoopOut first so you write a purpose and set a timer.
          </p>
          <Button className="mt-5 w-full" variant="soft" icon={Copy} onClick={copyUrl}>
            {copied ? 'Copied' : 'Copy my LoopOut URL'}
          </Button>
        </section>

        <section className="mt-4 space-y-3">
          {setupSteps.map((step, index) => (
            <div className="flex gap-3 rounded-lg border border-line bg-white p-4 shadow-sm" key={step}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-soft text-sm font-semibold text-deep">
                {index + 1}
              </span>
              <p className="text-sm leading-6 text-ink">{step}</p>
            </div>
          ))}
        </section>

        <Button className="mt-5 w-full" icon={ArrowRight} onClick={() => navigate('/dashboard')}>
          Start LoopOut
        </Button>
      </main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4 text-ink">
      <div className="w-full max-w-sm rounded-lg border border-line bg-white p-6 text-center shadow-soft">
        <div className="mx-auto mb-4 h-12 w-12 overflow-hidden rounded-[12px] border border-line bg-white shadow-sm">
          <img className="h-full w-full object-cover" src="/loopout-logo-512.png" alt="" />
        </div>
        <h1 className="text-xl font-semibold text-ink">Loading LoopOut</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Syncing your sessions, friends and progress.</p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-soft">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}

function BackendRequiredScreen({ navigate }) {
  return (
    <div className="min-h-screen bg-canvas px-4 py-[calc(env(safe-area-inset-top)+24px)] text-ink">
      <div className="mx-auto max-w-md">
        <button type="button" className="mb-8" onClick={() => navigate('/')}>
          <BrandMark />
        </button>
        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="grid h-14 w-14 place-items-center rounded-[16px] bg-soft text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.12em] text-primary">Supabase required</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-ink">LoopOut is ready for the real backend.</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {supabaseConfigError ||
              'This environment does not expose the Supabase variables yet. In Vercel, add the production variables and redeploy so accounts, friends, sessions and analytics use the database.'}
          </p>
          <div className="mt-5 space-y-2 rounded-lg bg-canvas p-3 text-sm text-muted">
            <p className="font-semibold text-ink">Required variables</p>
            <p>VITE_SUPABASE_URL</p>
            <p>VITE_SUPABASE_ANON_KEY</p>
          </div>
          <Button className="mt-5 w-full" variant="soft" icon={Copy} onClick={() => navigate('/setup-iphone')}>
            View iPhone setup
          </Button>
        </section>
      </div>
    </div>
  );
}

export default function App() {
  const { path, navigate } = useRoute();
  const now = useNow();
  const [profile, setProfile] = useLocalStorage(storageKeys.profile, defaultProfile);
  const [settings, setSettings] = useLocalStorage(storageKeys.settings, defaultSettings);
  const [session, setSession] = useLocalStorage(storageKeys.session, null);
  const [draft, setDraft] = useLocalStorage(storageKeys.draft, {
    appId: 'instagram',
    purpose: '',
    timerMinutes: defaultSettings.defaultTimer,
    lockDurationMinutes: defaultSettings.defaultLock,
  });
  const [invites, setInvites] = useLocalStorage(storageKeys.invites, []);
  const [screenTimeLogs, setScreenTimeLogs] = useLocalStorage(storageKeys.screenTimeLogs, []);
  const [, setOnboarded] = useLocalStorage(storageKeys.onboarded, false);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [dataLoading, setDataLoading] = useState(false);
  const [remoteFriends, setRemoteFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [remoteInvites, setRemoteInvites] = useState([]);
  const [places, setPlaces] = useState(lisbonPlaces);
  const [progressStats, setProgressStats] = useState(null);
  const [backendError, setBackendError] = useState('');
  const [inviteModal, setInviteModal] = useState(null);
  const [inviteToast, setInviteToast] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [screenTimeSaving, setScreenTimeSaving] = useState(false);

  const isRemote = isSupabaseConfigured && Boolean(authUser);
  const activeFriends = isRemote ? remoteFriends : [];
  const activeInvites = isRemote ? remoteInvites : invites;
  const activePlaces = places.length ? places : lisbonPlaces;
  const activeStats = progressStats || fallbackProgressSnapshot(session, activeInvites, screenTimeLogs);

  const loadRemoteData = useCallback(
    async (user) => {
      if (!isSupabaseConfigured || !user) return;
      setDataLoading(true);
      setBackendError('');

      try {
        const [profileRow, sessionRow, placeRows, friendsPayload, inviteRows, stats, logs] = await Promise.all([
          fetchProfile(user),
          fetchActiveSession(user.id),
          fetchPlaces(),
          fetchFriends(user.id),
          fetchInvites(user.id),
          fetchProgressSnapshot(user.id),
          fetchScreenTimeLogs(user.id),
        ]);

        const nextProfile = profileFromRow(profileRow, user);
        setProfile(nextProfile);
        setSettings((current) => ({ ...current, ...nextProfile.privacy }));
        setSession(sessionRow ? sessionFromRecord(sessionRow) : null);
        setPlaces(placeRows.length ? placeRows.map(placeFromRecord).filter(Boolean) : lisbonPlaces);
        setRemoteFriends(friendsPayload.friends.map(friendFromBundle));
        setFriendRequests(friendsPayload.requests.map(friendRequestFromBundle));
        setRemoteInvites(inviteRows);
        setProgressStats(stats);
        setScreenTimeLogs(logs.map(screenTimeLogFromRecord));
      } catch (err) {
        setBackendError(getReadableSupabaseError(err) || 'Could not load LoopOut data.');
      } finally {
        setDataLoading(false);
      }
    },
    [setProfile, setScreenTimeLogs, setSession, setSettings]
  );

  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return undefined;
    }

    const boot = async () => {
      try {
        const { user } = await getAuthSession();
        if (cancelled) return;
        setAuthUser(user);
        if (user) await loadRemoteData(user);
      } catch (err) {
        if (!cancelled) setBackendError(getReadableSupabaseError(err) || 'Could not connect to Supabase.');
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    };

    boot();

    const unsubscribe = subscribeToAuthChanges((_event, authSession) => {
      const user = authSession?.user || null;
      setAuthUser(user);
      if (user) {
        loadRemoteData(user);
      } else {
        setRemoteFriends([]);
        setFriendRequests([]);
        setRemoteInvites([]);
        setProgressStats(null);
        setSession(null);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadRemoteData, setSession]);

  const persistSessionLock = useCallback(
    async (nextSession) => {
      if (!isRemote || !authUser || !nextSession.remoteId) return;
      const app = getSessionApp(nextSession);
      await Promise.all([
        updateSessionRecord(nextSession.remoteId, {
          status: 'locked',
          ended_at: isoFromMs(nextSession.endedAt),
          lock_started_at: isoFromMs(nextSession.lockStartedAt),
          lock_ends_at: isoFromMs(nextSession.lockEndsAt),
        }),
        upsertOfflineStatus(authUser.id, {
          is_offline: settings.showOfflineStatus,
          locked_app: settings.showLockedApp ? app.name : null,
          lock_started_at: isoFromMs(nextSession.lockStartedAt),
          lock_ends_at: isoFromMs(nextSession.lockEndsAt),
          visible_to_friends: settings.showOfflineStatus,
          area: settings.shareArea ? profile.area || profile.city : null,
        }),
      ]);
      setProgressStats(await fetchProgressSnapshot(authUser.id));
    },
    [authUser, isRemote, profile.area, profile.city, settings.shareArea, settings.showLockedApp, settings.showOfflineStatus]
  );

  const persistSessionComplete = useCallback(
    async (nextSession) => {
      if (!isRemote || !authUser || !nextSession.remoteId) return;
      await Promise.all([
        updateSessionRecord(nextSession.remoteId, {
          status: 'completed',
          completed: true,
          ended_at: isoFromMs(nextSession.endedAt || nextSession.lockStartedAt),
          lock_started_at: isoFromMs(nextSession.lockStartedAt),
          lock_ends_at: isoFromMs(nextSession.lockEndsAt),
        }),
        upsertOfflineStatus(authUser.id, {
          is_offline: false,
          locked_app: null,
          lock_started_at: null,
          lock_ends_at: null,
          visible_to_friends: settings.showOfflineStatus,
          area: settings.shareArea ? profile.area || profile.city : null,
        }),
      ]);
      await loadRemoteData(authUser);
    },
    [authUser, isRemote, loadRemoteData, profile.area, profile.city, settings.shareArea, settings.showOfflineStatus]
  );

  useEffect(() => {
    if (!session) return;
    if (session.status === 'active' && now >= session.endsAt) {
      const lockStartedAt = session.endsAt;
      const nextSession = {
        ...session,
        status: 'locked',
        endedAt: session.endsAt,
        lockStartedAt,
        lockEndsAt: lockStartedAt + minutesToMs(session.lockDurationMinutes),
      };
      setSession(nextSession);
      persistSessionLock(nextSession).catch((err) => setBackendError(getReadableSupabaseError(err) || 'Could not save lock state.'));
      if (path !== '/session/locked') navigate('/session/locked');
    }
    if (session.status === 'locked' && now >= session.lockEndsAt) {
      const nextSession = {
        ...session,
        status: 'completed',
        completedAt: session.lockEndsAt,
      };
      setSession(nextSession);
      persistSessionComplete(nextSession).catch((err) => setBackendError(getReadableSupabaseError(err) || 'Could not complete session.'));
    }
  }, [navigate, now, path, persistSessionComplete, persistSessionLock, session, setSession]);

  const startSession = async (nextDraft) => {
    const startedAt = Date.now();
    const app = getAppById(nextDraft.appId);
    const cleanDraft = {
      ...nextDraft,
      appName: app.name,
      purpose: nextDraft.purpose.trim(),
      timerMinutes: Number(nextDraft.timerMinutes),
      lockDurationMinutes: Number(nextDraft.lockDurationMinutes),
    };

    try {
      if (isRemote && authUser) {
        const row = await createSessionRecord(authUser.id, cleanDraft);
        setSession(sessionFromRecord(row));
      } else {
        setSession({
          id: crypto.randomUUID(),
          appId: cleanDraft.appId,
          appName: cleanDraft.appName,
          purpose: cleanDraft.purpose,
          timerMinutes: cleanDraft.timerMinutes,
          lockDurationMinutes: cleanDraft.lockDurationMinutes,
          startedAt,
          endsAt: startedAt + minutesToMs(cleanDraft.timerMinutes),
          status: 'active',
        });
      }
      setDraft({ ...nextDraft, purpose: '' });
      navigate('/session/active');
    } catch (err) {
      setBackendError(getReadableSupabaseError(err) || 'Could not start session.');
    }
  };

  const openInvite = (friend = null, place = null) => {
    setInviteModal({ friend, place });
  };

  const sendInvite = async (invite) => {
    setInviteSending(true);
    try {
      if (isRemote && authUser) {
        await createInviteRecord({
          senderId: authUser.id,
          receiverId: invite.friendId,
          placeId: isUuid(invite.placeId) ? invite.placeId : null,
          suggestedTime: suggestedTimeToIso(invite.time),
          message: invite.message,
        });
        await loadRemoteData(authUser);
      } else {
        setInvites([
          {
            id: crypto.randomUUID(),
            ...invite,
            status: 'sent',
            createdAt: Date.now(),
          },
          ...invites,
        ]);
      }
      setInviteModal(null);
      setInviteToast(true);
      window.setTimeout(() => setInviteToast(false), 2600);
    } catch (err) {
      setBackendError(getReadableSupabaseError(err) || 'Could not send invite.');
    } finally {
      setInviteSending(false);
    }
  };

  const saveScreenTimeLog = async (log) => {
    setScreenTimeSaving(true);
    try {
      if (isRemote && authUser) {
        await createScreenTimeLog(authUser.id, log);
        const rows = await fetchScreenTimeLogs(authUser.id);
        setScreenTimeLogs(rows.map(screenTimeLogFromRecord));
      } else {
        const nextLog = { id: crypto.randomUUID(), ...log };
        setScreenTimeLogs([nextLog, ...screenTimeLogs.filter((item) => item.date !== log.date)]);
      }
    } finally {
      setScreenTimeSaving(false);
    }
  };

  const saveProfile = async (patch) => {
    if (!isRemote || !authUser) return;
    const row = await upsertProfile(authUser.id, patch);
    const nextProfile = profileFromRow(row, authUser);
    setProfile(nextProfile);
    setSettings((current) => ({ ...current, ...nextProfile.privacy }));
  };

  const savePrivacy = async (nextSettings) => {
    if (!isRemote || !authUser) return;
    await upsertProfile(authUser.id, {
      show_offline_status: nextSettings.showOfflineStatus,
      show_locked_app: nextSettings.showLockedApp,
      show_area: nextSettings.shareArea,
      allow_offline_invites: nextSettings.allowInvites,
      allow_friend_requests: nextSettings.allowFriendRequests,
      hide_profile_from_search: nextSettings.hideProfileFromSearch,
    });
  };

  const logout = async () => {
    if (isRemote) await signOutUser();
    setAuthUser(null);
    setRemoteFriends([]);
    setFriendRequests([]);
    setRemoteInvites([]);
    setProgressStats(null);
    setSession(null);
    navigate('/login');
  };

  const searchFriendsRemote = async (query) => {
    if (!isRemote || !authUser) return [];
    return searchProfiles(query, authUser.id);
  };

  const sendFriendRequestRemote = async (profileId) => {
    if (!isRemote || !authUser) return;
    await sendFriendRequest(authUser.id, profileId);
    await loadRemoteData(authUser);
  };

  const respondFriendRequestRemote = async (friendshipId, status) => {
    if (!isRemote || !authUser) return;
    await respondToFriendRequest(friendshipId, status);
    await loadRemoteData(authUser);
  };

  const respondInviteRemote = async (inviteId, status) => {
    if (!isRemote || !authUser) return;
    await respondToInvite(inviteId, status);
    await loadRemoteData(authUser);
  };

  const publicPage = (() => {
    if (path === '/') return <Landing navigate={navigate} />;
    if (path === '/onboarding') return <Onboarding navigate={navigate} setOnboarded={setOnboarded} />;
    if (path === '/login') {
      if (!isSupabaseConfigured) return <BackendRequiredScreen navigate={navigate} />;
      return (
        <AuthPage
          navigate={navigate}
          profile={profile}
          onAuthReady={(user) => loadRemoteData(user)}
        />
      );
    }
    if (path === '/setup-iphone') return <SetupPage navigate={navigate} />;
    return null;
  })();

  const content = (() => {
    if (authLoading) return <LoadingScreen />;
    if (publicPage) return publicPage;

    if (!isSupabaseConfigured) {
      return <BackendRequiredScreen navigate={navigate} />;
    }

    if (isSupabaseConfigured && !authUser) {
      return (
        <AuthPage
          navigate={navigate}
          profile={profile}
          onAuthReady={(user) => loadRemoteData(user)}
        />
      );
    }

    if (path === '/') return <Landing navigate={navigate} />;
    if (path === '/onboarding') return <Onboarding navigate={navigate} setOnboarded={setOnboarded} />;
    if (path === '/login') {
      if (!isSupabaseConfigured) return <BackendRequiredScreen navigate={navigate} />;
      return (
        <AuthPage
          navigate={navigate}
          profile={profile}
          onAuthReady={(user) => loadRemoteData(user)}
        />
      );
    }
    if (path === '/setup-iphone') return <SetupPage navigate={navigate} />;

    const shellPage = (() => {
      if (path === '/dashboard') {
        return (
          <Dashboard
            navigate={navigate}
            profile={profile}
            session={session}
            now={now}
            stats={activeStats}
            friends={activeFriends}
            invites={activeInvites}
            loading={dataLoading}
            isRemote={isRemote}
          />
        );
      }
      if (path === '/session/select-app') return <SelectAppPage navigate={navigate} draft={draft} setDraft={setDraft} />;
      if (path === '/session/purpose') return <PurposePage navigate={navigate} draft={draft} setDraft={setDraft} />;
      if (path === '/session/timer') {
        return (
          <TimerPage
            navigate={navigate}
            draft={draft}
            setDraft={setDraft}
            settings={settings}
            startSession={startSession}
          />
        );
      }
      if (path === '/session/active') {
        return (
          <ActiveTimerPage
            navigate={navigate}
            session={session}
            setSession={setSession}
            now={now}
            onSessionLock={(nextSession) =>
              persistSessionLock(nextSession).catch((err) =>
                setBackendError(getReadableSupabaseError(err) || 'Could not save lock state.')
              )
            }
          />
        );
      }
      if (path === '/session/locked') {
        return <LockedPage navigate={navigate} session={session} now={now} />;
      }
      if (path === '/friends') {
        return (
          <FriendsPage
            navigate={navigate}
            settings={settings}
            openInvite={openInvite}
            friends={activeFriends}
            requests={friendRequests}
            invites={activeInvites}
            currentUserId={authUser?.id}
            isRemote={isRemote}
            loading={dataLoading}
            onSearch={searchFriendsRemote}
            onSendFriendRequest={sendFriendRequestRemote}
            onRespondFriendRequest={respondFriendRequestRemote}
            onRespondInvite={respondInviteRemote}
          />
        );
      }
      if (path === '/places') return <PlacesPage navigate={navigate} openInvite={openInvite} places={activePlaces} loading={dataLoading} />;
      if (path === '/progress') {
        return (
          <ProgressPage
            navigate={navigate}
            session={session}
            invites={activeInvites}
            stats={activeStats}
            screenTimeLogs={screenTimeLogs}
            loading={dataLoading}
          />
        );
      }
      if (path === '/screen-time-import') {
        return (
          <ScreenTimeImportPage
            navigate={navigate}
            logs={screenTimeLogs}
            onSave={saveScreenTimeLog}
            saving={screenTimeSaving}
            isRemote={isRemote}
          />
        );
      }
      if (path === '/settings') {
        return (
          <SettingsPage
            navigate={navigate}
            profile={profile}
            setProfile={setProfile}
            settings={settings}
            setSettings={setSettings}
            isRemote={isRemote}
            onSaveProfile={saveProfile}
            onSavePrivacy={savePrivacy}
            onLogout={logout}
          />
        );
      }
      return (
        <Dashboard
          navigate={navigate}
          profile={profile}
          session={session}
          now={now}
          stats={activeStats}
          friends={activeFriends}
          invites={activeInvites}
          loading={dataLoading}
          isRemote={isRemote}
        />
      );
    })();

    return (
      <AppShell navigate={navigate} path={path} session={session}>
        {shellPage}
      </AppShell>
    );
  })();

  return (
    <>
      {content}
      {backendError ? (
        <div className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+12px)] z-50 mx-auto max-w-md rounded-lg bg-[#FFF1F0] px-4 py-3 text-sm font-semibold text-[#B42318] shadow-lift">
          {backendError}
        </div>
      ) : null}
      {inviteModal ? (
        <InviteModal
          friend={inviteModal.friend}
          place={inviteModal.place}
          friends={activeFriends}
          places={activePlaces}
          onClose={() => setInviteModal(null)}
          onSend={sendInvite}
          sending={inviteSending}
        />
      ) : null}
      {inviteToast ? (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-50 mx-auto max-w-md rounded-lg bg-deep px-4 py-3 text-center text-sm font-semibold text-white shadow-lift">
          Invite sent. You just turned screen time into real time.
        </div>
      ) : null}
    </>
  );
}
