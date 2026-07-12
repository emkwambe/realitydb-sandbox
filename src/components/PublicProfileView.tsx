import { useState, useEffect } from 'react';
import { getPublicProfile, fetchDiscovery, type PublicProfile } from '../services/discoveryService';
import { CredibilityBadges } from './ExperimentUI';

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</p>
    </div>
  );
}

export function ProfilesDiscoveryView({ onOpenProfile }: { onOpenProfile: (userId: string) => void }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDiscovery('profiles').then((results) => { setItems(results); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <h3 className="text-lg font-medium text-white mb-2">No published researchers yet</h3>
        <p className="text-sm text-[var(--muted)]">Publish an Experiment to appear here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((p) => (
        <button
          key={p.user_id as string}
          onClick={() => onOpenProfile(p.user_id as string)}
          className="text-left bg-bg-card border border-[var(--border)] rounded-xl p-4 hover:border-accent/30 transition-colors flex items-center gap-3"
        >
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-accent to-purple flex items-center justify-center text-black text-sm font-bold shrink-0">
            {(p.user_id as string).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{p.user_id as string}</p>
            <p className="text-[11px] text-[var(--muted)]">
              {p.published_count as number} published &middot; {(p.reproduction_count as number) || 0} reproductions &middot; {(p.review_count as number) || 0} reviews
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

export function PublicProfileView({ userId, onOpenExperiment }: { userId: string; onOpenExperiment: (slug: string) => void }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPublicProfile(userId).then((p) => { setProfile(p); setLoading(false); });
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16">
        <h3 className="text-lg font-medium text-white mb-2">Profile not found</h3>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Read-only researcher masthead — same visual language as the
          private "My Experiments" profile, but public-facing and scoped
          to published work only (no drafts/bookmarks). */}
      <div className="border-b border-[var(--border)] pb-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-accent to-purple flex items-center justify-center text-black text-xl font-bold shrink-0">
            {profile.userId.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{profile.userId}</h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">RealityDB SimLab &middot; Researcher Profile</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 mt-5 text-sm">
          <Stat label="Published" value={profile.published_count} />
          <Stat label="Reproductions received" value={profile.stats.reproduction_count} />
          <Stat label="Validations confirmed" value={`${profile.stats.validation_confirms_count}/${profile.stats.validation_count}`} />
          <Stat label="Reviews received" value={profile.stats.review_count} />
        </div>
      </div>

      <div className="space-y-2">
        {profile.experiments.map((e) => (
          <button
            key={e.id as string}
            onClick={() => onOpenExperiment(e.slug as string)}
            className="w-full text-left bg-bg-card border border-[var(--border)] rounded-lg p-4 hover:border-accent/30 transition-colors"
          >
            <h3 className="text-sm font-medium text-white">{e.title as string}</h3>
            {e.question ? <p className="text-xs text-[var(--muted)] mt-0.5">{e.question as string}</p> : null}
            <div className="mt-2"><CredibilityBadges counts={e} compact /></div>
          </button>
        ))}
      </div>
    </div>
  );
}
