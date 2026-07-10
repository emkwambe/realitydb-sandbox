// App.tsx — RealityDB SimLab platform shell.
// Clean hash-routed SPA: home / data-store / simlab / pricing.
// Copied product components (DataStorePage, SimLabPage) are used UNMODIFIED —
// App adapts to their existing prop signatures (onClose / onGallery).

import { useState, useEffect, useCallback } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { SimLabHomePage } from './components/SimLabHomePage';
import { SimLabPricingPage } from './components/SimLabPricingPage';
import { DataStorePage } from './components/DataStorePage';
import { SimLabPage } from './components/SimLabPage';

type Route = 'home' | 'data-store' | 'simlab' | 'pricing';

const ROUTES: Route[] = ['home', 'data-store', 'simlab', 'pricing'];

function routeFromHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(h) ? h : 'home';
}

const NAV_ITEMS: { id: Route; label: string }[] = [
  { id: 'data-store', label: 'Data Store' },
  { id: 'simlab', label: 'SimLab' },
  { id: 'pricing', label: 'Pricing' },
];

function Navbar({
  current,
  onNavigate,
}: {
  current: Route;
  onNavigate: (r: Route) => void;
}) {
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
        </nav>
      )}
    </header>
  );
}

function Shell() {
  const [route, setRoute] = useState<Route>(routeFromHash);

  const navigate = useCallback((r: Route) => {
    window.location.hash = r === 'home' ? '' : r;
    setRoute(r);
    window.scrollTo({ top: 0 });
  }, []);

  // Sync with browser back/forward + manual hash edits.
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // DataStorePage and SimLabPage are full-screen fixed overlays with their own
  // headers; they cover the navbar by design. Home/Pricing render under the navbar.
  const showNavbar = route === 'home' || route === 'pricing';

  return (
    <div className="min-h-screen bg-bg">
      {showNavbar && <Navbar current={route} onNavigate={navigate} />}

      {route === 'home' && <SimLabHomePage onNavigate={navigate} />}
      {route === 'pricing' && <SimLabPricingPage />}
      {route === 'data-store' && <DataStorePage onClose={() => navigate('home')} />}
      {route === 'simlab' && (
        // TODO(gallery): No GalleryPage component was copied into this repo, so
        // "Lab Gallery" points at the SimLab tab (which lists active labs) as the
        // closest equivalent. Add a 'gallery' route + GalleryPage and swap this to
        // navigate('gallery') once the gallery view is brought over.
        <SimLabPage
          onClose={() => navigate('home')}
          onGallery={() => navigate('simlab')}
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
