import { useEffect } from 'react';
import { VisualizationDiscoveryView } from './VisualizationDiscoveryView';
import { SqlDiscoveryView } from './SqlDiscoveryView';
import { ProfilesDiscoveryView, PublicProfileView } from './PublicProfileView';
import { DiscoveryLanding } from './DiscoveryLanding';

export type DiscoverLens = 'experiments' | 'visualizations' | 'sql' | 'profiles' | 'dashboards' | 'notebooks' | 'organizations';

export const DISCOVER_LENSES: DiscoverLens[] = ['experiments', 'visualizations', 'sql', 'profiles', 'dashboards', 'notebooks', 'organizations'];

const LENS_LABELS: { id: DiscoverLens; label: string; soon?: boolean }[] = [
  { id: 'experiments', label: 'Experiments' },
  { id: 'visualizations', label: 'Visualizations' },
  { id: 'sql', label: 'SQL' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'dashboards', label: 'Dashboards', soon: true },
  { id: 'notebooks', label: 'Notebooks', soon: true },
  { id: 'organizations', label: 'Organizations', soon: true },
];

const COMING_SOON_COPY: Record<'dashboards' | 'notebooks' | 'organizations', { title: string; body: string }> = {
  dashboards: { title: 'Dashboards — coming soon', body: 'Multi-visualization dashboards composed from Experiment evidence are on the roadmap.' },
  notebooks: { title: 'Notebooks — coming soon', body: "A notebook-style view of an Experiment's method and evidence is on the roadmap." },
  organizations: { title: 'Organizations — coming soon', body: 'Organization profiles will aggregate published work across a team, once workspaces mature.' },
};

function DiscoverNav({ current, onNavigate, onClose }: { current: DiscoverLens; onNavigate: (lens: DiscoverLens) => void; onClose: () => void }) {
  return (
    <div className="border-b border-[var(--border)] bg-bg-elevated shrink-0">
      <div className="h-12 flex items-center px-4 gap-3">
        <span className="text-accent font-bold">Discover</span>
        <span className="text-[var(--muted)] text-sm hidden sm:inline">Every lens looks at the same knowledge — every artifact links back to its Experiment</span>
        <span className="ml-auto">
          <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-white">Close</button>
        </span>
      </div>
      <div className="flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {LENS_LABELS.map((l) => (
          <button
            key={l.id}
            onClick={() => onNavigate(l.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              current === l.id ? 'bg-accent text-black' : 'text-[var(--muted)] hover:text-white'
            }`}
          >
            {l.label}{l.soon && <span className="opacity-60"> (soon)</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  lens: DiscoverLens;
  rest: string | null;
  onNavigate: (lens: DiscoverLens, rest?: string | null) => void;
  onClose: () => void;
}

export function DiscoverPage({ lens, rest, onNavigate, onClose }: Props) {
  // Opening a specific Experiment (#discover/experiments/<slug>) hands off
  // to the already-shipped Experiment Gallery/detail experience (#gallery
  // route) instead of reimplementing it — same publication-quality page,
  // no duplicated logic, and existing #gallery/<slug> links keep working
  // unchanged. Landing on the bare Experiments lens, though, shows a real
  // entry point (Recommended/Trending) rather than redirecting away
  // immediately — Discover is somewhere to arrive, not just a pass-through.
  useEffect(() => {
    if (lens === 'experiments' && rest) {
      window.location.hash = `#gallery/${encodeURIComponent(rest)}`;
    }
  }, [lens, rest]);

  if (lens === 'experiments' && rest) return null;

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      <DiscoverNav current={lens} onNavigate={(l) => onNavigate(l)} onClose={onClose} />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">
          {lens === 'experiments' && <DiscoveryLanding />}
          {lens === 'visualizations' && <VisualizationDiscoveryView evidenceId={rest} />}
          {lens === 'sql' && <SqlDiscoveryView />}
          {lens === 'profiles' && (
            rest
              ? <PublicProfileView userId={rest} onOpenExperiment={(slug) => { window.location.hash = `#gallery/${slug}`; }} />
              : <ProfilesDiscoveryView onOpenProfile={(userId) => onNavigate('profiles', userId)} />
          )}
          {(lens === 'dashboards' || lens === 'notebooks' || lens === 'organizations') && (
            <div className="text-center py-20">
              <h3 className="text-lg font-medium text-white mb-2">{COMING_SOON_COPY[lens].title}</h3>
              <p className="text-sm text-[var(--muted)] max-w-md mx-auto">{COMING_SOON_COPY[lens].body}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
