import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchRecommended } from '../services/discoveryService';
import { CredibilityBadges } from './ExperimentUI';

/**
 * The Experiments lens's landing view — Recommended (signed-in, derived
 * from the caller's own bookmark/reproduction affinity) or Trending
 * (anonymous / no signal yet), backed by GET /v1/discover/recommended.
 * Browsing the full catalog still hands off to the existing Experiment
 * Gallery/detail page (#gallery) via the link below — this is an entry
 * point above that hand-off, not a replacement for it.
 */
export function DiscoveryLanding() {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [personalized, setPersonalized] = useState(false);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchRecommended(accessToken, 8).then(({ personalized, results }) => {
      setPersonalized(personalized);
      setItems(results);
      setLoading(false);
    });
  }, [accessToken]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{personalized ? 'Recommended for You' : 'Trending'}</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {personalized ? "Based on what you've bookmarked and reproduced." : 'What the community is engaging with right now.'}
          </p>
        </div>
        <a href="#gallery" className="text-xs text-accent hover:underline shrink-0">Browse all Experiments &rarr;</a>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-16">
          <h3 className="text-lg font-medium text-white mb-2">Nothing published yet</h3>
          <p className="text-sm text-[var(--muted)]">Be the first — run an analysis in SimLab and publish an Experiment.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((exp) => (
            <a
              key={exp.id as string}
              href={`#gallery/${exp.slug}`}
              className="bg-bg-card border border-[var(--border)] rounded-xl p-4 hover:border-accent/30 transition-colors"
            >
              <h3 className="text-sm font-semibold text-white mb-1 truncate">{exp.title as string}</h3>
              {exp.question ? <p className="text-xs text-[var(--muted)] mb-2 line-clamp-2">{exp.question as string}</p> : null}
              <CredibilityBadges counts={exp} compact />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
