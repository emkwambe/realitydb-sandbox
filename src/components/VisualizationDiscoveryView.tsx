import { useState, useEffect } from 'react';
import { fetchDiscovery, type DiscoverySort } from '../services/discoveryService';
import { ChartFullscreenModal } from './ChartFullscreenModal';
import { DiscoveryToolbar } from './DiscoveryToolbar';
import { LoadingSpinner, EmptyState } from './StatusViews';

interface VizCard {
  id: string;
  title: string | null;
  description: string | null;
  tags: string | null;
  data: string;
  row_count: number | null;
  experiment_slug: string;
  experiment_title: string;
  experiment_authors: string;
}

const CHART_ICON: Record<string, string> = { bar: '▤', line: '📈', pie: '◔' };

export function VisualizationDiscoveryView({ evidenceId }: { evidenceId: string | null }) {
  const [items, setItems] = useState<VizCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [template, setTemplate] = useState('');
  const [sort, setSort] = useState<DiscoverySort>('recent');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | ''>('');
  const [fullscreen, setFullscreen] = useState<VizCard | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchDiscovery('visualizations', { q: q || undefined, tag: tag || undefined, template: template || undefined, sort, chartType: chartType || undefined }).then((results) => {
      setItems(results as unknown as VizCard[]);
      setLoading(false);
    });
  }, [q, tag, template, sort, chartType]);

  // Deep link support: #discover/visualizations/<evidenceId> opens the
  // fullscreen modal directly once results have loaded.
  useEffect(() => {
    if (!evidenceId || items.length === 0) return;
    const match = items.find((i) => i.id === evidenceId);
    if (match) setFullscreen(match);
  }, [evidenceId, items]);

  return (
    <div>
      <DiscoveryToolbar
        lens="visualizations"
        q={q} onQChange={setQ}
        sort={sort} onSortChange={setSort}
        tag={tag} onTagChange={setTag}
        template={template} onTemplateChange={setTemplate}
        searchPlaceholder="Search visualizations..."
        extra={
          <div className="flex items-center gap-1">
            {(['bar', 'line', 'pie'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setChartType(chartType === t ? '' : t)}
                className={`px-2.5 py-2 text-sm rounded-lg border transition-colors ${
                  chartType === t ? 'bg-accent/10 border-accent/40 text-accent' : 'border-[var(--border)] text-[var(--muted)] hover:text-white'
                }`}
                title={t}
              >
                {CHART_ICON[t]}
              </button>
            ))}
          </div>
        }
      />

      {loading && <LoadingSpinner />}

      {!loading && items.length === 0 && (
        <EmptyState title="No visualizations published yet" body="Charts added to published Experiments will appear here." />
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            let chartType = 'bar';
            try { chartType = JSON.parse(item.data).chartType || 'bar'; } catch { /* ignore */ }
            return (
              <div key={item.id} className="bg-bg-card border border-[var(--border)] rounded-xl p-4 hover:border-accent/30 transition-colors flex flex-col">
                {/* Parent Experiment is always shown first — a visualization
                    is a derived artifact, never standalone content. */}
                <a href={`#gallery/${item.experiment_slug}`} className="text-[10px] uppercase tracking-wider text-accent font-semibold hover:underline mb-2 truncate">
                  &larr; {item.experiment_title}
                </a>
                <button onClick={() => setFullscreen(item)} className="text-left flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{CHART_ICON[chartType] || '▤'}</span>
                    <h3 className="text-sm font-semibold text-white truncate">{item.title || 'Untitled visualization'}</h3>
                  </div>
                  {item.description && <p className="text-xs text-[var(--muted)] mb-2 line-clamp-2">{item.description}</p>}
                  <div className="flex-1" />
                  <p className="text-[10px] text-[var(--muted)] mt-2">{item.row_count != null ? `${item.row_count.toLocaleString()} rows` : ''} &middot; by {item.experiment_authors || 'Anonymous'}</p>
                </button>
                {item.tags && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent rounded-full">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {fullscreen && (
        <ChartFullscreenModal
          evidenceId={fullscreen.id}
          experimentSlug={fullscreen.experiment_slug}
          title={fullscreen.title}
          onClose={() => setFullscreen(null)}
        />
      )}
    </div>
  );
}
