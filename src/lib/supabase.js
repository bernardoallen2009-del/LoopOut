import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getProjectRefFromDashboardUrl(parsedUrl) {
  const parts = parsedUrl.pathname.split('/').filter(Boolean);
  const dashboardProjectIndex = parts.findIndex((part, index) => part === 'project' && index > 0);
  const directProjectIndex = parts[0] === 'project' ? 0 : -1;
  const projectIndex = dashboardProjectIndex >= 0 ? dashboardProjectIndex : directProjectIndex;
  return projectIndex >= 0 ? parts[projectIndex + 1] : null;
}

function resolveSupabaseConfig(url, anonKey) {
  const trimmedUrl = url?.trim();
  const trimmedKey = anonKey?.trim();

  if (!trimmedUrl || !trimmedKey) {
    return {
      url: '',
      anonKey: trimmedKey || '',
      error: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.',
    };
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    const projectRef = getProjectRefFromDashboardUrl(parsedUrl);

    if ((parsedUrl.hostname === 'supabase.com' || parsedUrl.hostname === 'app.supabase.com') && projectRef) {
      return {
        url: `https://${projectRef}.supabase.co`,
        anonKey: trimmedKey,
        warning: 'Converted Supabase dashboard URL to the project API URL.',
      };
    }

    return {
      url: parsedUrl.origin,
      anonKey: trimmedKey,
      warning:
        parsedUrl.pathname && parsedUrl.pathname !== '/'
          ? 'Removed the path from VITE_SUPABASE_URL. Supabase needs the project API origin only.'
          : '',
    };
  } catch {
    return {
      url: '',
      anonKey: trimmedKey,
      error: 'Invalid VITE_SUPABASE_URL. Use the Project URL from Supabase Settings > API.',
    };
  }
}

export const supabaseConfig = resolveSupabaseConfig(rawUrl, rawAnonKey);
export const supabase = supabaseConfig.url && supabaseConfig.anonKey && !supabaseConfig.error
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storageKey: 'loopout.supabase.auth',
      },
    })
  : null;
export const isSupabaseConfigured = Boolean(supabase);
export const supabaseConfigError = supabaseConfig.error || '';
export const supabaseConfigWarning = supabaseConfig.warning || '';
export const supabaseProjectHost = supabaseConfig.url ? new URL(supabaseConfig.url).host : '';

// Architecture note:
// LoopOut is a PWA, so it cannot automatically read iOS Screen Time data from Safari.
// Current analytics are based on LoopOut-owned data: sessions, lock periods, purposes,
// offline invites, meetups and optional manual Screen Time logs. A future native iOS app
// can add Screen Time access through Apple's FamilyControls, ManagedSettings and
// DeviceActivity frameworks.

function assertSupabase() {
  if (!supabase) {
    throw new Error(
      supabaseConfigError || 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
}

export function normalizeSupabaseError(error) {
  const message = error?.message || String(error);

  if (message.includes('Invalid path specified in request URL')) {
    return new Error(
      'Supabase URL is wrong. In Vercel, VITE_SUPABASE_URL must be the Project URL from Supabase Settings > API, like https://your-project-ref.supabase.co.'
    );
  }

  if (message.includes('Failed to fetch')) {
    return new Error('Could not reach Supabase. Check that VITE_SUPABASE_URL is the project API URL and redeploy.');
  }

  return error;
}

export function getReadableSupabaseError(error) {
  const normalizedError = normalizeSupabaseError(error);
  return normalizedError?.message || 'Something went wrong with Supabase.';
}

function throwSupabaseError(error) {
  if (error) throw normalizeSupabaseError(error);
}

function isInvalidPathError(error) {
  return (error?.message || String(error)).includes('Invalid path specified in request URL');
}

function getAuthApiError(data, fallback) {
  return data?.msg || data?.message || data?.error_description || data?.error || fallback;
}

async function authApiRequest(path, body) {
  assertSupabase();
  const response = await fetch(`${supabaseConfig.url}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: supabaseConfig.anonKey,
      Authorization: `Bearer ${supabaseConfig.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw normalizeSupabaseError(new Error(getAuthApiError(data, response.statusText)));
  }

  if (data?.session?.access_token && data?.session?.refresh_token) {
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }

  return data;
}

function getInitials(value = '') {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'L';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function slugUsername(name, email) {
  const source = name || email?.split('@')[0] || 'loopout';
  return source
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28) || 'loopout';
}

function startOfTodayIso() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function minutesBetween(start, end) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

export async function getAuthSession() {
  assertSupabase();
  const { data, error } = await supabase.auth.getSession();
  throwSupabaseError(error);
  return { session: data.session, user: data.session?.user || null };
}

export function subscribeToAuthChanges(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
  return () => data.subscription.unsubscribe();
}

export async function signUpWithEmail({ email, password, name, city }) {
  assertSupabase();
  let { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        city: city || 'Lisbon',
      },
    },
  });

  if (error && isInvalidPathError(error)) {
    data = await authApiRequest('signup', {
      email,
      password,
      data: {
        full_name: name,
        city: city || 'Lisbon',
      },
    });
    error = null;
  }

  throwSupabaseError(error);

  if (data.user && data.session) {
    await upsertProfile(data.user.id, {
      email,
      full_name: name,
      username: `${slugUsername(name, email)}_${data.user.id.slice(0, 5)}`,
      city: city || 'Lisbon',
    });
  }

  return data;
}

export async function signInWithEmail({ email, password }) {
  assertSupabase();
  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error && isInvalidPathError(error)) {
    data = await authApiRequest('token?grant_type=password', { email, password });
    error = null;
  }

  throwSupabaseError(error);
  return data;
}

export async function signOutUser() {
  assertSupabase();
  const { error } = await supabase.auth.signOut();
  throwSupabaseError(error);
}

export async function upsertProfile(userId, patch) {
  assertSupabase();
  const payload = {
    id: userId,
    updated_at: new Date().toISOString(),
    ...patch,
  };
  const { data, error } = await supabase.from('profiles').upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function fetchProfile(user) {
  assertSupabase();
  if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (data) return data;

  return upsertProfile(user.id, {
    email: user.email,
    full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'LoopOut user',
    username: `${slugUsername(user.user_metadata?.full_name, user.email)}_${user.id.slice(0, 5)}`,
    city: user.user_metadata?.city || 'Lisbon',
  });
}

export async function fetchActiveSession(userId) {
  assertSupabase();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'locked'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createSessionRecord(userId, draft) {
  assertSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      app_name: draft.appName,
      purpose: draft.purpose,
      timer_minutes: draft.timerMinutes,
      lock_minutes: draft.lockDurationMinutes,
      started_at: now,
      status: 'active',
      completed: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSessionRecord(sessionId, patch) {
  assertSupabase();
  const { data, error } = await supabase.from('sessions').update(patch).eq('id', sessionId).select().single();
  if (error) throw error;
  return data;
}

export async function upsertOfflineStatus(userId, patch) {
  assertSupabase();
  const payload = {
    user_id: userId,
    updated_at: new Date().toISOString(),
    ...patch,
  };
  const { data, error } = await supabase
    .from('offline_status')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchPlaces() {
  assertSupabase();
  const { data, error } = await supabase
    .from('phone_free_places')
    .select('*')
    .eq('city', 'Lisbon')
    .order('phone_free_score', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchFriends(userId) {
  assertSupabase();
  const { data: friendships, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const accepted = (friendships || []).filter((item) => item.status === 'accepted');
  const pending = (friendships || []).filter((item) => item.status === 'pending');
  const friendIds = accepted.map((item) => (item.requester_id === userId ? item.receiver_id : item.requester_id));
  const requestIds = pending.map((item) => (item.requester_id === userId ? item.receiver_id : item.requester_id));
  const ids = [...new Set([...friendIds, ...requestIds])];

  if (ids.length === 0) return { friends: [], requests: [] };

  const [{ data: profiles, error: profilesError }, { data: statuses, error: statusesError }] = await Promise.all([
    supabase.from('profiles').select('*').in('id', ids),
    supabase.from('offline_status').select('*').in('user_id', ids),
  ]);

  if (profilesError) throw profilesError;
  if (statusesError) throw statusesError;

  const profileById = new Map((profiles || []).map((item) => [item.id, item]));
  const statusById = new Map((statuses || []).map((item) => [item.user_id, item]));
  const friends = accepted
    .map((item) => {
      const otherId = item.requester_id === userId ? item.receiver_id : item.requester_id;
      return {
        friendship: item,
        profile: profileById.get(otherId),
        offlineStatus: statusById.get(otherId) || null,
      };
    })
    .filter((item) => item.profile);

  const requests = pending
    .map((item) => {
      const otherId = item.requester_id === userId ? item.receiver_id : item.requester_id;
      return {
        friendship: item,
        profile: profileById.get(otherId),
        direction: item.requester_id === userId ? 'sent' : 'received',
      };
    })
    .filter((item) => item.profile);

  return { friends, requests };
}

export async function searchProfiles(query, currentUserId) {
  assertSupabase();
  const safeQuery = query.trim();
  if (safeQuery.length < 2) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, email, avatar_url, city, area, allow_friend_requests, hide_profile_from_search')
    .neq('id', currentUserId)
    .eq('allow_friend_requests', true)
    .eq('hide_profile_from_search', false)
    .or(`username.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,full_name.ilike.%${safeQuery}%`)
    .limit(8);
  if (error) throw error;
  return data || [];
}

export async function sendFriendRequest(requesterId, receiverId) {
  assertSupabase();
  const { data, error } = await supabase
    .from('friendships')
    .insert({ requester_id: requesterId, receiver_id: receiverId, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function respondToFriendRequest(friendshipId, status) {
  assertSupabase();
  const { data, error } = await supabase
    .from('friendships')
    .update({ status })
    .eq('id', friendshipId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchInvites(userId) {
  assertSupabase();
  const { data, error } = await supabase
    .from('offline_invites')
    .select(
      '*, place:phone_free_places(*), sender:profiles!offline_invites_sender_id_fkey(id, full_name, username, email, area, city), receiver:profiles!offline_invites_receiver_id_fkey(id, full_name, username, email, area, city)'
    )
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createInviteRecord({ senderId, receiverId, placeId, suggestedTime, message }) {
  assertSupabase();
  const { data, error } = await supabase
    .from('offline_invites')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      place_id: placeId,
      suggested_time: suggestedTime,
      message,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function respondToInvite(inviteId, status) {
  assertSupabase();
  const { data, error } = await supabase.from('offline_invites').update({ status }).eq('id', inviteId).select().single();
  if (error) throw error;
  return data;
}

export async function createScreenTimeLog(userId, log) {
  assertSupabase();
  const { data, error } = await supabase
    .from('manual_screen_time_logs')
    .upsert(
      {
        user_id: userId,
        date: log.date,
        total_screen_time_minutes: Number(log.totalScreenTimeMinutes) || 0,
        social_media_minutes: Number(log.socialMediaMinutes) || 0,
        most_used_app: log.mostUsedApp || null,
        notes: log.notes || null,
      },
      { onConflict: 'user_id,date' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchScreenTimeLogs(userId) {
  assertSupabase();
  const { data, error } = await supabase
    .from('manual_screen_time_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(14);
  if (error) throw error;
  return data || [];
}

export async function fetchProgressSnapshot(userId) {
  assertSupabase();
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const [sessionsResult, invitesResult] = await Promise.all([
    supabase.from('sessions').select('*').eq('user_id', userId).gte('started_at', since.toISOString()),
    supabase.from('offline_invites').select('*').eq('sender_id', userId).gte('created_at', since.toISOString()),
  ]);

  if (sessionsResult.error) throw sessionsResult.error;
  if (invitesResult.error) throw invitesResult.error;

  const sessions = sessionsResult.data || [];
  const invites = invitesResult.data || [];
  const completedSessions = sessions.filter((item) => item.completed || item.status === 'completed');
  const todaySessions = sessions.filter((item) => item.started_at >= startOfTodayIso());
  const appCounts = sessions.reduce((acc, item) => {
    acc[item.app_name] = (acc[item.app_name] || 0) + 1;
    return acc;
  }, {});
  const totalAppSessions = Object.values(appCounts).reduce((sum, value) => sum + value, 0) || 1;
  const sessionsByApp = Object.entries(appCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, value: Math.round((count / totalAppSessions) * 100) }));
  const purposeWords = sessions
    .flatMap((item) => (item.purpose || '').toLowerCase().match(/[a-z0-9]{4,}/g) || [])
    .filter((word) => !['with', 'from', 'then', 'this', 'that', 'para', 'mais'].includes(word));
  const purposeCounts = purposeWords.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});

  const weeklySaved = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(since);
    date.setDate(since.getDate() + index);
    const key = dayKey(date);
    return sessions
      .filter((item) => dayKey(new Date(item.started_at)) === key)
      .reduce((sum, item) => sum + Number(item.lock_minutes || 0), 0);
  });

  const daysWithSessions = new Set(completedSessions.map((item) => dayKey(new Date(item.started_at))));
  let currentStreak = 0;
  for (let offset = 0; offset < 30; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    if (!daysWithSessions.has(dayKey(date))) break;
    currentStreak += 1;
  }

  const totalIntentionalMinutes = completedSessions.reduce(
    (sum, item) => sum + minutesBetween(item.started_at, item.ended_at),
    0
  );
  const totalLockMinutes = completedSessions.reduce((sum, item) => sum + Number(item.lock_minutes || 0), 0);
  const todayIntentionalMinutes = todaySessions.reduce(
    (sum, item) => sum + (item.status === 'active' ? Number(item.timer_minutes || 0) : minutesBetween(item.started_at, item.ended_at)),
    0
  );
  const todayLockMinutes = todaySessions.reduce((sum, item) => sum + Number(item.lock_minutes || 0), 0);
  const acceptedInvites = invites.filter((item) => item.status === 'accepted').length;

  return {
    completedSessions: completedSessions.length,
    totalIntentionalMinutes,
    totalLockMinutes,
    mostUsedApp: sessionsByApp[0]?.label || 'None yet',
    mostCommonPurpose: Object.entries(purposeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None yet',
    weeklySaved,
    currentStreak,
    invitesSent: invites.length,
    invitesAccepted: acceptedInvites,
    estimatedTimeSaved: totalLockMinutes,
    sessionsByApp,
    today: {
      completedSessions: todaySessions.filter((item) => item.completed || item.status === 'completed').length,
      intentionalMinutes: todayIntentionalMinutes,
      lockMinutes: todayLockMinutes,
    },
  };
}

export { getInitials };
