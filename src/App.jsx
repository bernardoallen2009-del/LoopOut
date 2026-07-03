import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  CircleUserRound,
  Compass,
  Copy,
  Heart,
  Home,
  Library,
  LockKeyhole,
  MapPin,
  PauseCircle,
  Play,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Timer,
  Trees,
  Users,
  X,
} from 'lucide-react';
import { isSupabaseConfigured } from './lib/supabase';
import {
  appOptions,
  demoFriends,
  lisbonPlaces,
  lockDurations,
  onboardingSlides,
  purposeExamples,
  quickTimers,
  sessionsByApp,
  setupSteps,
  weeklySaved,
} from './data';

const storageKeys = {
  profile: 'loopout.profile',
  settings: 'loopout.settings',
  session: 'loopout.session',
  draft: 'loopout.sessionDraft',
  invites: 'loopout.invites',
  onboarded: 'loopout.onboarded',
};

const defaultProfile = {
  name: 'Bernardo',
  email: 'bernardo@example.com',
  city: 'Lisbon',
  avatar: 'B',
};

const defaultSettings = {
  defaultTimer: 10,
  defaultLock: 30,
  distractingApps: ['TikTok', 'Instagram', 'YouTube Shorts'],
  showOfflineStatus: true,
  showLockedApp: true,
  allowInvites: true,
  shareArea: true,
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
  if (place.coordinates) {
    return `https://www.google.com/maps/search/?api=1&query=${place.coordinates.lat},${place.coordinates.lng}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, Lisbon`)}`;
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
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] text-sm font-bold text-white"
        style={{ backgroundColor: app.tone }}
      >
        {app.glyph}
      </div>
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

function FriendCard({ friend, onInvite, privacyOn }) {
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
              {friend.available ? 'Available' : 'Offline'}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{friend.status}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
            <span className="rounded-full bg-soft px-2.5 py-1">{privacyOn ? friend.lockedApp : 'App hidden'}</span>
            <span className="rounded-full bg-soft px-2.5 py-1">{friend.area}</span>
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

function PhoneFreeMap({ places }) {
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

    points.forEach((place) => {
      L.marker([place.coordinates.lat, place.coordinates.lng], { icon: markerIcon })
        .bindPopup(
          `<strong>${place.name}</strong><br/><span>${place.area}</span><br/><small>${place.activity}</small>`
        )
        .addTo(markerLayerRef.current);
    });

    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((place) => [place.coordinates.lat, place.coordinates.lng]));
      mapRef.current.fitBounds(bounds, { padding: [26, 26], maxZoom: 13 });
    } else if (points.length === 1) {
      mapRef.current.setView([points[0].coordinates.lat, points[0].coordinates.lng], 14);
    }
  }, [places, status]);

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

function InviteModal({ friend, place, onClose, onSend }) {
  const [selectedFriend, setSelectedFriend] = useState(friend?.id || demoFriends[0].id);
  const [selectedPlace, setSelectedPlace] = useState(place?.id || lisbonPlaces[0].id);
  const [time, setTime] = useState('Now');
  const [message, setMessage] = useState('Hey, we both finished our screen time. Want to go offline together?');

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
          <label className="block">
            <span className="text-sm font-medium text-ink">Choose friend</span>
            <select
              className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-3 text-sm text-ink outline-none focus:border-primary"
              value={selectedFriend}
              onChange={(event) => setSelectedFriend(event.target.value)}
            >
              {demoFriends.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Choose place</span>
            <select
              className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-3 text-sm text-ink outline-none focus:border-primary"
              value={selectedPlace}
              onChange={(event) => setSelectedPlace(event.target.value)}
            >
              {lisbonPlaces.map((item) => (
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
          onClick={() => onSend({ friendId: selectedFriend, placeId: selectedPlace, time, message })}
        >
          Send invite
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
          <div className="flex items-center justify-between">
            <BrandMark compact />
            <span className="rounded-full bg-[#E8F8EF] px-2.5 py-1 text-xs font-semibold text-[#137A3D]">Live</span>
          </div>
          <div className="mt-5 rounded-lg border border-line bg-white p-3">
            <p className="text-xs font-medium text-muted">Purpose</p>
            <p className="mt-1 text-sm font-semibold text-ink">Reply to one message</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-soft p-3">
              <p className="text-xs text-muted">Timer</p>
              <p className="mt-1 text-2xl font-semibold text-deep">10:00</p>
            </div>
            <div className="rounded-lg bg-[#F3F7FB] p-3">
              <p className="text-xs text-muted">Lock</p>
              <p className="mt-1 text-2xl font-semibold text-ink">30m</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-deep p-3 text-white">
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4" />
              <p className="text-sm font-semibold">Instagram locked</p>
            </div>
            <p className="mt-1 text-xs text-white/75">Take 30 minutes away from the loop.</p>
          </div>
          <div className="mt-3 space-y-2">
            {['Tomas offline', 'Maria nearby', 'Gulbenkian walk'].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg bg-white p-2 shadow-sm">
                <div className="h-7 w-7 rounded-full bg-soft" />
                <span className="text-xs font-medium text-ink">{item}</span>
              </div>
            ))}
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
        <HeroPhone />
        <div className="relative z-10 mx-auto flex min-h-[88vh] max-w-3xl flex-col items-center justify-center px-4 pb-10 pt-28 text-center">
          <p className="mb-4 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-deep shadow-sm">
            Turn screen time into real-life connection.
          </p>
          <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-normal text-ink sm:text-7xl">
            Break the scroll loop.
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-muted">
            LoopOut helps you open distracting apps with purpose, set a timer, and reconnect with friends offline when
            the time ends.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button icon={Play} onClick={() => navigate('/onboarding')}>
              Start LoopOut
            </Button>
            <Button variant="secondary" icon={Compass} onClick={() => navigate('/setup-iphone')}>
              How it works
            </Button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pb-20">
        <section className="grid gap-4 py-12 md:grid-cols-2">
          <InfoPanel
            eyebrow="The Problem"
            title="Young adults are losing focus, sleep and real connection in an always-online world."
            icon={Bell}
          />
          <InfoPanel
            eyebrow="The Solution"
            title="LoopOut adds a pause before scrolling."
            body="Write a purpose, choose a limit, and let the end of screen time become the beginning of something real."
            icon={ShieldCheck}
          />
        </section>

        <section className="py-12">
          <SectionTitle eyebrow="How it works" title="A calmer path from impulse to intention." />
          <div className="mt-6 grid gap-3 md:grid-cols-5">
            {['Choose an app', 'Write your purpose', 'Set a timer', 'Lock the loop', 'Meet offline'].map((item, index) => (
              <div className="rounded-lg border border-line bg-white p-4 shadow-sm" key={item}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-soft text-sm font-semibold text-deep">
                  {index + 1}
                </span>
                <p className="mt-4 font-semibold text-ink">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-12">
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

        <section className="rounded-lg border border-line bg-white p-6 text-center shadow-soft sm:p-10">
          <h2 className="text-3xl font-semibold text-ink">Create your first LoopOut session.</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Start with one app, one purpose and one limit. The rest can become a habit.
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

function AuthPage({ navigate, profile, setProfile }) {
  const [mode, setMode] = useState('signup');
  const [form, setForm] = useState({
    name: profile.name || '',
    email: profile.email || '',
    password: '',
    city: profile.city || 'Lisbon',
  });

  const submit = (event) => {
    event.preventDefault();
    const name = form.name.trim() || 'Bernardo';
    setProfile({
      name,
      email: form.email.trim() || 'bernardo@example.com',
      city: form.city.trim() || 'Lisbon',
      avatar: name.charAt(0).toUpperCase(),
    });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-canvas px-4 py-[calc(env(safe-area-inset-top)+24px)] text-ink">
      <div className="mx-auto max-w-md">
        <button type="button" className="mb-8" onClick={() => navigate('/')}>
          <BrandMark />
        </button>
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">
            {isSupabaseConfigured ? 'Supabase Auth ready' : 'Demo mode'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">
            {mode === 'signup' ? 'Create your LoopOut account.' : 'Welcome back.'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {isSupabaseConfigured
              ? 'This build can connect to Supabase with the configured project keys.'
              : 'Your profile is saved locally for the product demo.'}
          </p>
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
            <Button className="w-full" icon={ArrowRight} onClick={submit}>
              {mode === 'signup' ? 'Sign up' : 'Log in'}
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

function Dashboard({ navigate, profile, session, now }) {
  const active = session?.status === 'active';
  const locked = session?.status === 'locked';
  const currentApp = session ? getAppById(session.appId) : null;
  const remaining = active ? session.endsAt - now : locked ? session.lockEndsAt - now : 0;

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
          {[
            ['Intentional sessions', '3'],
            ['Time saved', '42 min'],
            ['Apps locked', '2'],
            ['Friends offline', '4'],
          ].map(([label, value]) => (
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
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] text-sm font-bold text-white"
            style={{ backgroundColor: app.tone }}
          >
            {app.glyph}
          </div>
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
          <div
            className="grid h-12 w-12 place-items-center rounded-[12px] text-sm font-bold text-white"
            style={{ backgroundColor: app.tone }}
          >
            {app.glyph}
          </div>
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

function ActiveTimerPage({ navigate, session, setSession, now }) {
  if (!session || session.status !== 'active') {
    return <EmptyState navigate={navigate} title="No active timer" action="Start a session" path="/session/select-app" />;
  }

  const app = getAppById(session.appId);
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
    navigate('/session/locked');
  };

  return (
    <>
      <PageHeader title="Session active" subtitle="Stay with your purpose." navigate={navigate} backTo="/dashboard" />
      <section className="rounded-lg border border-line bg-white p-5 text-center shadow-soft">
        <div
          className="mx-auto grid h-14 w-14 place-items-center rounded-[14px] text-sm font-bold text-white"
          style={{ backgroundColor: app.tone }}
        >
          {app.glyph}
        </div>
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

  const app = getAppById(session.appId);
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

function FriendsPage({ navigate, settings, openInvite }) {
  const [filter, setFilter] = useState('Available now');
  const filteredFriends = demoFriends.filter((friend) => {
    if (filter === 'Available now') return friend.available;
    if (filter === 'Nearby') return ['Campo Grande', 'Saldanha', 'Chiado'].includes(friend.area);
    if (filter === 'Same school/university') return friend.school.includes('Universidade') || friend.school === 'IST';
    return true;
  });

  return (
    <>
      <PageHeader title="Friends also offline" subtitle="You're not disconnecting alone." navigate={navigate} backTo="/dashboard" />
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
      <div className="space-y-3">
        {filteredFriends.map((friend) => (
          <FriendCard
            friend={friend}
            key={friend.id}
            privacyOn={settings.showLockedApp}
            onInvite={(item) => openInvite(item, null)}
          />
        ))}
      </div>
      <p className="mt-4 rounded-lg bg-soft p-3 text-sm leading-6 text-deep">
        Privacy is adjustable in settings. Friends only see your offline status, area and app details when you allow it.
      </p>
    </>
  );
}

function PlacesPage({ navigate, openInvite }) {
  const [category, setCategory] = useState('All');
  const categories = ['All', 'Public gardens', 'Parks & gardens', 'Libraries', 'Study spots', 'Cafes', 'Cultural spaces'];
  const places = category === 'All' ? lisbonPlaces : lisbonPlaces.filter((place) => place.type === category);

  return (
    <>
      <PageHeader title="Phone-free places in Lisbon" subtitle="Meet, study, walk or talk without the scroll." navigate={navigate} backTo="/dashboard" />
      <div className="mb-4 rounded-lg border border-line bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-soft text-primary">
            <Compass className="h-5 w-5" />
          </div>
          <p className="text-sm leading-6 text-muted">
            These are suggested places for phone-free moments, not official phone-free zones yet.
          </p>
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
      <PhoneFreeMap places={places} />
      <div className="space-y-3">
        {places.map((place) => (
          <PlaceCard place={place} key={place.id} onInvite={openInvite} />
        ))}
      </div>
    </>
  );
}

function ProgressPage({ navigate, session, invites }) {
  const completedBonus = session?.status === 'completed' ? 1 : 0;
  const inviteCount = invites.length;

  return (
    <>
      <PageHeader title="Progress" subtitle="Small pauses become visible change." navigate={navigate} backTo="/dashboard" />
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h1 className="text-2xl font-semibold text-ink">You saved 2h 15m from scrolling this week.</h1>
        <p className="mt-2 text-sm leading-6 text-muted">You chose purpose over autopilot 12 times.</p>
        <p className="mt-2 text-sm leading-6 text-muted">You created {Math.max(3, inviteCount)} offline moments.</p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Sessions completed" value={12 + completedBonus} icon={CheckCircle2} />
        <StatCard label="Total time saved" value="2h 15m" icon={Timer} />
        <StatCard label="Locks completed" value={8 + completedBonus} icon={LockKeyhole} />
        <StatCard label="Purposes written" value={14 + completedBonus} icon={BookOpen} />
        <StatCard label="Offline invites sent" value={Math.max(3, inviteCount)} icon={Users} />
        <StatCard label="Meetups accepted" value="2" icon={Heart} />
      </div>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">Weekly time saved</h2>
          <span className="text-sm text-muted">minutes</span>
        </div>
        <div className="mt-5 flex h-36 items-end gap-2">
          {weeklySaved.map((value, index) => (
            <div className="flex flex-1 flex-col items-center gap-2" key={index}>
              <div
                className="w-full rounded-t-lg bg-primary"
                style={{ height: `${Math.max(18, (value / 42) * 100)}%`, opacity: 0.42 + index * 0.07 }}
              />
              <span className="text-[11px] text-muted">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Sessions by app</h2>
        <div className="mt-5 space-y-4">
          {sessionsByApp.map((item) => (
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
      </section>

      <section className="mt-4 grid gap-3 pb-2">
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="text-sm text-muted">Current streak</p>
          <p className="mt-1 text-2xl font-semibold text-ink">5 days</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="text-sm text-muted">Average session length</p>
          <p className="mt-1 text-2xl font-semibold text-ink">11 min</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="text-sm text-muted">Most blocked app</p>
          <p className="mt-1 text-2xl font-semibold text-ink">Instagram</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="text-sm text-muted">Most common purpose</p>
          <p className="mt-1 text-2xl font-semibold text-ink">Reply to one message</p>
        </div>
      </section>
    </>
  );
}

function SettingsPage({ navigate, profile, setProfile, settings, setSettings }) {
  const [copied, setCopied] = useState(false);
  const loopoutUrl = `${window.location.origin}/session/select-app`;

  const updateProfile = (key, value) => {
    const next = { ...profile, [key]: value };
    if (key === 'name') next.avatar = value.charAt(0).toUpperCase() || 'B';
    setProfile(next);
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
        <Field label="Email" type="email" value={profile.email} onChange={(value) => updateProfile('email', value)} />
        <Field label="City" value={profile.city} onChange={(value) => updateProfile('city', value)} />
        <div className="flex items-center gap-3 rounded-lg bg-canvas p-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-white font-semibold text-deep shadow-sm">
            {profile.avatar}
          </div>
          <p className="text-sm text-muted">Avatar initials update from your name.</p>
        </div>
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
          onChange={(value) => setSettings({ ...settings, showOfflineStatus: value })}
        />
        <ToggleRow
          label="Show locked app name"
          checked={settings.showLockedApp}
          onChange={(value) => setSettings({ ...settings, showLockedApp: value })}
        />
        <ToggleRow
          label="Allow offline invites"
          checked={settings.allowInvites}
          onChange={(value) => setSettings({ ...settings, allowInvites: value })}
        />
        <ToggleRow
          label="Share area/neighbourhood"
          checked={settings.shareArea}
          onChange={(value) => setSettings({ ...settings, shareArea: value })}
        />
      </SettingsGroup>

      <SettingsGroup title="iPhone Automation Setup" icon={Smartphone}>
        <Button className="w-full" variant="soft" icon={Copy} onClick={copyUrl}>
          {copied ? 'Copied' : 'Copy LoopOut URL'}
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
        <PageHeader title="Setup iPhone Automation" subtitle="Open LoopOut before distracting apps." navigate={navigate} backTo="/" />
        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="grid h-14 w-14 place-items-center rounded-[16px] bg-soft text-primary">
            <Smartphone className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-semibold leading-tight text-ink">Connect LoopOut to Shortcuts.</h1>
          <p className="mt-3 leading-7 text-muted">
            Whenever you open a selected app, iPhone can open LoopOut first so you write a purpose and set a timer.
          </p>
          <Button className="mt-5 w-full" variant="soft" icon={Copy} onClick={copyUrl}>
            {copied ? 'Copied' : 'Copy LoopOut URL'}
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
  const [, setOnboarded] = useLocalStorage(storageKeys.onboarded, false);
  const [inviteModal, setInviteModal] = useState(null);
  const [inviteToast, setInviteToast] = useState(false);

  useEffect(() => {
    if (!session) return;
    if (session.status === 'active' && now >= session.endsAt) {
      const lockStartedAt = session.endsAt;
      setSession({
        ...session,
        status: 'locked',
        endedAt: session.endsAt,
        lockStartedAt,
        lockEndsAt: lockStartedAt + minutesToMs(session.lockDurationMinutes),
      });
      if (path !== '/session/locked') navigate('/session/locked');
    }
    if (session.status === 'locked' && now >= session.lockEndsAt) {
      setSession({
        ...session,
        status: 'completed',
        completedAt: session.lockEndsAt,
      });
    }
  }, [navigate, now, path, session, setSession]);

  const startSession = (nextDraft) => {
    const startedAt = Date.now();
    const nextSession = {
      id: crypto.randomUUID(),
      appId: nextDraft.appId,
      purpose: nextDraft.purpose.trim(),
      timerMinutes: nextDraft.timerMinutes,
      lockDurationMinutes: nextDraft.lockDurationMinutes,
      startedAt,
      endsAt: startedAt + minutesToMs(nextDraft.timerMinutes),
      status: 'active',
    };
    setSession(nextSession);
    setDraft({ ...nextDraft, purpose: '' });
    navigate('/session/active');
  };

  const openInvite = (friend = null, place = null) => {
    setInviteModal({ friend, place });
  };

  const sendInvite = (invite) => {
    setInvites([
      {
        id: crypto.randomUUID(),
        ...invite,
        status: 'sent',
        createdAt: Date.now(),
      },
      ...invites,
    ]);
    setInviteModal(null);
    setInviteToast(true);
    window.setTimeout(() => setInviteToast(false), 2600);
  };

  const content = useMemo(() => {
    if (path === '/') return <Landing navigate={navigate} />;
    if (path === '/onboarding') return <Onboarding navigate={navigate} setOnboarded={setOnboarded} />;
    if (path === '/login') return <AuthPage navigate={navigate} profile={profile} setProfile={setProfile} />;
    if (path === '/setup-iphone') return <SetupPage navigate={navigate} />;

    const shellPage = (() => {
      if (path === '/dashboard') return <Dashboard navigate={navigate} profile={profile} session={session} now={now} />;
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
        return <ActiveTimerPage navigate={navigate} session={session} setSession={setSession} now={now} />;
      }
      if (path === '/session/locked') {
        return <LockedPage navigate={navigate} session={session} now={now} />;
      }
      if (path === '/friends') return <FriendsPage navigate={navigate} settings={settings} openInvite={openInvite} />;
      if (path === '/places') return <PlacesPage navigate={navigate} openInvite={openInvite} />;
      if (path === '/progress') return <ProgressPage navigate={navigate} session={session} invites={invites} />;
      if (path === '/settings') {
        return (
          <SettingsPage
            navigate={navigate}
            profile={profile}
            setProfile={setProfile}
            settings={settings}
            setSettings={setSettings}
          />
        );
      }
      return <Dashboard navigate={navigate} profile={profile} session={session} now={now} />;
    })();

    return (
      <AppShell navigate={navigate} path={path} session={session}>
        {shellPage}
      </AppShell>
    );
  }, [
    draft,
    invites,
    navigate,
    now,
    path,
    profile,
    session,
    setDraft,
    setOnboarded,
    setProfile,
    setSession,
    setSettings,
    settings,
  ]);

  return (
    <>
      {content}
      {inviteModal ? (
        <InviteModal
          friend={inviteModal.friend}
          place={inviteModal.place}
          onClose={() => setInviteModal(null)}
          onSend={sendInvite}
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
