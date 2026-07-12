import { useState, useEffect } from 'react';
import { getPublicProfile, fetchDiscovery, type PublicProfile } from '../services/discoveryService';
import { CredibilityBadges } from './ExperimentUI';
import { LoadingSpinner, EmptyState, NotFoundState } from './StatusViews';

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

  if (loading) return <LoadingSpinner />;
  if (items.length === 0) return <EmptyState title="No published researchers yet" body="Publish an Experiment to appear here." />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

/**
 * Small "other researchers" strip for the bottom of a profile page —
 * approximate, not a true similarity claim (no author-similarity scoring
 * exists or is being added this sprint). Excludes the profile being viewed.
 */
function OtherResearchers({ excludeUserId, onOpenProfile }: { excludeUserId: string; onOpenProfile: (userId: string) => void }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    fetchDiscovery('profiles').then((results) => {
      setItems((results as Record<string, unknown>[]).filter((p) => p.user_id !== excludeUserId).slice(0, 4));
    });
  }, [excludeUserId]);

  if (items.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">Other Researchers</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((p) => (
          <button
            key={p.user_id as string}
            onClick={() => onOpenProfile(p.user_id as string)}
            className="text-left bg-bg-card border border-[var(--border)] rounded-lg p-3 hover:border-accent/30 transition-colors flex items-center gap-2.5"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent to-purple flex items-center justify-center text-black text-xs font-bold shrink-0">
              {(p.user_id as string).charAt(0).toUpperCase()}
            </div>
            <p className="text-xs font-medium text-white truncate">{p.user_id as string}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PublicProfileView({ userId, onOpenExperiment, onOpenProfile }: { userId: string; onOpenExperiment: (slug: string) => void; onOpenProfile?: (userId: string) => void }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPublicProfile(userId).then((p) => { setProfile(p); setLoading(false); });
  }, [userId]);

  if (loading) return <LoadingSpinner />;
  if (!profile) return <NotFoundState title="Profile not found" body="This researcher may not have any published Experiments." />;

  const identity = profile.profile;

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

        {/* About / Research Interests / Expertise — omitted entirely when
            the researcher hasn't set them, no placeholder prompts. */}
        {identity?.bio && <p className="text-sm text-gray-200 leading-relaxed mt-4">{identity.bio}</p>}
        {identity?.researchInterests && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">Research Interests</p>
            <p className="text-xs text-gray-300">{identity.researchInterests}</p>
          </div>
        )}
        {identity?.expertiseTags && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {identity.expertiseTags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
              <span key={t} className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent rounded-full">{t}</span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-6 mt-5 text-sm">
          <Stat label="Published" value={profile.published_count} />
          <Stat label="Reproductions received" value={profile.stats.reproduction_count} />
          <Stat label="Validations confirmed" value={`${profile.stats.validation_confirms_count}/${profile.stats.validation_count}`} />
          <Stat label="Reviews received" value={profile.stats.review_count} />
        </div>
      </div>

      {identity && identity.featured.length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">Featured Experiments</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {identity.featured.map((e) => (
              <button
                key={e.id}
                onClick={() => onOpenExperiment(e.slug)}
                className="text-left bg-bg-card border border-accent/30 rounded-lg p-3 hover:border-accent/50 transition-colors"
              >
                <h4 className="text-xs font-medium text-white truncate">{e.title}</h4>
                {e.question && <p className="text-[11px] text-[var(--muted)] mt-0.5 line-clamp-2">{e.question}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 mb-8">
        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">Published Work</p>
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

      {onOpenProfile && <OtherResearchers excludeUserId={userId} onOpenProfile={onOpenProfile} />}
    </div>
  );
}
