import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchRecommended, fetchDiscovery, fetchFacets } from '../services/discoveryService';
import { CredibilityBadges } from './ExperimentUI';
import { LoadingSpinner } from './StatusViews';

type Exp = Record<string, unknown>;

function ExperimentCard({ exp }: { exp: Exp }) {
  return (
    <a
      href={`#gallery/${exp.slug}`}
      className="bg-bg-card border border-[var(--border)] rounded-xl p-4 hover:border-accent/30 transition-colors"
    >
      <h3 className="text-sm font-semibold text-white mb-1 truncate">{exp.title as string}</h3>
      {exp.question ? <p className="text-xs text-[var(--muted)] mb-2 line-clamp-2">{exp.question as string}</p> : null}
      <CredibilityBadges counts={exp} compact />
    </a>
  );
}

function Row({ title, subtitle, seeAllHref, children }: { title: string; subtitle?: string; seeAllHref?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--muted)] mt-0.5">{subtitle}</p>}
        </div>
        {seeAllHref && <a href={seeAllHref} className="text-xs text-accent hover:underline shrink-0">See all &rarr;</a>}
      </div>
      {children}
    </section>
  );
}

/**
 * The Experiments lens's landing view. Browsing the full catalog still
 * hands off to the existing Experiment Gallery/detail page (#gallery) via
 * the "See all" links — this is an entry point above that hand-off, not
 * a replacement for it. "Featured" and "Browse by" rows are algorithmic
 * previews (top-N by credibility, top facet values), not editorial
 * curation — no curation flag exists or is being added this sprint.
 */
export function DiscoveryLanding() {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [personalized, setPersonalized] = useState(false);
  const [recommended, setRecommended] = useState<Exp[]>([]);
  const [trending, setTrending] = useState<Exp[]>([]);
  const [recent, setRecent] = useState<Exp[]>([]);
  const [featured, setFeatured] = useState<Exp[]>([]);
  const [byTemplate, setByTemplate] = useState<{ template: string; items: Exp[] }[]>([]);
  const [byChartType, setByChartType] = useState<{ chartType: string; items: Exp[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchRecommended(accessToken, 4),
      fetchDiscovery('experiments', { sort: 'trending' }),
      fetchDiscovery('experiments', { sort: 'recent' }),
      fetchDiscovery('experiments', { sort: 'relevance' }),
      fetchFacets('experiments'),
    ]).then(async ([rec, trend, rec2, feat, facets]) => {
      setPersonalized(rec.personalized);
      setRecommended(rec.results.slice(0, 4));
      setTrending(trend.slice(0, 4));
      setRecent(rec2.slice(0, 4));
      setFeatured(feat.slice(0, 4));

      const topTemplates = facets.templates.slice(0, 3);
      const clusters = await Promise.all(
        topTemplates.map(async (f) => ({
          template: f.value,
          items: (await fetchDiscovery('experiments', { template: f.value, sort: 'relevance' })).slice(0, 3),
        }))
      );
      setByTemplate(clusters.filter((c) => c.items.length > 0));

      const chartClusters = await Promise.all(
        (['bar', 'line', 'pie'] as const).map(async (ct) => ({
          chartType: ct,
          items: await fetchDiscovery('visualizations', { chartType: ct }),
        }))
      );
      setByChartType(chartClusters.filter((c) => c.items.length > 0));
      setLoading(false);
    });
  }, [accessToken]);

  if (loading) return <LoadingSpinner />;

  const nothingAtAll = recommended.length === 0 && trending.length === 0 && recent.length === 0;

  if (nothingAtAll) {
    return (
      <div className="text-center py-16">
        <h3 className="text-lg font-medium text-white mb-2">Nothing published yet</h3>
        <p className="text-sm text-[var(--muted)]">Be the first — run an analysis in SimLab and publish an Experiment.</p>
      </div>
    );
  }

  return (
    <div>
      {recommended.length > 0 && (
        <Row
          title={personalized ? 'Recommended for You' : 'Trending'}
          subtitle={personalized ? "Based on what you've bookmarked and reproduced." : 'What the community is engaging with right now.'}
          seeAllHref="#gallery"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recommended.map((exp) => <ExperimentCard key={exp.id as string} exp={exp} />)}
          </div>
        </Row>
      )}

      {personalized && trending.length > 0 && (
        <Row title="Trending" subtitle="What the community is engaging with right now." seeAllHref="#gallery">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {trending.map((exp) => <ExperimentCard key={exp.id as string} exp={exp} />)}
          </div>
        </Row>
      )}

      {featured.length > 0 && (
        <Row title="Featured" subtitle="Ranked by reproductions, validations, reviews, and citations." seeAllHref="#gallery">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featured.map((exp) => <ExperimentCard key={exp.id as string} exp={exp} />)}
          </div>
        </Row>
      )}

      {recent.length > 0 && (
        <Row title="Recently Published" seeAllHref="#gallery">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recent.map((exp) => <ExperimentCard key={exp.id as string} exp={exp} />)}
          </div>
        </Row>
      )}

      {byTemplate.length > 0 && (
        <Row title="Browse by Industry" seeAllHref="#gallery">
          <div className="space-y-6">
            {byTemplate.map((cluster) => (
              <div key={cluster.template}>
                <p className="text-xs uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">{cluster.template}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {cluster.items.map((exp) => <ExperimentCard key={exp.id as string} exp={exp} />)}
                </div>
              </div>
            ))}
          </div>
        </Row>
      )}

      {byChartType.length > 0 && (
        <Row title="Browse by Visualization" seeAllHref="#discover/visualizations">
          <div className="space-y-6">
            {byChartType.map((cluster) => (
              <div key={cluster.chartType}>
                <p className="text-xs uppercase tracking-wider text-[var(--muted)] font-semibold mb-2 capitalize">{cluster.chartType} charts</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {cluster.items.slice(0, 3).map((v) => (
                    <a
                      key={v.id as string}
                      href={`#discover/visualizations/${v.id}`}
                      className="bg-bg-card border border-[var(--border)] rounded-lg p-3 hover:border-accent/30 transition-colors"
                    >
                      <h4 className="text-xs font-medium text-white truncate">{(v.title as string) || 'Untitled visualization'}</h4>
                      <p className="text-[11px] text-[var(--muted)] mt-0.5 truncate">from {v.experiment_title as string}</p>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Row>
      )}
    </div>
  );
}
