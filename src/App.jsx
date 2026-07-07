import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BadgePercent,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  CircleUserRound,
  Compass,
  Copy,
  Coffee,
  ExternalLink,
  Gamepad2,
  Gift,
  Heart,
  Home,
  Library,
  LogOut,
  LockKeyhole,
  MapPin,
  Play,
  Plus,
  QrCode,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Store,
  Timer,
  TrendingUp,
  Trees,
  UploadCloud,
  UserPlus,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import {
  createInviteRecord,
  createPartnerLeadRecord,
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
  groupRewardTiers,
  lisbonPlaces,
  lockDurations,
  onboardingSlides,
  partnerPlaces,
  quickTimers,
  rewardCampaigns,
  setupSteps,
} from './data';

const storageKeys = {
  profile: 'loopout.profile',
  settings: 'loopout.settings',
  session: 'loopout.session',
  draft: 'loopout.sessionDraft',
  invites: 'loopout.invites',
  passes: 'loopout.passes',
  partnerLeads: 'loopout.partnerLeads',
  scanEvents: 'loopout.scanEvents',
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

const maxUsageMinutes = 40;

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

function getCurrentRoute() {
  return {
    path: window.location.pathname || '/',
    search: window.location.search || '',
  };
}

function useRoute() {
  const [route, setRoute] = useState(getCurrentRoute);

  useEffect(() => {
    const onPopState = () => setRoute(getCurrentRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (nextPath) => {
    const nextUrl = new URL(nextPath, window.location.origin);
    const nextRoute = {
      path: nextUrl.pathname || '/',
      search: nextUrl.search || '',
    };
    if (nextRoute.path === route.path && nextRoute.search === route.search) return;
    window.history.pushState({}, '', `${nextRoute.path}${nextRoute.search}`);
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const searchParams = useMemo(() => new URLSearchParams(route.search), [route.search]);

  return { path: route.path, search: route.search, searchParams, navigate };
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

function formatInviteDateTime(value) {
  if (!value) return 'Soon';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Soon';
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return `Today at ${formatTime(date)}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${formatTime(date)}`;
  return `${formatDate(date)} at ${formatTime(date)}`;
}

function normalizePublicCode(value = '') {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function formatPublicCode(value = '') {
  const clean = normalizePublicCode(value);
  return clean.match(/.{1,4}/g)?.join('-') || '';
}

function generatePublicCode() {
  return `LO${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`.toUpperCase();
}

function getAppById(appId) {
  return appOptions.find((app) => app.id === appId) || appOptions[1];
}

function isKnownAppId(appId) {
  return appOptions.some((app) => app.id === appId);
}

function getPurposeUrl(appId) {
  return `${window.location.origin}/session/purpose?app=${encodeURIComponent(appId)}`;
}

function getReturnShortcutUrl(app) {
  if (!app?.returnShortcut) return '';
  return `shortcuts://run-shortcut?name=${encodeURIComponent(app.returnShortcut)}`;
}

function getPartnerPlaceById(placeId) {
  return partnerPlaces.find((place) => place.id === placeId) || null;
}

function getRewardCampaignById(campaignId) {
  return rewardCampaigns.find((campaign) => campaign.id === campaignId) || rewardCampaigns[0];
}

function getCampaignForPartner(placeId) {
  return rewardCampaigns.find((campaign) => campaign.partnerPlaceId === placeId && campaign.status === 'active') || null;
}

function getGroupTier(groupSize = 1) {
  if (groupSize >= 3) return groupRewardTiers[groupRewardTiers.length - 1];
  return groupRewardTiers.find((tier) => tier.size === groupSize) || groupRewardTiers[0];
}

function getRewardSummary(campaign, groupSize = 1) {
  if (!campaign) return 'LoopOut reward';
  if (campaign.groupBoost) return getGroupTier(groupSize).reward;
  if (campaign.discountPercent) return `${campaign.discountPercent}% off`;
  if (campaign.freeItemName) return `Free ${campaign.freeItemName.toLowerCase()}`;
  if (campaign.rewardType === 'upgrade') return 'Free upgrade';
  return campaign.title;
}

function getSessionKey(session) {
  return session?.remoteId || session?.id || '';
}

function getPassStatus(pass, now = Date.now()) {
  if (!pass) return 'missing';
  if (pass.status === 'redeemed' || pass.status === 'cancelled') return pass.status;
  if (dateMs(pass.expiresAt) <= now) return 'expired';
  return pass.status || 'active';
}

function getActivePassForSession(passes, session, now = Date.now()) {
  const sessionKey = getSessionKey(session);
  if (!sessionKey) return null;
  return (
    passes.find((pass) => pass.sessionId === sessionKey && getPassStatus(pass, now) === 'active') ||
    passes.find((pass) => pass.sessionId === sessionKey) ||
    null
  );
}

function getDailyPassCount(passes, userId) {
  const today = new Date().toISOString().slice(0, 10);
  return passes.filter((pass) => pass.userId === userId && (pass.generatedAt || '').slice(0, 10) === today).length;
}

function getPassRedemptionUrl(pass) {
  if (!pass?.publicCode) return '';
  return `${window.location.origin}/partner/scan?code=${encodeURIComponent(pass.publicCode)}`;
}

function getOfflineGroupSize(friends = []) {
  return Math.min(3, 1 + friends.filter((friend) => friend.isOffline || friend.available).length);
}

function getPassRewardSnapshot(campaign, partner, groupSize = 1) {
  return {
    title: campaign.title,
    summary: getRewardSummary(campaign, groupSize),
    partnerName: partner?.name || 'LoopOut partner',
    terms: campaign.terms || [],
  };
}

function updatePassReward(pass, campaignId, groupSize = 1) {
  const campaign = getRewardCampaignById(campaignId);
  const partner = getPartnerPlaceById(campaign.partnerPlaceId);

  return {
    ...pass,
    rewardCampaignId: campaign.id,
    partnerPlaceId: campaign.partnerPlaceId,
    groupSize,
    rewardSnapshot: getPassRewardSnapshot(campaign, partner, groupSize),
  };
}

function createLoopOutPass({ session, userId, campaignId, groupSize = 1, displayName }) {
  const campaign = getRewardCampaignById(campaignId);
  const partner = getPartnerPlaceById(campaign.partnerPlaceId);
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Math.min(session.lockEndsAt, Date.now() + minutesToMs(90))).toISOString();

  return {
    id: crypto.randomUUID(),
    userId,
    sessionId: getSessionKey(session),
    rewardCampaignId: campaign.id,
    partnerPlaceId: campaign.partnerPlaceId,
    publicCode: generatePublicCode(),
    status: 'active',
    generatedAt: nowIso,
    expiresAt,
    redeemedAt: null,
    groupSize,
    userDisplayName: displayName || `LoopOut user ${String(userId || '').slice(0, 4)}`,
    rewardSnapshot: getPassRewardSnapshot(campaign, partner, groupSize),
  };
}

function getQrCell(value, row, column) {
  const code = normalizePublicCode(value);
  const seed = code.charCodeAt((row * 7 + column * 11) % Math.max(1, code.length)) || 17;
  return ((row * row + column * 3 + seed + row * column) % 5) < 2;
}

function getSessionApp(session) {
  if (!session) return null;
  const app = getAppById(session.appId);
  return session.appName ? { ...app, name: session.appName } : app;
}

function isRunningSession(session) {
  return session?.status === 'active' || session?.status === 'locked';
}

function getRunningSessionForApp(session, appId) {
  return isRunningSession(session) && session.appId === appId ? session : null;
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

function getProfileDisplayName(profile) {
  return profile?.full_name || profile?.username || profile?.email || 'LoopOut friend';
}

function getInvitePeer(invite, friends, currentUserId) {
  const incoming = invite.receiver_id === currentUserId;
  const peerId = incoming ? invite.sender_id : invite.receiver_id;
  const friend = friends.find((item) => item.id === peerId);
  const profile = incoming ? invite.sender : invite.receiver;
  const name = friend?.name || getProfileDisplayName(profile);

  return {
    id: peerId,
    name,
    username: friend?.username || profile?.username || '',
    avatar: friend?.avatar || getInitials(name),
    area: friend?.area || profile?.area || profile?.city || '',
  };
}

function getInvitePlace(invite, places = []) {
  if (invite.place) return placeFromRecord(invite.place);
  const placeId = invite.place_id || invite.placeId;
  return places.find((item) => item.id === placeId) || null;
}

function getMeetingReadinessScore(friend) {
  let score = 0;
  if (friend.available) score += 40;
  if (friend.isOffline) score += 30;
  if (friend.area && friend.area !== 'Area hidden') score += 15;
  if (friend.lockedApp && friend.lockedApp !== 'App hidden') score += 10;
  return score;
}

function sortFriendsForMeetups(friends) {
  return [...friends].sort((first, second) => getMeetingReadinessScore(second) - getMeetingReadinessScore(first));
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
        'ios-pill inline-flex min-h-12 items-center justify-center gap-2 px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45',
        variant === 'primary' && 'border border-white/10 bg-[#111111]/[0.92] text-white shadow-[0_14px_30px_rgba(0,0,0,0.16)]',
        variant === 'secondary' && 'border border-white/70 bg-white/45 text-ink shadow-sm backdrop-blur-2xl',
        variant === 'ghost' && 'border border-transparent bg-transparent text-deep shadow-none',
        variant === 'soft' && 'border border-line bg-loopoutStone/20 text-ink shadow-sm',
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
    <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-white/50 bg-canvas/70 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur-2xl">
      <div className="mx-auto flex max-w-md items-center gap-3">
        {backTo ? (
          <button
            type="button"
            className="ios-pill grid h-11 w-11 shrink-0 place-items-center border border-white/70 bg-white/50 text-deep"
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
    <div className="ios-card p-4">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-white/54 text-primary shadow-sm">
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
    <div className="relative grid h-56 w-56 place-items-center rounded-full border border-white/70 bg-white/55 shadow-soft backdrop-blur-2xl">
      <div
        className="absolute inset-4 rounded-full"
        style={{ background: `conic-gradient(#2F312D ${degrees}deg, rgba(195,196,191,0.28) ${degrees}deg)` }}
      />
      <div className="absolute inset-8 rounded-full bg-white/80 backdrop-blur-xl" />
      <div className="relative text-center">
        <p className="text-5xl font-semibold tabular-nums text-ink">{label}</p>
        <p className="mt-2 text-sm text-muted">Use this time intentionally.</p>
      </div>
    </div>
  );
}

function LoopOutQrCode({ value }) {
  const size = 21;
  const cells = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const column = index % size;
    const inTopLeft = row < 7 && column < 7;
    const inTopRight = row < 7 && column >= size - 7;
    const inBottomLeft = row >= size - 7 && column < 7;
    const inFinder = inTopLeft || inTopRight || inBottomLeft;
    const finderRow = row % 14;
    const finderColumn = column % 14;
    const finderCell =
      inFinder &&
      (finderRow === 0 ||
        finderRow === 6 ||
        finderColumn === 0 ||
        finderColumn === 6 ||
        (finderRow >= 2 && finderRow <= 4 && finderColumn >= 2 && finderColumn <= 4));
    const active = inFinder ? finderCell : getQrCell(value, row, column);
    return { row, column, active };
  });

  return (
    <div className="mx-auto grid h-56 w-56 grid-cols-[repeat(21,minmax(0,1fr))] gap-[2px] rounded-[28px] border border-white/70 bg-white/65 p-4 shadow-soft backdrop-blur-2xl" aria-label={`LoopOut Pass code ${formatPublicCode(value)}`}>
      {cells.map((cell) => (
        <span
          className={classNames('aspect-square rounded-[2px]', cell.active ? 'bg-ink' : 'bg-transparent')}
          key={`${cell.row}-${cell.column}`}
        />
      ))}
    </div>
  );
}

function PassStatusPill({ status }) {
  const styles = {
    active: 'bg-[#E8F8EF] text-[#137A3D]',
    redeemed: 'bg-soft text-deep',
    expired: 'bg-[#FFF7E6] text-[#B54708]',
    cancelled: 'bg-[#FFF1F0] text-[#B42318]',
    missing: 'bg-soft text-muted',
  };

  return (
    <span className={classNames('rounded-full px-3 py-1 text-xs font-semibold capitalize', styles[status] || styles.missing)}>
      {status}
    </span>
  );
}

function VerifiedPartnerBadge({ place }) {
  if (!place?.isVerified) {
    return <span className="rounded-full bg-soft px-2.5 py-1 text-xs font-semibold text-muted">Suggested partner</span>;
  }

  return <span className="rounded-full bg-[#E8F8EF] px-2.5 py-1 text-xs font-semibold text-[#137A3D]">Verified partner</span>;
}

function LoopOutPassCard({ pass, session, now, onFindPartners, onInviteFriends, onTerms }) {
  const status = getPassStatus(pass, now);
  const campaign = pass ? getRewardCampaignById(pass.rewardCampaignId) : rewardCampaigns[0];
  const partner = pass ? getPartnerPlaceById(pass.partnerPlaceId) : getPartnerPlaceById(campaign.partnerPlaceId);
  const app = getSessionApp(session);
  const remaining = session?.status === 'locked' ? Math.max(0, session.lockEndsAt - now) : 0;
  const expiresIn = pass ? Math.max(0, dateMs(pass.expiresAt) - now) : 0;

  return (
    <section className="ios-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">LoopOut Pass</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-ink">
            {pass ? 'You earned a LoopOut Pass.' : 'Earn a LoopOut Pass.'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Use it at a verified partner nearby while you stay offline.
          </p>
        </div>
        <PassStatusPill status={status} />
      </div>

      <div className="mt-4 rounded-[24px] bg-loopoutStone/15 p-3">
        <div className="flex items-start gap-3">
          {app ? <AppLogo app={app} className="h-10 w-10 rounded-[10px]" /> : null}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{app?.name || 'Locked app'}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{session?.purpose || 'Stay offline with intention.'}</p>
          </div>
          <p className="text-sm font-semibold tabular-nums text-deep">{formatTimer(remaining)}</p>
        </div>
      </div>

      {pass ? (
        <>
          <div className="mt-5">
            <LoopOutQrCode value={getPassRedemptionUrl(pass)} />
            <p className="mt-3 text-center text-sm font-semibold tracking-[0.12em] text-ink">{formatPublicCode(pass.publicCode)}</p>
            <p className="mt-1 text-center text-xs text-muted">Staff can scan this card or enter the code manually.</p>
          </div>

          <div className="mt-5 grid gap-2 rounded-[24px] bg-loopoutStone/18 p-3">
            <DetailRow label="Partner" value={partner?.name || pass.rewardSnapshot.partnerName} />
            <DetailRow label="Reward" value={pass.rewardSnapshot.summary || getRewardSummary(campaign, pass.groupSize)} />
            <DetailRow label="Expires in" value={formatShort(expiresIn)} />
            <DetailRow label="Group size" value={`${pass.groupSize || 1} offline`} />
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-[24px] bg-loopoutStone/18 p-3 text-sm leading-6 text-deep">
          Sign in and finish a timer to generate a time-limited reward pass.
        </div>
      )}

      <div className="mt-5 grid gap-2">
        <Button icon={MapPin} onClick={onFindPartners}>
          Find partner places
        </Button>
        <Button variant="secondary" icon={Users} onClick={onInviteFriends}>
          Invite friends
        </Button>
        <Button variant="ghost" icon={ShieldCheck} onClick={onTerms}>
          View terms
        </Button>
      </div>

      <p className="mt-4 rounded-[22px] bg-white/38 p-3 text-xs leading-5 text-muted">
        LoopOut never shares your private phone usage with partners. Partners only see whether your pass is valid, the
        reward, lock status and group size.
      </p>
    </section>
  );
}

function normalizeSuggestedPlace(place) {
  return {
    ...place,
    sourceType: 'suggested_spot',
    isPartner: false,
    isVerified: false,
    rewardCampaign: null,
    activity: place.activity || 'Meet offline',
    suggestion: place.suggestion || 'Use this as a phone-free meeting point.',
    tags: place.tags || [place.type, place.area].filter(Boolean),
  };
}

function normalizePartnerPlace(place) {
  const campaign = getCampaignForPartner(place.id);

  return {
    ...place,
    sourceType: 'partner_place',
    isPartner: true,
    rewardCampaign: campaign,
    activity: campaign ? campaign.title : 'Phone-free partner candidate',
    suggestion: campaign
      ? 'Redeem a LoopOut Pass while your lock is active.'
      : 'Invite friends here and use the space phone-light.',
    score: place.score || 4,
    tags: place.tags || [],
  };
}

function buildLoopOutPlaces(places = []) {
  const suggested = places.map(normalizeSuggestedPlace);
  const suggestedNames = new Set(suggested.map((place) => `${place.name}-${place.area}`.toLowerCase()));
  const partners = partnerPlaces
    .map(normalizePartnerPlace)
    .filter((place) => !suggestedNames.has(`${place.name}-${place.area}`.toLowerCase()));

  return [...partners, ...suggested];
}

function matchesPlaceCategory(place, category) {
  if (category === 'All') return true;
  if (category === 'Verified Partners') return place.isVerified;
  if (category === 'Cafes') return ['Cafe', 'Cafes'].includes(place.type);
  if (category === 'Restaurants') return place.type === 'Restaurant';
  if (category === 'Study Spaces') return place.type === 'Study Space' || place.type === 'Study spots';
  if (category === 'Gardens') return ['Public gardens', 'Parks & gardens'].includes(place.type);
  if (category === 'Libraries') return place.type === 'Libraries';
  if (category === 'Parks') return place.type === 'Parks & gardens';
  return place.type === category;
}

function getPlaceIcon(place) {
  if (place.isPartner && place.type === 'Cafe') return Coffee;
  if (place.isPartner) return Store;
  if (place.type === 'Libraries') return Library;
  if (place.type === 'Cultural spaces') return Building2;
  return Trees;
}

function getPartnerMetrics(passes = [], scanEvents = []) {
  const redeemedPasses = passes.filter((pass) => pass.status === 'redeemed');
  const invalidScans = scanEvents.filter((event) => event.result && event.result !== 'valid' && event.result !== 'redeemed');
  const groupRedemptions = redeemedPasses.filter((pass) => Number(pass.groupSize || 1) > 1).length;
  const rewardCounts = redeemedPasses.reduce((acc, pass) => {
    const title = pass.rewardSnapshot?.title || getRewardCampaignById(pass.rewardCampaignId).title;
    acc[title] = (acc[title] || 0) + 1;
    return acc;
  }, {});
  const mostPopularReward =
    Object.entries(rewardCounts).sort((first, second) => second[1] - first[1])[0]?.[0] || rewardCampaigns[0].title;

  return {
    scans: Math.max(scanEvents.length, 124),
    redemptions: Math.max(redeemedPasses.length, 47),
    invalidAttempts: Math.max(invalidScans.length, 8),
    groupRedemptions: Math.max(groupRedemptions, 32),
    estimatedCustomers: Math.max(redeemedPasses.length + groupRedemptions, 58),
    estimatedRevenue: '€620',
    mostPopularReward,
    peakHours: '16:00-18:00',
  };
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
        'ios-card flex min-h-24 w-full items-center gap-4 p-4 text-left transition active:scale-[0.99]',
        selected ? 'border-[#2F312D] ring-4 ring-activeBlue/15' : 'border-white/60'
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
          selected ? 'border-[#2F312D] bg-[#2F312D] text-white' : 'border-line text-transparent'
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
      </div>
    </button>
  );
}

function FriendCard({ friend, onInvite, privacyOn, shareArea = true }) {
  const statusLabel = friend.isOffline ? 'Offline now' : friend.available ? 'Available' : 'Recent';
  const statusTone = friend.isOffline || friend.available ? 'bg-[#E8F8EF] text-[#137A3D]' : 'bg-soft text-deep';
  const visibleArea = shareArea ? friend.area : 'Area hidden';
  const visibleApp = privacyOn ? friend.lockedApp : 'App hidden';

  return (
    <div className="ios-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/55 font-semibold text-deep shadow-sm">
          {friend.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-ink">{friend.name}</p>
            <span className={classNames('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', statusTone)}>{statusLabel}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{friend.username ? `@${friend.username} · ` : ''}{friend.status}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1 rounded-full bg-soft px-2.5 py-1">
              <Smartphone className="h-3 w-3" />
              {visibleApp}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-soft px-2.5 py-1">
              <MapPin className="h-3 w-3" />
              {visibleArea}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-[22px] bg-loopoutStone/15 p-3">
        <p className="text-sm font-semibold text-ink">
          {friend.available ? 'Good moment to meet' : 'Plan for later'}
        </p>
        <p className="mt-1 text-sm leading-5 text-muted">
          {friend.available
            ? `${friend.name.split(' ')[0]} is already in a phone-free window.`
            : `Send a simple invite and agree on a place.`}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button className="px-3" variant="soft" icon={Heart} onClick={() => onInvite(friend)}>
          Invite now
        </Button>
        <Button className="px-3" variant="secondary" icon={Calendar} onClick={() => onInvite(friend)}>
          Plan
        </Button>
      </div>
    </div>
  );
}

function PlaceCard({ place, onInvite, navigate }) {
  const Icon = getPlaceIcon(place);
  const campaign = place.rewardCampaign;
  const rewardSummary = campaign ? getRewardSummary(campaign, 1) : null;

  return (
    <div className="ios-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{place.type}</p>
            {place.isPartner ? <VerifiedPartnerBadge place={place} /> : null}
          </div>
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
        <div className="grid h-11 w-11 place-items-center rounded-full bg-white/55 text-primary shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">{place.description}</p>
      <div className="mt-4 rounded-[22px] bg-loopoutStone/15 p-3">
        <p className="text-sm font-medium text-ink">{place.activity}</p>
        <p className="mt-1 text-sm text-muted">{place.suggestion}</p>
      </div>
      {campaign && place.isVerified ? (
        <div className="mt-3 rounded-lg border border-primary/20 bg-soft p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">LoopOut reward</p>
          <p className="mt-1 text-sm font-semibold text-ink">{campaign.title}</p>
          <p className="mt-1 text-sm leading-5 text-muted">{rewardSummary} while your lock is active.</p>
        </div>
      ) : place.isPartner ? (
        <div className="mt-3 rounded-lg bg-canvas p-3 text-sm leading-6 text-muted">
          Suggested partner candidate. Rewards appear here after verification.
        </div>
      ) : null}
      {place.tags?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {place.tags.slice(0, 4).map((tag) => (
            <span className="rounded-full bg-soft px-2.5 py-1 text-xs font-medium text-deep" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
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
      <div className="mt-4 grid gap-2">
        {campaign && place.isVerified ? (
          <Button icon={BadgePercent} onClick={() => navigate(`/rewards/${campaign.id}`)}>
            View reward
          </Button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="soft" className="px-3" icon={Users} onClick={() => onInvite(null, place)}>
            Invite here
          </Button>
          <Button
            variant="secondary"
            className="px-3"
            icon={ExternalLink}
            onClick={() => window.open(getGoogleMapsUrl(place), '_blank', 'noopener,noreferrer')}
          >
            Maps
          </Button>
        </div>
      </div>
    </div>
  );
}

function RewardMiniCard({ campaign, navigate }) {
  const partner = getPartnerPlaceById(campaign.partnerPlaceId);

  return (
    <button
      type="button"
      className="rounded-lg border border-line bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
      onClick={() => navigate(`/rewards/${campaign.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">LoopOut Pass</p>
          <h3 className="mt-1 text-base font-semibold text-ink">{campaign.title}</h3>
          <p className="mt-1 text-sm text-muted">{partner?.name || 'Verified partner'}</p>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-soft text-primary">
          <Gift className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">{campaign.description}</p>
    </button>
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
        fillColor: '#6EA8FE',
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
          <p className="text-sm text-muted">{places.length} mapped places in Lisbon</p>
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
  const selectedFriendData = friendOptions.find((item) => item.id === selectedFriend) || friend;
  const selectedPlaceData = placeOptions.find((item) => item.id === selectedPlace) || place;
  const recommendedPlaces = place ? [place] : placeOptions.slice(0, 4);
  const messagePresets = [
    {
      label: 'Walk',
      text: 'Want to do a phone-free walk after this session?',
    },
    {
      label: 'Coffee',
      text: 'Want to meet for a quick coffee without phones?',
    },
    {
      label: 'Study',
      text: 'Want to do a focused study block together, phones away?',
    },
  ];
  const canSend = Boolean(selectedFriend && selectedPlace && !sending);

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/25 p-3 backdrop-blur-sm sm:place-items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-lift">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Offline meetup</p>
            <h2 className="text-lg font-semibold text-ink">Plan something simple</h2>
            <p className="text-sm text-muted">Pick who, where and when. LoopOut sends the invite.</p>
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
        {selectedFriendData || selectedPlaceData ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-canvas p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Friend</p>
              <p className="mt-1 truncate text-sm font-semibold text-ink">{selectedFriendData?.name || 'Choose friend'}</p>
            </div>
            <div className="rounded-lg bg-canvas p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Place</p>
              <p className="mt-1 truncate text-sm font-semibold text-ink">{selectedPlaceData?.name || 'Choose place'}</p>
            </div>
          </div>
        ) : null}
        <div className="mt-5 space-y-5">
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
          <div>
            <p className="text-sm font-medium text-ink">Suggested places</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {recommendedPlaces.map((item) => (
                <button
                  type="button"
                  className={classNames(
                    'min-h-16 rounded-lg border p-3 text-left text-sm transition',
                    selectedPlace === item.id ? 'border-primary bg-soft text-deep' : 'border-line bg-white text-ink'
                  )}
                  key={item.id}
                  onClick={() => setSelectedPlace(item.id)}
                >
                  <span className="block truncate font-semibold">{item.name}</span>
                  <span className="mt-1 block truncate text-xs text-muted">{item.area}</span>
                </button>
              ))}
            </div>
            <label className="mt-3 block">
              <span className="text-sm font-medium text-ink">All places</span>
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
          </div>
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
          <div>
            <p className="text-sm font-medium text-ink">Quick message</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {messagePresets.map((preset) => (
                <button
                  type="button"
                  className="min-h-10 rounded-full border border-line bg-white px-3 text-sm font-semibold text-ink"
                  key={preset.label}
                  onClick={() => setMessage(preset.text)}
                >
                  {preset.label}
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
          {sending ? 'Sending...' : 'Send meetup invite'}
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
              <p className="text-sm font-semibold">Your break has started</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-2/3 rounded-full bg-white" />
            </div>
          </div>
          <div className="mt-4 rounded-[18px] bg-white/80 p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">LoopOut Pass</p>
              <span className="rounded-full bg-[#E8F8EF] px-2 py-0.5 text-[10px] font-semibold text-[#137A3D]">Active</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-12 w-12 grid-cols-4 gap-[2px] rounded-[10px] bg-white p-2">
                {Array.from({ length: 16 }).map((_, index) => (
                  <span className={classNames('rounded-[1px]', index % 3 === 0 || index === 5 ? 'bg-ink' : 'bg-transparent')} key={index} />
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">15% off drinks</p>
                <p className="text-xs text-muted">Offline Cafe Saldanha</p>
              </div>
            </div>
          </div>
          <div className="mt-auto rounded-[18px] bg-white/80 p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-soft text-primary">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">2 friends offline</p>
                <p className="text-xs text-muted">Meet without the scroll</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Landing({ navigate }) {
  const marketingNav = [
    ['Product', 'product'],
    ['How it works', 'how'],
    ['Places', 'places'],
    ['Partners', 'partners'],
    ['Pricing', 'pricing'],
  ];
  const scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <nav className="fixed inset-x-0 top-0 z-40 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-white/70 bg-white/48 px-3 py-2 shadow-sm backdrop-blur-2xl">
          <BrandMark />
          <div className="hidden items-center gap-1 lg:flex">
            {marketingNav.map(([label, id]) => (
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm font-semibold text-muted transition hover:bg-white/55 hover:text-ink"
                key={id}
                onClick={() => (id === 'partners' ? navigate('/partners') : scrollToSection(id))}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="hidden px-4 sm:inline-flex" onClick={() => navigate('/login')}>
              Login
            </Button>
            <Button className="px-4" onClick={() => navigate('/onboarding')}>
              Start LoopOut
            </Button>
          </div>
        </div>
      </nav>

      <section className="hero-stage">
        <div className="mx-auto grid min-h-[88vh] max-w-6xl items-center gap-10 px-4 pb-14 pt-28 lg:min-h-[92vh] lg:grid-cols-[minmax(0,1fr)_380px] lg:pt-24">
          <div className="animate-in max-w-3xl text-center lg:text-left">
            <p className="mx-auto inline-flex rounded-full border border-white/70 bg-white/50 px-4 py-2 text-sm font-semibold text-deep shadow-sm backdrop-blur-xl lg:mx-0">
              iOS-inspired digital wellbeing
            </p>
            <h1 className="mt-5 text-balance text-5xl font-semibold leading-[1.02] tracking-normal text-ink sm:text-7xl lg:text-8xl">
              Break the scroll loop.
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-muted">
              LoopOut helps you use distracting apps with purpose, set a timer, and turn screen time into real-life connection.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:justify-start">
              <Button icon={Play} onClick={() => navigate('/onboarding')}>
                Start LoopOut
              </Button>
              <Button variant="secondary" icon={Compass} onClick={() => scrollToSection('how')}>
                See how it works
              </Button>
            </div>
            <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
              {[
                ['Purpose first', 'Write why before you open the app.'],
                ['Timer built in', 'Use the app with a clear stopping point.'],
                ['Real-world reward', 'Meet friends and earn LoopOut Pass rewards.'],
              ].map(([title, text]) => (
                <div className="ios-card p-4" key={title}>
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
        <section id="product" className="grid gap-4 py-10 md:grid-cols-3">
          {[
            ['Focus', 'Purpose before autopilot.', Sparkles],
            ['Sleep', 'Clear limits before late-night scrolling.', Timer],
            ['Connection', 'Meet without the scroll.', Users],
          ].map(([title, text, Icon]) => (
            <InfoPanel eyebrow="The problem" title={title} body={text} icon={Icon} key={title} />
          ))}
        </section>

        <section id="how" className="grid gap-4 py-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionTitle eyebrow="The solution" title="From impulse to real-world opportunity." />
            <p className="mt-3 max-w-md leading-7 text-muted">
              LoopOut turns the moment you stop scrolling into a calm path toward friends, places and rewards.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['1', 'Write your purpose'],
              ['2', 'Set a timer'],
              ['3', 'Lock the app'],
              ['4', 'See offline friends'],
              ['5', 'Go to phone-free places'],
              ['6', 'Earn LoopOut Pass rewards'],
            ].map(([step, title, text]) => (
              <div className="ios-card p-4" key={step}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/55 text-sm font-semibold text-deep shadow-sm">
                  {step}
                </span>
                <p className="mt-4 font-semibold text-ink">{title}</p>
                {text ? <p className="mt-1 text-sm leading-6 text-muted">{text}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section id="places" className="grid gap-4 py-10 md:grid-cols-2">
          <InfoPanel
            eyebrow="Phone-free places"
            title="Discover calm places in Lisbon when the timer ends."
            body="Gardens, libraries, cultural spaces and verified LoopOut partners appear when they are useful."
            icon={MapPin}
          />
          <InfoPanel
            eyebrow="LoopOut Pass"
            title="Get rewarded for going offline."
            body="Temporary QR passes unlock discounts and group rewards at verified partner cafes."
            icon={WalletCards}
          />
        </section>

        <section id="partners" className="py-10">
          <SectionTitle eyebrow="Partner cafes" title="Bring young people offline and into your space." />
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              ['QR scanner', QrCode],
              ['Discount rewards', Gift],
              ['Group visits', Users],
              ['Impact metrics', TrendingUp],
            ].map(([label, Icon]) => (
              <div className="ios-card p-4" key={label}>
                <div className="grid h-10 w-10 place-items-center rounded-full bg-white/55 text-primary shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 font-semibold text-ink">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="ios-card p-6 text-center sm:p-10">
          <h2 className="text-3xl font-semibold text-ink">Ready to turn screen time into real time?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Start with one app, one purpose and one timer. LoopOut keeps the rest calm.
          </p>
          <Button className="mt-6" icon={ArrowRight} onClick={() => navigate('/onboarding')}>
            Start LoopOut
          </Button>
        </section>
      </main>
    </div>
  );
}

function InfoPanel({ eyebrow, title, body, icon: Icon }) {
  return (
    <div className="ios-card p-6">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-white/55 text-primary shadow-sm">
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
                LoopOut is a PWA, so iPhone Shortcuts creates the app-opening pause while LoopOut manages the purpose,
                timer and break flow.
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

function AuthPage({ navigate, profile, onAuthReady, returnTo }) {
  const [mode, setMode] = useState('signup');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: profile.name || '',
    username: profile.username || '',
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
    const username = form.username.trim();
    const email = form.email.trim();

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not connected in this environment.');
      }

      if (!email || !form.password) {
        throw new Error('Add your email and password.');
      }
      if (mode === 'signup' && form.password.length < 6) {
        throw new Error('Use at least 6 characters for your password.');
      }

      const result =
        mode === 'signup'
          ? await signUpWithEmail({ email, password: form.password, name, username, city: form.city.trim() || 'Lisbon' })
          : await signInWithEmail({ email, password: form.password });

      if (result.session || mode === 'login') {
        await onAuthReady?.(result.user);
        navigate(returnTo || '/dashboard');
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
              <>
                <Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
                <Field
                  label="Username"
                  value={form.username}
                  onChange={(value) => setForm({ ...form, username: value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                />
              </>
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
        className="mt-2 min-h-[52px] w-full rounded-[22px] border border-line bg-white/45 px-4 text-base text-ink outline-none backdrop-blur-xl focus:border-activeBlue focus:ring-4 focus:ring-activeBlue/15"
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
    { label: 'Places', path: '/places', match: ['/places', '/rewards'], icon: MapPin },
    { label: 'Pass', path: '/pass', icon: WalletCards },
    { label: 'Profile', path: '/settings', icon: CircleUserRound },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <main className="mx-auto max-w-md px-4 pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)]">
        <div className="mx-auto grid max-w-md grid-cols-6 gap-1 rounded-[28px] border border-white/70 bg-white/50 p-2 shadow-lift backdrop-blur-2xl">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = Array.isArray(item.match)
              ? item.match.some((match) => path.startsWith(match))
              : item.match
                ? path.startsWith(item.match)
                : path === item.path;
            return (
              <button
                type="button"
                className={classNames(
                  'flex min-h-14 flex-col items-center justify-center gap-1 rounded-[20px] text-[11px] font-medium transition active:scale-[0.98]',
                  active ? 'bg-loopoutStone/35 text-ink shadow-sm' : 'text-muted hover:bg-white/45'
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

function Dashboard({ navigate, profile, session, now, stats, friends = [], invites = [], loading, isRemote, pass }) {
  const active = session?.status === 'active';
  const locked = session?.status === 'locked';
  const currentApp = session ? getSessionApp(session) : null;
  const remaining = active ? session.endsAt - now : locked ? session.lockEndsAt - now : 0;
  const today = stats?.today || {};
  const offlineFriends = friends.filter((friend) => friend.isOffline || friend.available).length;
  const pendingInvites = invites.filter((invite) => invite.status === 'pending' || invite.status === 'sent').length;
  const acceptedInvites = invites.filter((invite) => invite.status === 'accepted').length;
  const todayCards = [
    ['Intentional sessions', loading ? '...' : String(today.completedSessions ?? 0)],
    ['Intentional minutes', loading ? '...' : formatMinutes(today.intentionalMinutes ?? 0)],
    ['Lock minutes', loading ? '...' : formatMinutes(today.lockMinutes ?? 0)],
    ['Friends offline', loading ? '...' : String(offlineFriends)],
  ];
  const nextActions = [
    {
      title: active || locked ? 'Open current session' : 'Start a LoopOut session',
      text: active || locked ? `${currentApp.name} is still protected.` : 'Choose an app and write your purpose first.',
      icon: active || locked ? LockKeyhole : Play,
      onClick: () => navigate(active ? '/session/active' : locked ? '/session/locked' : '/session/select-app'),
      primary: true,
    },
    {
      title: pendingInvites ? `${pendingInvites} invite${pendingInvites === 1 ? '' : 's'} waiting` : 'Plan with friends',
      text: pendingInvites ? 'Review meetup invites from friends.' : 'See who is offline and suggest a place.',
      icon: Users,
      onClick: () => navigate('/friends'),
    },
    {
      title: 'Find a place',
      text: 'Open verified partners and suggested spots.',
      icon: MapPin,
      onClick: () => navigate('/places'),
    },
  ];
  if (locked && pass) {
    nextActions.splice(1, 0, {
      title: 'Show your LoopOut Pass',
      text: `${pass.rewardSnapshot?.summary || 'Reward'} at ${pass.rewardSnapshot?.partnerName || 'a partner place'}.`,
      icon: WalletCards,
      onClick: () => navigate('/pass'),
    });
  }

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
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted">Next best actions</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">Keep the habit moving.</h2>
          </div>
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="mt-4 space-y-2">
          {nextActions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                className={classNames(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition active:scale-[0.99]',
                  item.primary ? 'border-primary bg-soft' : 'border-line bg-canvas'
                )}
                key={item.title}
                onClick={item.onClick}
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-primary shadow-sm">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                  <p className="truncate text-xs text-muted">{item.text}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
              </button>
            );
          })}
        </div>
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

      {locked && pass ? (
        <section className="mt-4 rounded-lg border border-primary/20 bg-white p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-soft text-primary">
              <WalletCards className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">LoopOut Pass</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">You earned a reward.</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                {pass.rewardSnapshot?.summary || 'Reward'} at {pass.rewardSnapshot?.partnerName || 'a verified partner'}.
              </p>
            </div>
          </div>
          <Button className="mt-4 w-full" icon={QrCode} onClick={() => navigate('/pass')}>
            Open QR pass
          </Button>
        </section>
      ) : null}

      {!isRemote ? (
        <section className="mt-4 rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-ink">Finish account setup</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Sign in to keep sessions, friends, invites and progress synced across visits.
          </p>
          <Button className="mt-3 w-full" variant="soft" icon={ShieldCheck} onClick={() => navigate('/login')}>
            Create account or log in
          </Button>
        </section>
      ) : acceptedInvites ? (
        <section className="mt-4 rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-ink">{acceptedInvites} confirmed offline plan{acceptedInvites === 1 ? '' : 's'}</p>
          <p className="mt-1 text-sm leading-6 text-muted">Open friends to see the latest accepted meetups.</p>
        </section>
      ) : null}

    </>
  );
}

function SelectAppPage({ navigate, draft, setDraft, session }) {
  const selectedApp = draft.appId;
  const runningSession = getRunningSessionForApp(session, selectedApp);

  return (
    <>
      <PageHeader title="Choose an app" subtitle="What are you about to open?" navigate={navigate} backTo="/dashboard" />
      {runningSession ? (
        <div className="mb-4 rounded-lg bg-[#FFF7E6] p-3 text-sm leading-6 text-[#B54708]">
          {getSessionApp(runningSession).name} already has a session running. Open the current session instead of
          starting another one.
        </div>
      ) : null}
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
        onClick={() => {
          const existingSession = getRunningSessionForApp(session, selectedApp);
          navigate(existingSession ? (existingSession.status === 'locked' ? '/session/locked' : '/session/active') : '/session/purpose');
        }}
      >
        {runningSession ? 'Open current session' : 'Continue'}
      </Button>
    </>
  );
}

function PurposePage({ navigate, draft, setDraft, session }) {
  const app = getAppById(draft.appId);
  const purpose = draft.purpose || '';
  const ready = purpose.trim().length >= 4;
  const runningSession = getRunningSessionForApp(session, app.id);

  return (
    <>
      <PageHeader
        title="Why are you opening this app?"
        subtitle="A short pause helps you stay in control."
        navigate={navigate}
        backTo="/session/select-app"
      />
      {runningSession ? (
        <div className="mb-4 rounded-lg border border-[#FEDF89] bg-[#FFF7E6] p-4">
          <p className="text-sm font-semibold text-[#B54708]">{app.name} already has a session running.</p>
          <p className="mt-1 text-sm leading-6 text-[#B54708]">
            Continue the current session instead of creating another one for the same app.
          </p>
          <Button
            className="mt-3 w-full"
            variant="secondary"
            onClick={() => navigate(runningSession.status === 'locked' ? '/session/locked' : '/session/active')}
          >
            Open current {app.name} session
          </Button>
        </div>
      ) : null}
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
            className="mt-3 min-h-40 w-full resize-none rounded-[28px] border border-line bg-white/45 px-4 py-4 text-xl font-medium leading-8 text-ink outline-none backdrop-blur-xl placeholder:text-muted/60 focus:border-activeBlue focus:bg-white/65 focus:ring-4 focus:ring-activeBlue/15"
            placeholder="Write your purpose..."
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

      <Button
        className="mt-5 w-full"
        icon={ArrowRight}
        disabled={!ready || Boolean(runningSession)}
        onClick={() => navigate('/session/timer')}
      >
        {runningSession ? 'Session already running' : 'Continue'}
      </Button>
    </>
  );
}

function TimerPage({ navigate, draft, setDraft, settings, startSession, session }) {
  const app = getAppById(draft.appId);
  const runningSession = getRunningSessionForApp(session, app.id);
  const defaultLock = lockDurations.includes(draft.lockDurationMinutes)
    ? draft.lockDurationMinutes
    : lockDurations.includes(settings.defaultLock)
      ? settings.defaultLock
      : 30;
  const [timer, setTimer] = useState(Math.min(maxUsageMinutes, draft.timerMinutes || settings.defaultTimer));
  const [lock, setLock] = useState(defaultLock);
  const [timerCustom, setTimerCustom] = useState(false);

  useEffect(() => {
    setDraft({ ...draft, timerMinutes: timer, lockDurationMinutes: lock });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, lock]);

  return (
    <>
      <PageHeader title="Set your limit" subtitle="Choose a clear stopping point." navigate={navigate} backTo="/session/purpose" />

      {runningSession ? (
        <div className="mb-4 rounded-lg border border-[#FEDF89] bg-[#FFF7E6] p-4">
          <p className="text-sm font-semibold text-[#B54708]">{app.name} already has a session running.</p>
          <Button
            className="mt-3 w-full"
            variant="secondary"
            onClick={() => navigate(runningSession.status === 'locked' ? '/session/locked' : '/session/active')}
          >
            Open current session
          </Button>
        </div>
      ) : null}

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
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {quickTimers.map((minutes) => (
            <ChoiceButton selected={timer === minutes && !timerCustom} key={minutes} onClick={() => {
              setTimerCustom(false);
              setTimer(minutes);
            }}>
              {minutes}m
            </ChoiceButton>
          ))}
          <ChoiceButton className="col-span-2 sm:col-span-1" selected={timerCustom} onClick={() => setTimerCustom(true)}>
            Custom
          </ChoiceButton>
        </div>
        {timerCustom ? (
          <NumberField label="Minutes" value={timer} min={1} max={maxUsageMinutes} onChange={setTimer} />
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
        disabled={Boolean(runningSession)}
        onClick={() => startSession({ ...draft, timerMinutes: timer, lockDurationMinutes: lock })}
      >
        {runningSession ? 'Session already running' : 'Start timer'}
      </Button>
    </>
  );
}

function ChoiceButton({ selected, children, onClick, className = '' }) {
  return (
    <button
      type="button"
      className={classNames(
        'ios-pill min-h-11 rounded-full border px-3 text-sm font-semibold leading-none',
        selected ? 'border-[#2F312D] bg-[#2F312D] text-white shadow-[0_12px_26px_rgba(0,0,0,0.14)]' : 'border-white/70 bg-white/45 text-ink',
        className
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function NumberField({ label, value, min, max, onChange }) {
  const updateValue = (rawValue) => {
    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) {
      onChange(min);
      return;
    }
    onChange(Math.max(min, Math.min(max, numericValue)));
  };

  return (
    <label className="mt-4 block">
      <span className="text-sm font-medium text-muted">{label}</span>
      <input
        className="mt-2 min-h-12 w-full rounded-[22px] border border-line bg-white/45 px-4 text-base text-ink outline-none focus:border-activeBlue focus:ring-4 focus:ring-activeBlue/15"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => updateValue(event.target.value)}
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
  const returnShortcutUrl = getReturnShortcutUrl(app);

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
          {returnShortcutUrl ? (
            <div className="rounded-lg bg-soft p-3 text-left">
              <p className="text-sm font-semibold text-ink">Ready to continue in {app.name}?</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Use the return Shortcut only after you have written the purpose and started this timer.
              </p>
              <Button
                className="mt-3 w-full"
                icon={ArrowRight}
                onClick={() => {
                  window.location.href = returnShortcutUrl;
                }}
              >
                Return to {app.name}
              </Button>
            </div>
          ) : null}
          <Button icon={CheckCircle2} onClick={startLock}>
            I'm done
          </Button>
        </div>
      </section>
    </>
  );
}

function LockedPage({ navigate, session, now, pass, onGeneratePass }) {
  if (!session || session.status !== 'locked') {
    return <EmptyState navigate={navigate} title="No active lock" action="Start a session" path="/session/select-app" />;
  }

  const app = getSessionApp(session);
  const remaining = Math.max(0, session.lockEndsAt - now);
  const timeUsed = formatShort((session.endedAt || session.lockStartedAt) - session.startedAt);

  return (
    <>
      <PageHeader title="Your break has started" subtitle="Meet without the scroll." navigate={navigate} backTo="/dashboard" />
      <section className="ios-card bg-loopoutStone/25 p-5 text-ink">
        <div className="flex items-center justify-between">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white/55 shadow-sm">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <span className="rounded-full bg-white/50 px-3 py-1 text-xs font-semibold text-ink shadow-sm">Protected break</span>
        </div>
        <h1 className="mt-8 text-3xl font-semibold">Time's up. {app.name} is locked.</h1>
        <p className="mt-3 text-muted">Your break has started. Meet without the scroll.</p>
        <div className="mt-8 rounded-[26px] bg-white/45 p-4 shadow-sm backdrop-blur-xl">
          <p className="text-sm text-muted">Lock countdown</p>
          <p className="mt-1 text-5xl font-semibold tabular-nums">{formatTimer(remaining)}</p>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Use the break well</h2>
        <div className="mt-3 grid gap-2">
          {[
            ['Move', 'Stand up, walk or get water.'],
            ['Meet', 'See which friends are also offline.'],
            ['Reset', 'Keep the app closed until the countdown ends.'],
          ].map(([title, text]) => (
            <div className="rounded-lg bg-canvas p-3" key={title}>
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-4">
        <LoopOutPassCard
          pass={pass}
          session={session}
          now={now}
          onFindPartners={() => navigate('/rewards')}
          onInviteFriends={() => navigate('/friends')}
          onTerms={() => navigate(`/rewards/${pass?.rewardCampaignId || rewardCampaigns[0].id}`)}
        />
        {!pass ? (
          <Button className="mt-3 w-full" variant="soft" icon={WalletCards} onClick={() => onGeneratePass?.()}>
            Generate LoopOut Pass
          </Button>
        ) : null}
      </div>

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
  places = [],
  currentUserId,
  isRemote,
  loading,
  onSearch,
  onSendFriendRequest,
  onRespondFriendRequest,
  onRespondInvite,
}) {
  const [filter, setFilter] = useState('Best matches');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const visibleFriends = useMemo(() => sortFriendsForMeetups(friends), [friends]);
  const placeOptions = places.length ? places : lisbonPlaces;
  const availableFriends = visibleFriends.filter((friend) => friend.available);
  const nearbyFriends = visibleFriends.filter((friend) => friend.area && friend.area !== 'Area hidden');
  const laterFriends = visibleFriends.filter((friend) => !friend.available);
  const pendingOfflineInvites = invites.filter((invite) => invite.status === 'pending');
  const confirmedOfflineInvites = invites.filter((invite) => invite.status === 'accepted').slice(0, 3);
  const incomingOfflineInvites = pendingOfflineInvites.filter((invite) => invite.receiver_id === currentUserId);
  const outgoingOfflineInvites = pendingOfflineInvites.filter((invite) => invite.sender_id === currentUserId);
  const bestFriend = availableFriends[0] || visibleFriends[0];
  const bestPlace = placeOptions[0];
  const filterOptions = [
    { label: 'Best matches', count: visibleFriends.length },
    { label: 'Ready now', count: availableFriends.length },
    { label: 'Nearby', count: nearbyFriends.length },
    { label: 'Plan later', count: laterFriends.length },
  ];
  const filteredFriends = visibleFriends.filter((friend) => {
    if (filter === 'Ready now') return friend.available;
    if (filter === 'Nearby') return friend.area && friend.area !== 'Area hidden';
    if (filter === 'Plan later') return !friend.available;
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
      <PageHeader title="Friends & plans" subtitle="Meet people away from the scroll." navigate={navigate} backTo="/dashboard" />

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
            Open settings
          </Button>
        </section>
      ) : null}

      {isRemote ? (
        <section className="mb-4 rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Meetup planner</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">Make an offline plan.</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Choose a friend, a place and a time without leaving this page.
              </p>
            </div>
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-soft text-primary">
              <Calendar className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-canvas p-3">
              <p className="text-lg font-semibold text-ink">{availableFriends.length}</p>
              <p className="text-xs text-muted">ready now</p>
            </div>
            <div className="rounded-lg bg-canvas p-3">
              <p className="text-lg font-semibold text-ink">{incomingOfflineInvites.length}</p>
              <p className="text-xs text-muted">waiting</p>
            </div>
            <div className="rounded-lg bg-canvas p-3">
              <p className="text-lg font-semibold text-ink">{outgoingOfflineInvites.length}</p>
              <p className="text-xs text-muted">sent</p>
            </div>
          </div>

          {bestFriend ? (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-sm font-semibold text-ink">Best plan right now</p>
              <div className="mt-3 flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-soft font-semibold text-deep">
                  {bestFriend.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{bestFriend.name}</p>
                  <p className="mt-1 text-sm leading-5 text-muted">
                    {bestFriend.available ? `${bestFriend.status}.` : 'Not offline right now, but ready to plan.'}
                  </p>
                  <p className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-soft px-2.5 py-1 text-xs font-medium text-deep">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{bestPlace?.name || 'Choose a phone-free place'}</span>
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="soft" className="px-3" icon={Heart} onClick={() => openInvite(bestFriend, bestPlace)}>
                  Invite
                </Button>
                <Button variant="secondary" className="px-3" icon={MapPin} onClick={() => navigate('/places')}>
                  Pick place
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-canvas p-3 text-sm leading-6 text-muted">
              Add your first friend below, then LoopOut can suggest who to meet and where to go.
            </div>
          )}
        </section>
      ) : null}

      {isRemote ? (
        <section className="mb-4 rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="font-semibold text-ink">Add friends</h2>
            <p className="mt-1 text-sm leading-6 text-muted">Search by username or email and send a request.</p>
          </div>
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

      {isRemote && (pendingOfflineInvites.length || confirmedOfflineInvites.length) ? (
        <section className="mb-4 rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">Plans and invites</h2>
              <p className="mt-1 text-sm text-muted">Accept, cancel or open the place when you are ready.</p>
            </div>
            <span className="rounded-full bg-soft px-3 py-1 text-xs font-semibold text-deep">
              {pendingOfflineInvites.length + confirmedOfflineInvites.length}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {pendingOfflineInvites.map((invite) => {
              const incoming = invite.receiver_id === currentUserId;
              const peer = getInvitePeer(invite, visibleFriends, currentUserId);
              const invitePlace = getInvitePlace(invite, placeOptions);
              return (
                <div className="rounded-lg bg-canvas p-3" key={invite.id}>
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white font-semibold text-deep">
                      {peer.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {incoming ? `Invite from ${peer.name}` : `Waiting for ${peer.name}`}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {invitePlace?.name || 'Phone-free place'} · {formatInviteDateTime(invite.suggested_time)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted">
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
                  {invitePlace ? (
                    <Button
                      variant="ghost"
                      className="mt-2 w-full"
                      icon={MapPin}
                      onClick={() => window.open(getGoogleMapsUrl(invitePlace), '_blank', 'noopener,noreferrer')}
                    >
                      Open place
                    </Button>
                  ) : null}
                </div>
              );
            })}
            {confirmedOfflineInvites.map((invite) => {
              const peer = getInvitePeer(invite, visibleFriends, currentUserId);
              const invitePlace = getInvitePlace(invite, placeOptions);
              return (
                <div className="rounded-lg bg-[#E8F8EF] p-3" key={invite.id}>
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white font-semibold text-deep">
                      {peer.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">Confirmed with {peer.name}</p>
                      <p className="mt-1 text-xs text-[#137A3D]">
                        {invitePlace?.name || 'Phone-free place'} · {formatInviteDateTime(invite.suggested_time)}
                      </p>
                    </div>
                  </div>
                  {invitePlace ? (
                    <Button
                      variant="secondary"
                      className="mt-3 w-full"
                      icon={MapPin}
                      onClick={() => window.open(getGoogleMapsUrl(invitePlace), '_blank', 'noopener,noreferrer')}
                    >
                      Open place
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {visibleFriends.length ? (
        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-ink">Friends</h2>
            <p className="text-xs font-medium text-muted">{visibleFriends.length} connected</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filterOptions.map((item) => (
              <button
                type="button"
                className={classNames(
                  'min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold',
                  filter === item.label ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink'
                )}
                key={item.label}
                onClick={() => setFilter(item.label)}
              >
                {item.label} {item.count ? `(${item.count})` : ''}
              </button>
            ))}
          </div>
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
          <h2 className="mt-4 text-xl font-semibold text-ink">
            {visibleFriends.length ? 'No friends in this group yet.' : 'Add friends to go offline together.'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {visibleFriends.length
              ? 'Try Best matches or send a plan for later.'
              : isRemote
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

function LoopOutPassPage({ navigate, pass, session, now, friends = [], recentPasses = [], onGeneratePass }) {
  const [message, setMessage] = useState('');
  const locked = session?.status === 'locked';
  const offlineFriends = friends.filter((friend) => friend.isOffline || friend.available);
  const groupSize = pass?.groupSize || getOfflineGroupSize(friends);
  const currentTier = getGroupTier(groupSize);
  const nextTier = groupSize >= 3 ? null : getGroupTier(groupSize + 1);

  const generate = () => {
    const result = onGeneratePass?.(rewardCampaigns[0].id);
    setMessage(result?.error || 'LoopOut Pass ready.');
  };

  return (
    <>
      <PageHeader title="LoopOut Pass" subtitle="Get rewarded for going offline." navigate={navigate} backTo="/dashboard" />

      {locked || pass ? (
        <LoopOutPassCard
          pass={pass}
          session={session}
          now={now}
          onFindPartners={() => navigate('/rewards')}
          onInviteFriends={() => navigate('/friends')}
          onTerms={() => navigate(`/rewards/${pass?.rewardCampaignId || rewardCampaigns[0].id}`)}
        />
      ) : (
        <section className="rounded-lg border border-line bg-white p-6 text-center shadow-soft">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-soft text-primary">
            <WalletCards className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-ink">No active LoopOut Pass yet.</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Finish a timer and start your lock window to earn a temporary partner reward.
          </p>
          <Button className="mt-5 w-full" icon={Timer} onClick={() => navigate('/session/select-app')}>
            Start a session
          </Button>
        </section>
      )}

      {!pass && locked ? (
        <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Pass generation</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            A pass is created only while your lock is active and daily reward limits are available.
          </p>
          {message ? <p className="mt-3 rounded-lg bg-soft p-3 text-sm text-deep">{message}</p> : null}
          <Button className="mt-4 w-full" icon={WalletCards} onClick={generate}>
            Generate LoopOut Pass
          </Button>
        </section>
      ) : null}

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Friend boost</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">Go offline together.</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Current tier: {currentTier.label}. {nextTier ? `You are 1 friend away from ${nextTier.reward}.` : 'Top group tier unlocked.'}
            </p>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-soft text-primary">
            <Users className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {groupRewardTiers.map((tier) => (
            <div
              className={classNames(
                'flex items-center justify-between rounded-lg border p-3',
                tier.size === currentTier.size ? 'border-primary bg-soft' : 'border-line bg-canvas'
              )}
              key={tier.size}
            >
              <span className="text-sm font-semibold text-ink">{tier.label}</span>
              <span className="text-sm font-semibold text-deep">{tier.reward}</span>
            </div>
          ))}
        </div>
        {offlineFriends.length ? (
          <p className="mt-3 rounded-lg bg-[#E8F8EF] p-3 text-sm leading-6 text-[#137A3D]">
            {offlineFriends.length} friend{offlineFriends.length === 1 ? '' : 's'} already offline.
          </p>
        ) : null}
        <Button className="mt-4 w-full" variant="soft" icon={UserPlus} onClick={() => navigate('/friends')}>
          Invite friends to boost reward
        </Button>
      </section>

      {recentPasses.length ? (
        <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Recent passes</h2>
          <div className="mt-3 space-y-2">
            {recentPasses.slice(0, 4).map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-canvas p-3" key={item.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{item.rewardSnapshot?.title || 'LoopOut reward'}</p>
                  <p className="text-xs text-muted">{formatPublicCode(item.publicCode)}</p>
                </div>
                <PassStatusPill status={getPassStatus(item, now)} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function RewardDetailPage({ navigate, rewardId, session, pass, now, friends = [], onGeneratePass, openInvite }) {
  const campaign = getRewardCampaignById(rewardId);
  const partner = getPartnerPlaceById(campaign.partnerPlaceId);
  const [message, setMessage] = useState('');
  const passForReward = pass?.rewardCampaignId === campaign.id ? pass : null;
  const locked = session?.status === 'locked';
  const partnerPlace = partner ? normalizePartnerPlace(partner) : null;
  const groupSize = passForReward?.groupSize || getOfflineGroupSize(friends);
  const rewardSummary = getRewardSummary(campaign, groupSize);

  const generate = () => {
    const result = onGeneratePass?.(campaign.id);
    if (result?.error) {
      setMessage(result.error);
      return;
    }
    setMessage('Pass updated for this reward.');
    navigate('/pass');
  };

  return (
    <>
      <PageHeader title="Reward details" subtitle={partner?.name || 'LoopOut partner'} navigate={navigate} backTo="/rewards" />
      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="grid h-44 place-items-center bg-soft">
          <div className="grid h-20 w-20 place-items-center rounded-[22px] bg-white text-primary shadow-sm">
            <Gift className="h-9 w-9" />
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">{partner?.area || 'Lisbon'}</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight text-ink">{campaign.title}</h1>
              <p className="mt-2 text-sm leading-6 text-muted">{campaign.description}</p>
            </div>
            <VerifiedPartnerBadge place={partner} />
          </div>
          <div className="mt-5 grid gap-2 rounded-lg bg-canvas p-3">
            <DetailRow label="Partner" value={partner?.name || 'Partner place'} />
            <DetailRow label="Reward now" value={rewardSummary} />
            <DetailRow label="Expiry rule" value={campaign.validWindow} />
            <DetailRow label="Group size" value={`${groupSize} offline`} />
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Conditions</h2>
        <div className="mt-3 space-y-2">
          {campaign.terms.map((term) => (
            <div className="flex gap-2 rounded-lg bg-canvas p-3" key={term}>
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm leading-5 text-muted">{term}</p>
            </div>
          ))}
          <div className="flex gap-2 rounded-lg bg-canvas p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm leading-5 text-muted">Partner may ask to see the active lock screen before purchase.</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Group boost</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Invite friends who are also offline. The QR pass shows the group size and reward tier.
        </p>
        <div className="mt-3 grid gap-2">
          {groupRewardTiers.map((tier) => (
            <div className="flex items-center justify-between rounded-lg bg-canvas p-3" key={tier.size}>
              <span className="text-sm font-semibold text-ink">{tier.label}</span>
              <span className="text-sm font-semibold text-deep">{tier.reward}</span>
            </div>
          ))}
        </div>
      </section>

      {message ? <p className="mt-4 rounded-lg bg-soft p-3 text-sm text-deep">{message}</p> : null}

      <div className="mt-4 grid gap-2">
        <Button icon={QrCode} disabled={!locked && !passForReward} onClick={passForReward ? () => navigate('/pass') : generate}>
          {passForReward ? 'Show QR Pass' : locked ? 'Generate / Show QR Pass' : 'Finish timer to earn pass'}
        </Button>
        <Button variant="soft" icon={Users} onClick={() => openInvite(null, partnerPlace)}>
          Invite friends
        </Button>
        <Button
          variant="secondary"
          icon={ExternalLink}
          onClick={() => partner && window.open(getGoogleMapsUrl(partner), '_blank', 'noopener,noreferrer')}
        >
          Open in Maps
        </Button>
      </div>
    </>
  );
}

function PartnerScannerPage({ navigate, initialCode = '', passes = [], validatePassCode, redeemPassCode }) {
  const verifiedPartners = partnerPlaces.filter((place) => place.isVerified);
  const [selectedPartnerId, setSelectedPartnerId] = useState(verifiedPartners[0]?.id || '');
  const [code, setCode] = useState(formatPublicCode(initialCode));
  const [result, setResult] = useState(null);
  const selectedPartner = getPartnerPlaceById(selectedPartnerId);

  const validate = () => {
    setResult(validatePassCode(code, selectedPartnerId));
  };

  useEffect(() => {
    if (initialCode) setResult(validatePassCode(initialCode, selectedPartnerId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redeem = () => {
    setResult(redeemPassCode(code, selectedPartnerId));
  };

  return (
    <>
      <PageHeader title="Partner scanner" subtitle="Validate a LoopOut Pass." navigate={navigate} backTo="/dashboard" />
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="grid h-14 w-14 place-items-center rounded-[16px] bg-soft text-primary">
          <QrCode className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-ink">Scan or enter the pass code.</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Staff only see the reward, pass status, lock validity window and group size. Private account data stays hidden.
        </p>
        <div className="mt-4 rounded-lg bg-canvas p-3 text-sm leading-6 text-muted">
          Camera scanning can be connected later with a browser QR library. This MVP validates the code printed under the QR.
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-sm font-medium text-ink">Partner place</span>
          <select
            className="mt-2 min-h-12 w-full rounded-lg border border-line bg-canvas px-3 text-base text-ink outline-none focus:border-primary"
            value={selectedPartnerId}
            onChange={(event) => setSelectedPartnerId(event.target.value)}
          >
            {verifiedPartners.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-ink">Pass code</span>
          <input
            className="mt-2 min-h-14 w-full rounded-lg border border-line bg-canvas px-4 text-center text-xl font-semibold uppercase tracking-[0.12em] text-ink outline-none focus:border-primary"
            value={code}
            placeholder="LOXX-XXXX-XXXX"
            onChange={(event) => setCode(formatPublicCode(event.target.value))}
          />
        </label>
        <Button className="mt-4 w-full" icon={ScanLine} onClick={validate}>
          Validate pass
        </Button>
      </section>

      {result ? (
        <section
          className={classNames(
            'mt-4 rounded-lg border p-5 shadow-sm',
            result.status === 'valid' || result.status === 'redeemed'
              ? 'border-[#B7E4C7] bg-[#F1FBF5]'
              : 'border-[#FEDF89] bg-[#FFF7E6]'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Scan result</p>
              <h2 className="mt-1 text-2xl font-semibold text-ink">{result.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{result.message}</p>
            </div>
            <PassStatusPill status={result.status === 'valid' ? 'active' : result.status} />
          </div>
          {result.pass ? (
            <div className="mt-4 grid gap-2 rounded-lg bg-white/70 p-3">
              <DetailRow label="Customer" value={result.pass.userDisplayName || 'LoopOut user'} />
              <DetailRow label="Partner" value={selectedPartner?.name || 'Partner'} />
              <DetailRow label="Reward" value={result.pass.rewardSnapshot?.summary || result.campaign?.title} />
              <DetailRow label="Group size" value={`${result.pass.groupSize || 1} offline`} />
              <DetailRow label="Expires" value={formatTime(dateMs(result.pass.expiresAt))} />
            </div>
          ) : null}
          {result.status === 'valid' ? (
            <Button className="mt-4 w-full" icon={CheckCircle2} onClick={redeem}>
              Redeem reward
            </Button>
          ) : null}
        </section>
      ) : null}

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Recent local scans</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {passes.length} pass{passes.length === 1 ? '' : 'es'} are available in this browser for MVP testing.
        </p>
      </section>
    </>
  );
}

function PartnerDashboardPage({ navigate, passes = [], scanEvents = [] }) {
  const metrics = getPartnerMetrics(passes, scanEvents);

  return (
    <>
      <PageHeader title="Partner dashboard" subtitle="Track QR rewards and foot traffic." navigate={navigate} backTo="/dashboard" />
      <section className="rounded-lg bg-deep p-5 text-white shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/60">Partner MVP</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">Turn offline moments into visits.</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          A partner admin can monitor scans, redemptions, campaigns and quieter-hour engagement.
        </p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Scans this month" value={metrics.scans} icon={QrCode} />
        <StatCard label="Rewards redeemed" value={metrics.redemptions} icon={Gift} />
        <StatCard label="Group visits" value={metrics.groupRedemptions} icon={Users} />
        <StatCard label="Est. revenue" value={metrics.estimatedRevenue} icon={TrendingUp} />
      </div>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Insights</h2>
        <div className="mt-3 grid gap-2">
          <DetailRow label="Invalid attempts" value={String(metrics.invalidAttempts)} />
          <DetailRow label="Customers brought" value={String(metrics.estimatedCustomers)} />
          <DetailRow label="Best reward" value={metrics.mostPopularReward} />
          <DetailRow label="Peak time" value={metrics.peakHours} />
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-ink">Active campaigns</h2>
          <Button variant="soft" className="px-3" icon={Plus}>
            New
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {rewardCampaigns.map((campaign) => {
            const partner = getPartnerPlaceById(campaign.partnerPlaceId);
            return (
              <button
                type="button"
                className="w-full rounded-lg bg-canvas p-3 text-left"
                key={campaign.id}
                onClick={() => navigate(`/rewards/${campaign.id}`)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{campaign.title}</p>
                    <p className="truncate text-xs text-muted">{partner?.name || 'Partner'} · {campaign.rewardType}</p>
                  </div>
                  <span className="rounded-full bg-[#E8F8EF] px-2.5 py-1 text-xs font-semibold text-[#137A3D]">
                    {campaign.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-4 grid gap-2">
        <Button icon={ScanLine} onClick={() => navigate('/partner/scan')}>
          Open staff scanner
        </Button>
        <Button variant="secondary" icon={Store} onClick={() => navigate('/partners')}>
          Partner onboarding page
        </Button>
      </div>
    </>
  );
}

function PartnerLandingPage({ navigate }) {
  const benefits = [
    'Increase foot traffic during quieter hours',
    'Reach students and young adults',
    'Offer rewards only after real offline time',
    'Track scans, redemptions and group visits',
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <nav className="border-b border-line/70 bg-canvas/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <button type="button" onClick={() => navigate('/')}>
            <BrandMark />
          </button>
          <Button variant="secondary" icon={ArrowRight} onClick={() => navigate('/partners/suggest')}>
            Become a partner
          </Button>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10">
        <section className="grid min-h-[72vh] items-center gap-8 lg:grid-cols-[1fr_420px]">
          <div>
            <p className="inline-flex rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-deep shadow-sm">
              LoopOut for partners
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] text-ink sm:text-7xl">
              Bring young people offline and into your space.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
              LoopOut helps cafes, restaurants and study spaces attract young customers when they finish their social media time.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button icon={Store} onClick={() => navigate('/partners/suggest')}>
                Become a LoopOut Partner
              </Button>
              <Button variant="secondary" icon={ShieldCheck} onClick={() => navigate('/login')}>
                Create partner account
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="mx-auto max-w-xs">
              <LoopOutQrCode value="LOOPOUTPARTNER" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-ink">Rewards that require real offline time.</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Staff scan a temporary pass. LoopOut confirms whether it is active, unused and linked to the right partner.
            </p>
          </div>
        </section>

        <section className="grid gap-4 py-10 md:grid-cols-3">
          {[
            ['1', 'Create a reward', 'Choose a discount, free item or group offer.'],
            ['2', 'Appear as verified', 'Users see your place after their timer ends.'],
            ['3', 'Scan the pass', 'Staff validate and redeem each QR reward once.'],
          ].map(([step, title, text]) => (
            <div className="rounded-lg border border-line bg-white p-5 shadow-sm" key={step}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-soft text-sm font-semibold text-deep">{step}</span>
              <h2 className="mt-5 text-xl font-semibold text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 py-10 lg:grid-cols-2">
          <div className="rounded-lg border border-line bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-ink">Benefits</h2>
            <div className="mt-4 space-y-2">
              {benefits.map((benefit) => (
                <div className="flex gap-2 rounded-lg bg-canvas p-3" key={benefit}>
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm leading-5 text-muted">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-line bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-ink">Pricing model</h2>
            <div className="mt-4 grid gap-2">
              {['Free pilot', 'Pay per redemption', 'Monthly partner subscription', 'Featured listing'].map((item) => (
                <div className="rounded-lg bg-soft p-3 text-sm font-semibold text-deep" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function PartnerApplicationPage({ navigate, onSubmit }) {
  const [form, setForm] = useState({
    contactName: '',
    businessName: '',
    email: '',
    city: 'Lisbon',
    area: '',
    rewardIdea: '10% off coffee',
    note: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setSubmitting(true);
    try {
      await onSubmit?.(form);
      setMessage('Partner application saved for review.');
    } catch (err) {
      setError(getReadableSupabaseError(err) || 'Could not save partner application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas px-4 py-[calc(env(safe-area-inset-top)+24px)] text-ink">
      <main className="mx-auto max-w-md">
        <PageHeader title="Become a partner" subtitle="Create a phone-free reward." navigate={navigate} backTo="/partners" />
        <form className="rounded-lg border border-line bg-white p-5 shadow-soft" onSubmit={submit}>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Partner application</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-ink">Tell us about your place.</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            This creates a partner lead for admin review. Verified partners can scan QR passes and run rewards.
          </p>
          <div className="mt-5 space-y-4">
            <Field label="Contact name" value={form.contactName} onChange={(value) => update('contactName', value)} />
            <Field label="Business name" value={form.businessName} onChange={(value) => update('businessName', value)} />
            <Field label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} />
            <Field label="City" value={form.city} onChange={(value) => update('city', value)} />
            <Field label="Area" value={form.area} onChange={(value) => update('area', value)} />
            <Field label="Reward idea" value={form.rewardIdea} onChange={(value) => update('rewardIdea', value)} />
            <label className="block">
              <span className="text-sm font-medium text-ink">Notes</span>
              <textarea
                className="mt-2 min-h-24 w-full resize-none rounded-lg border border-line bg-canvas px-3 py-3 text-base text-ink outline-none focus:border-primary"
                value={form.note}
                onChange={(event) => update('note', event.target.value)}
              />
            </label>
          </div>
          {message ? <p className="mt-4 rounded-lg bg-[#E8F8EF] p-3 text-sm text-[#137A3D]">{message}</p> : null}
          {error ? <p className="mt-4 rounded-lg bg-[#FFF1F0] p-3 text-sm text-[#B42318]">{error}</p> : null}
          <Button className="mt-5 w-full" icon={ArrowRight} type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit partner request'}
          </Button>
        </form>
      </main>
    </div>
  );
}

function AdminPage({ navigate, passes = [], partnerLeads = [], scanEvents = [] }) {
  const activePasses = passes.filter((pass) => getPassStatus(pass) === 'active').length;
  const redeemedPasses = passes.filter((pass) => pass.status === 'redeemed').length;
  const verifiedPartners = partnerPlaces.filter((place) => place.isVerified).length;

  return (
    <>
      <PageHeader title="Admin" subtitle="LoopOut operations overview." navigate={navigate} backTo="/dashboard" />
      <section className="rounded-lg bg-deep p-5 text-white shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/60">Internal dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">Approve, verify and monitor rewards.</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          This admin surface is ready for roles, partner verification and abuse review.
        </p>
      </section>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Active passes" value={activePasses} icon={WalletCards} />
        <StatCard label="QR redemptions" value={redeemedPasses} icon={QrCode} />
        <StatCard label="Partner places" value={verifiedPartners} icon={Store} />
        <StatCard label="Scan events" value={scanEvents.length} icon={ScanLine} />
      </div>
      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Partner applications</h2>
        {partnerLeads.length ? (
          <div className="mt-3 space-y-2">
            {partnerLeads.map((lead) => (
              <div className="rounded-lg bg-canvas p-3" key={lead.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{lead.businessName}</p>
                    <p className="text-xs text-muted">{lead.area || lead.city} · {lead.rewardIdea}</p>
                  </div>
                  <span className="rounded-full bg-soft px-2.5 py-1 text-xs font-semibold text-deep">pending</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-canvas p-3 text-sm leading-6 text-muted">
            No local partner applications yet.
          </p>
        )}
      </section>
      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Admin actions</h2>
        <div className="mt-3 grid gap-2">
          {[
            'Approve partner applications',
            'Verify places',
            'Review reward campaigns',
            'Disable suspicious passes',
            'Feature partner places',
            'Export analytics CSV',
          ].map((item) => (
            <div className="rounded-lg bg-canvas p-3 text-sm font-semibold text-ink" key={item}>
              {item}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function PlacesPage({
  navigate,
  openInvite,
  places = lisbonPlaces,
  loading,
  defaultCategory = 'All',
  title = 'Phone-free places in Lisbon',
  subtitle = 'Verified rewards and calm public places.',
}) {
  const [category, setCategory] = useState(defaultCategory);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const categories = ['All', 'Verified Partners', 'Cafes', 'Restaurants', 'Study Spaces', 'Gardens', 'Libraries', 'Parks'];
  const loopoutPlaces = useMemo(() => buildLoopOutPlaces(places), [places]);

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
    if (!userLocation) return loopoutPlaces;

    return loopoutPlaces
      .map((place) => ({
        ...place,
        distanceKm: place.coordinates ? getDistanceKm(userLocation, place.coordinates) : null,
      }))
      .sort((first, second) => {
        const firstDistance = first.distanceKm ?? Number.POSITIVE_INFINITY;
        const secondDistance = second.distanceKm ?? Number.POSITIVE_INFINITY;
        return firstDistance - secondDistance;
      });
  }, [loopoutPlaces, userLocation]);

  const visiblePlaces = placesByDistance.filter((place) => matchesPlaceCategory(place, category));
  const topPlace = visiblePlaces[0];
  const verifiedCount = loopoutPlaces.filter((place) => place.isVerified).length;
  const suggestedCount = loopoutPlaces.filter((place) => !place.isPartner).length;

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
      <PageHeader title={title} subtitle={subtitle} navigate={navigate} backTo="/dashboard" />
      <section className="mb-4 rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-soft text-primary">
            <WalletCards className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">LoopOut Pass places</p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight text-ink">Rewards where they are verified. Suggestions where they are public.</h1>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-soft p-3">
                <p className="text-xl font-semibold text-ink">{verifiedCount}</p>
                <p className="text-xs text-muted">verified partners</p>
              </div>
              <div className="rounded-lg bg-canvas p-3">
                <p className="text-xl font-semibold text-ink">{suggestedCount}</p>
                <p className="text-xs text-muted">suggested spots</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="mb-4 rounded-lg border border-line bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-soft text-primary">
            <Compass className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
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
            <p className="mt-2 text-sm leading-6 text-muted">
              {topPlace
                ? `${visiblePlaces.length} place${visiblePlaces.length === 1 ? '' : 's'} shown. ${topPlace.name} is first in this view.`
                : 'No places match this filter yet.'}
            </p>
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
      {visiblePlaces.length ? (
        <>
          <PhoneFreeMap places={visiblePlaces} userLocation={userLocation} />
          {category === 'Verified Partners' || category === 'All' ? (
            <section className="mb-4 grid gap-3">
              {rewardCampaigns.slice(0, 3).map((campaign) => (
                <RewardMiniCard campaign={campaign} navigate={navigate} key={campaign.id} />
              ))}
            </section>
          ) : null}
          <div className="space-y-3">
            {visiblePlaces.map((place) => (
              <PlaceCard place={place} key={`${place.sourceType}-${place.id}`} onInvite={openInvite} navigate={navigate} />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-line bg-white p-6 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-soft text-primary">
            <MapPin className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-ink">No places in this category yet.</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Choose another category or add more places in Supabase later.</p>
        </div>
      )}
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
        <div className="mt-4 rounded-lg bg-canvas p-3">
          <p className="text-sm font-semibold text-ink">Data source</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            LoopOut activity is tracked automatically. iPhone Screen Time can be added manually for comparison.
          </p>
        </div>
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
    if (!form.date) {
      setError('Choose a date first.');
      return;
    }
    if (Number(form.socialMediaMinutes) > Number(form.totalScreenTimeMinutes)) {
      setError('Social media time cannot be higher than total Screen Time.');
      return;
    }
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
          options={[30, 45, 60]}
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
        <button
          type="button"
          className="w-full rounded-lg border border-line bg-white p-3 text-left text-sm font-semibold text-deep"
          onClick={() => navigate('/partner/dashboard')}
        >
          Partner mode
        </button>
        {isRemote ? (
          <Button className="w-full" variant="secondary" icon={LogOut} onClick={onLogout}>
            Log out
          </Button>
        ) : null}
      </SettingsGroup>

      <p className="rounded-lg bg-white p-4 text-sm leading-6 text-muted shadow-sm">
        LoopOut is a PWA. iPhone Shortcuts creates the app-opening pause, while LoopOut manages the purpose, timer,
        break window, friends and places. Native app blocking can be added in a future iOS app.
      </p>
    </>
  );
}

function SettingsGroup({ title, icon: Icon, children }) {
  return (
    <section className="ios-card mb-4 p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-white/55 text-primary shadow-sm">
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
        className="min-h-11 rounded-full border border-line bg-white/45 px-3 text-sm font-semibold text-ink outline-none focus:border-activeBlue"
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
          'relative h-8 w-14 rounded-full border border-white/60 transition shadow-inner',
          checked ? 'bg-[#2F312D]' : 'bg-loopoutStone/35'
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
  const [copied, setCopied] = useState('');
  const loopoutUrl = `${window.location.origin}/session/select-app`;
  const shortcutApps = appOptions.filter((app) => !['custom', 'games'].includes(app.id));
  const bypassExamples = shortcutApps.slice(0, 5);

  const copyUrl = async (value = loopoutUrl, copiedKey = 'default') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(copiedKey);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopied('');
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
          <Button className="mt-5 w-full" variant="soft" icon={Copy} onClick={() => copyUrl(loopoutUrl, 'default')}>
            {copied === 'default' ? 'Copied' : 'Copy general LoopOut URL'}
          </Button>
        </section>

        <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Direct app links</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Use one link per Shortcut automation so TikTok opens straight on the TikTok purpose screen, Instagram opens
            straight on Instagram, and so on.
          </p>
          <div className="mt-4 space-y-2">
            {shortcutApps.map((app) => {
              const purposeUrl = getPurposeUrl(app.id);
              return (
                <div className="flex items-center gap-3 rounded-lg bg-canvas p-3" key={app.id}>
                  <AppLogo app={app} className="h-10 w-10 rounded-[10px]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{app.name}</p>
                    <p className="truncate text-xs text-muted">{purposeUrl}</p>
                  </div>
                  <Button variant="secondary" className="px-3" icon={Copy} onClick={() => copyUrl(purposeUrl, app.id)}>
                    {copied === app.id ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Avoid the Shortcut loop</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            iPhone automations run every time an app opens. Use one bypass file per app so returning from LoopOut does
            not immediately send you back to LoopOut again.
          </p>
          <div className="mt-4 grid gap-2">
            {bypassExamples.map((app) => (
              <div className="rounded-lg bg-soft p-3" key={app.id}>
                <p className="text-sm font-semibold text-ink">{app.name}</p>
                <p className="mt-1 break-all text-xs leading-5 text-muted">File: LoopOutAllow-{app.id}.txt</p>
                <p className="break-all text-xs leading-5 text-muted">Return Shortcut: {app.returnShortcut}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-canvas p-3">
              <p className="text-sm font-semibold text-ink">1. App automation</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                Before opening LoopOut, get the matching <span className="font-semibold text-ink">LoopOutAllow-[app].txt</span> file
                with "error if not found" turned off. If the file exists, delete it and stop the automation.
              </p>
            </div>
            <div className="rounded-lg bg-canvas p-3">
              <p className="text-sm font-semibold text-ink">2. Return Shortcut</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                Create the matching <span className="font-semibold text-ink">LoopOut Return [App]</span> Shortcut: save a small
                text file called LoopOutAllow-[app].txt, then open that app.
              </p>
            </div>
            <div className="rounded-lg bg-canvas p-3">
              <p className="text-sm font-semibold text-ink">3. LoopOut button</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                After the timer starts, tap Return to the app. The app automation consumes that one-time bypass and lets
                the original app open.
              </p>
            </div>
          </div>
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
  const { path, search, searchParams, navigate } = useRoute();
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
  const [passes, setPasses] = useLocalStorage(storageKeys.passes, []);
  const [partnerLeads, setPartnerLeads] = useLocalStorage(storageKeys.partnerLeads, []);
  const [scanEvents, setScanEvents] = useLocalStorage(storageKeys.scanEvents, []);
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
  const requestedAppId = searchParams.get('app');
  const currentRoute = `${path}${search}`;
  const activePass = getActivePassForSession(passes, session, now);
  const offlineFriendCount = activeFriends.filter((friend) => friend.isOffline || friend.available).length;
  const allInvitePlaces = useMemo(() => buildLoopOutPlaces(activePlaces), [activePlaces]);

  useEffect(() => {
    if (path !== '/session/purpose' || !isKnownAppId(requestedAppId)) return;

    const runningSession = getRunningSessionForApp(session, requestedAppId);
    if (runningSession) {
      navigate(runningSession.status === 'locked' ? '/session/locked' : '/session/active');
      return;
    }

    setDraft((current) => (current.appId === requestedAppId ? current : { ...current, appId: requestedAppId }));
  }, [path, requestedAppId, session, setDraft]);

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

  useEffect(() => {
    if (!isRemote || !authUser || session?.status !== 'locked') return;

    setPasses((current) => {
      if (getActivePassForSession(current, session, Date.now())) return current;
      if (getDailyPassCount(current, authUser.id) >= 3) return current;

      return [
        createLoopOutPass({
          session,
          userId: authUser.id,
          campaignId: rewardCampaigns[0].id,
          groupSize: Math.min(3, 1 + offlineFriendCount),
          displayName: profile.name?.split(' ')[0] || 'LoopOut user',
        }),
        ...current,
      ];
    });
  }, [
    authUser,
    isRemote,
    offlineFriendCount,
    profile.name,
    session?.id,
    session?.lockEndsAt,
    session?.remoteId,
    session?.status,
    setPasses,
  ]);

  const startSession = async (nextDraft) => {
    const startedAt = Date.now();
    const app = getAppById(nextDraft.appId);
    const runningSession = getRunningSessionForApp(session, app.id);

    if (runningSession) {
      setBackendError(`${app.name} already has a session running.`);
      navigate(runningSession.status === 'locked' ? '/session/locked' : '/session/active');
      return;
    }

    const cleanDraft = {
      ...nextDraft,
      appName: app.name,
      purpose: nextDraft.purpose.trim(),
      timerMinutes: Math.min(maxUsageMinutes, Math.max(1, Number(nextDraft.timerMinutes))),
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

  const ensureLoopOutPass = useCallback(
    (campaignId = rewardCampaigns[0].id) => {
      if (!isRemote || !authUser) {
        return { error: 'Sign in to generate a LoopOut Pass.' };
      }
      if (!session || session.status !== 'locked') {
        return { error: 'Finish a timer first. Passes only work during an active lock.' };
      }

      const groupSize = Math.min(3, 1 + offlineFriendCount);
      const existing = getActivePassForSession(passes, session, Date.now());

      if (existing && getPassStatus(existing, Date.now()) === 'active') {
        const updatedPass = updatePassReward(existing, campaignId, groupSize);
        setPasses((current) => current.map((item) => (item.id === updatedPass.id ? updatedPass : item)));
        return { pass: updatedPass };
      }

      if (getDailyPassCount(passes, authUser.id) >= 3) {
        return { error: 'Daily reward limit reached. Try again tomorrow.' };
      }

      const nextPass = createLoopOutPass({
        session,
        userId: authUser.id,
        campaignId,
        groupSize,
        displayName: profile.name?.split(' ')[0] || 'LoopOut user',
      });
      setPasses((current) => [nextPass, ...current]);
      return { pass: nextPass };
    },
    [authUser, isRemote, offlineFriendCount, passes, profile.name, session, setPasses]
  );

  const submitPartnerLead = useCallback(
    async (lead) => {
      let savedLead = null;
      if (isSupabaseConfigured) {
        savedLead = await createPartnerLeadRecord(lead);
      }

      setPartnerLeads((current) => [
        {
          id: savedLead?.id || crypto.randomUUID(),
          ...lead,
          status: savedLead?.status || 'pending',
          createdAt: savedLead?.created_at || new Date().toISOString(),
        },
        ...current,
      ]);
    },
    [setPartnerLeads]
  );

  const validatePassCode = useCallback(
    (value, selectedPartnerId) => {
      const cleanCode = normalizePublicCode(value);
      const foundPass = passes.find((item) => normalizePublicCode(item.publicCode) === cleanCode);

      if (!cleanCode || !foundPass) {
        setScanEvents((current) => [
          {
            id: crypto.randomUUID(),
            publicCode: cleanCode,
            partnerPlaceId: selectedPartnerId,
            result: 'invalid',
            scannedAt: new Date().toISOString(),
          },
          ...current,
        ]);
        return {
          status: 'invalid',
          title: 'Pass not found',
          message: 'Check the code under the QR and try again.',
        };
      }

      const status = getPassStatus(foundPass, Date.now());
      const campaign = getRewardCampaignById(foundPass.rewardCampaignId);
      const partner = getPartnerPlaceById(foundPass.partnerPlaceId);

      if (status === 'redeemed') {
        return {
          status: 'redeemed',
          title: 'Already redeemed',
          message: 'This LoopOut Pass has already been used.',
          pass: foundPass,
          campaign,
          partner,
        };
      }

      if (status === 'expired') {
        return {
          status: 'expired',
          title: 'Pass expired',
          message: 'The active lock window has ended, so this reward can no longer be redeemed.',
          pass: foundPass,
          campaign,
          partner,
        };
      }

      if (selectedPartnerId && foundPass.partnerPlaceId !== selectedPartnerId) {
        return {
          status: 'wrong_partner',
          title: 'Wrong partner',
          message: `This pass is for ${partner?.name || 'another partner'}.`,
          pass: foundPass,
          campaign,
          partner,
        };
      }

      return {
        status: 'valid',
        title: 'Valid LoopOut Pass',
        message: 'The pass is active, unused and linked to this partner.',
        pass: foundPass,
        campaign,
        partner,
      };
    },
    [passes, setScanEvents]
  );

  const redeemPassCode = useCallback(
    (value, selectedPartnerId) => {
      const validation = validatePassCode(value, selectedPartnerId);
      const result = validation.status === 'valid' ? 'redeemed' : validation.status;

      setScanEvents((current) => [
        {
          id: crypto.randomUUID(),
          publicCode: normalizePublicCode(value),
          partnerPlaceId: selectedPartnerId,
          passId: validation.pass?.id || null,
          result,
          scannedAt: new Date().toISOString(),
        },
        ...current,
      ]);

      if (validation.status !== 'valid') return validation;

      const redeemedPass = {
        ...validation.pass,
        status: 'redeemed',
        redeemedAt: new Date().toISOString(),
        redeemedPartnerPlaceId: selectedPartnerId,
      };
      setPasses((current) => current.map((item) => (item.id === redeemedPass.id ? redeemedPass : item)));

      return {
        ...validation,
        status: 'redeemed',
        title: 'Reward redeemed',
        message: 'This pass is now used and cannot be redeemed again.',
        pass: redeemedPass,
      };
    },
    [setPasses, setScanEvents, validatePassCode]
  );

  const publicPage = (() => {
    if (path === '/') return <Landing navigate={navigate} />;
    if (path === '/partners') return <PartnerLandingPage navigate={navigate} />;
    if (path === '/partners/suggest') return <PartnerApplicationPage navigate={navigate} onSubmit={submitPartnerLead} />;
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
          returnTo={currentRoute}
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

    const rewardMatch = path.match(/^\/rewards\/([^/]+)$/);

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
            pass={activePass}
          />
        );
      }
      if (path === '/session/select-app') {
        return <SelectAppPage navigate={navigate} draft={draft} setDraft={setDraft} session={session} />;
      }
      if (path === '/session/purpose') {
        return <PurposePage navigate={navigate} draft={draft} setDraft={setDraft} session={session} />;
      }
      if (path === '/session/timer') {
        return (
          <TimerPage
            navigate={navigate}
            draft={draft}
            setDraft={setDraft}
            settings={settings}
            startSession={startSession}
            session={session}
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
        return <LockedPage navigate={navigate} session={session} now={now} pass={activePass} onGeneratePass={ensureLoopOutPass} />;
      }
      if (path === '/pass') {
        return (
          <LoopOutPassPage
            navigate={navigate}
            pass={activePass}
            session={session}
            now={now}
            friends={activeFriends}
            recentPasses={passes}
            onGeneratePass={ensureLoopOutPass}
          />
        );
      }
      if (path === '/rewards') {
        return (
          <PlacesPage
            key="rewards"
            navigate={navigate}
            openInvite={openInvite}
            places={activePlaces}
            loading={dataLoading}
            defaultCategory="Verified Partners"
            title="LoopOut Pass places"
            subtitle="Verified partner rewards near you."
          />
        );
      }
      if (rewardMatch) {
        return (
          <RewardDetailPage
            navigate={navigate}
            rewardId={decodeURIComponent(rewardMatch[1])}
            session={session}
            pass={activePass}
            now={now}
            friends={activeFriends}
            onGeneratePass={ensureLoopOutPass}
            openInvite={openInvite}
          />
        );
      }
      if (path === '/partner/scan') {
        return (
          <PartnerScannerPage
            navigate={navigate}
            initialCode={searchParams.get('code') || ''}
            passes={passes}
            validatePassCode={validatePassCode}
            redeemPassCode={redeemPassCode}
          />
        );
      }
      if (path === '/partner/dashboard') {
        return <PartnerDashboardPage navigate={navigate} passes={passes} scanEvents={scanEvents} />;
      }
      if (path === '/admin') {
        return <AdminPage navigate={navigate} passes={passes} partnerLeads={partnerLeads} scanEvents={scanEvents} />;
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
            places={allInvitePlaces}
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
      if (path === '/places') return <PlacesPage key="places" navigate={navigate} openInvite={openInvite} places={activePlaces} loading={dataLoading} />;
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
          pass={activePass}
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
          places={allInvitePlaces}
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
