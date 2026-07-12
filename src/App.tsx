// App.tsx — RealityDB SimLab platform shell.
// Clean hash-routed SPA: home / data-store / simlab / discover / pricing.
// 'discover' is the Knowledge Discovery layer (Experiments/Visualizations/
// SQL/Profiles lenses); 'gallery' remains as a legacy alias so pre-existing
// #gallery/<slug> links keep resolving unchanged.
// Copied product components (DataStorePage, SimLabPage) are used UNMODIFIED —
// App adapts to their existing prop signatures (onClose / onGallery).

import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SimLabHomePage } from './components/SimLabHomePage';
import { SimLabPricingPage } from './components/SimLabPricingPage';
import { DataStorePage } from './components/DataStorePage';
import { SimLabPage } from './components/SimLabPage';
import { GalleryPage } from './components/GalleryPage';
import { ProfilePage } from './components/ProfilePage';
import { DiscoverPage, DISCOVER_LENSES, type DiscoverLens } from './components/DiscoverPage';

type Route = 'home' | 'data-store' | 'simlab' | 'gallery' | 'pricing' | 'profile' | 'discover';

const ROUTES: Route[] = ['home', 'data-store', 'simlab', 'gallery', 'pricing', 'profile', 'discover'];

function routeFromHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '').split('/')[0] as Route;
  return ROUTES.includes(h) ? h : 'home';
}

function gallerySlugFromHash(): string | null {
  const h = window.location.hash;
  return h.startsWith('#gallery/') ? decodeURIComponent(h.slice('#gallery/'.length)) : null;
}

// #discover/<lens>[/<rest>] — a fixed whitelist of lenses is checked first;
// an unrecognized first segment falls back to the 'experiments' lens so a
// bare '#discover' still lands somewhere sensible.
function discoverPathFromHash(): { lens: DiscoverLens; rest: string | null } {
  const h = window.location.hash;
  if (!h.startsWith('#discover/') && h !== '#discover') return { lens: 'experiments', rest: null };
  const parts = h.replace(/^#discover\/?/, '').split('/').filter(Boolean);
  const lens = (DISCOVER_LENSES as string[]).includes(parts[0]) ? (parts[0] as DiscoverLens) : 'experiments';
  const rest = parts.slice(1).join('/');
  return { lens, rest: rest ? decodeURIComponent(rest) : null };
}

const NAV_ITEMS: { id: Route; label: string }[] = [
  { id: 'data-store', label: 'Data Store' },
  { id: 'simlab', label: 'SimLab' },
  { id: 'discover', label: 'Discover' },
  { id: 'pricing', label: 'Pricing' },
];

function Navbar({
  current,
  onNavigate,
}: {
  current: Route;
  onNavigate: (r: Route) => void;
}) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
        {/* Brand → home */}
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2"
          aria-label="RealityDB SimLab home"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-purple text-sm font-bold text-black">
            R
          </span>
          <span className="text-sm font-semibold text-white">
            RealityDB <span className="text-accent">SimLab</span>
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="ml-auto hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                current === item.id
                  ? 'text-accent'
                  : 'text-[var(--muted)] hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
          {user && (
            <button
              onClick={() => onNavigate('profile')}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                current === 'profile' ? 'text-accent' : 'text-[var(--muted)] hover:text-white'
              }`}
            >
              Profile
            </button>
          )}
          <button
            onClick={() => onNavigate('simlab')}
            className="ml-2 rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Launch a Lab
          </button>
        </nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="ml-auto text-[var(--muted)] hover:text-white sm:hidden"
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
            />
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t border-[var(--border)] bg-bg px-6 py-3 sm:hidden">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setMobileOpen(false);
              }}
              className={`block w-full py-2 text-left text-sm ${
                current === item.id ? 'text-accent' : 'text-[var(--muted)]'
              }`}
            >
              {item.label}
            </button>
          ))}
          {user && (
            <button
              onClick={() => { onNavigate('profile'); setMobileOpen(false); }}
              className={`block w-full py-2 text-left text-sm ${current === 'profile' ? 'text-accent' : 'text-[var(--muted)]'}`}
            >
              Profile
            </button>
          )}
        </nav>
      )}
    </header>
  );
}

function Shell() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [routeParams, setRouteParams] = useState<Record<string, unknown>>({});
  const [gallerySlug, setGallerySlug] = useState<string | null>(gallerySlugFromHash);
  const [discoverPath, setDiscoverPath] = useState(discoverPathFromHash);

  const navigate = useCallback((r: Route, params?: Record<string, unknown>) => {
    window.location.hash = r === 'home' ? '' : r === 'discover' ? 'discover/experiments' : r;
    setRoute(r);
    setRouteParams(params ?? {});
    setGallerySlug(null);
    window.scrollTo({ top: 0 });
  }, []);

  // Sync with browser back/forward + manual hash edits.
  useEffect(() => {
    const onHash = () => {
      setRoute(routeFromHash());
      setGallerySlug(gallerySlugFromHash());
      setDiscoverPath(discoverPathFromHash());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // DataStorePage, SimLabPage, GalleryPage, and DiscoverPage are full-screen
  // fixed overlays with their own headers; they cover the navbar by design.
  // Home/Pricing render under it.
  const showNavbar = route === 'home' || route === 'pricing';

  return (
    <div className="min-h-screen bg-bg">
      {showNavbar && <Navbar current={route} onNavigate={navigate} />}

      {route === 'home' && <SimLabHomePage onNavigate={navigate} />}
      {route === 'pricing' && <SimLabPricingPage />}
      {route === 'data-store' && (
        <DataStorePage
          onClose={() => navigate('home')}
          onNavigate={(r, params) => navigate(r as Route, params)}
        />
      )}
      {/* Legacy alias — #gallery/<slug> links shared before the Discover
          layer shipped keep resolving here unchanged. */}
      {route === 'gallery' && <GalleryPage onClose={() => navigate('home')} slug={gallerySlug ?? undefined} />}
      {route === 'discover' && (
        <DiscoverPage
          lens={discoverPath.lens}
          rest={discoverPath.rest}
          onClose={() => navigate('home')}
          onNavigate={(lens, rest) => {
            window.location.hash = `#discover/${lens}${rest ? '/' + encodeURIComponent(rest) : ''}`;
            setDiscoverPath({ lens, rest: rest ?? null });
            window.scrollTo({ top: 0 });
          }}
        />
      )}
      {route === 'simlab' && (
        <SimLabPage
          onClose={() => navigate('home')}
          onGallery={() => navigate('discover')}
          preloadTemplate={routeParams.template as string | undefined}
          preloadRows={routeParams.rows as number | undefined}
        />
      )}
      {route === 'profile' && (
        <ProfilePage
          onClose={() => navigate('home')}
          onOpenExperiment={(slug) => {
            window.location.hash = `#gallery/${slug}`;
            setRoute('gallery');
            setGallerySlug(slug);
            window.scrollTo({ top: 0 });
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
