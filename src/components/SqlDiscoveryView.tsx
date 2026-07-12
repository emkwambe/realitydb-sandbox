import { useState, useEffect } from 'react';
import { fetchDiscovery, type DiscoverySort } from '../services/discoveryService';
import { SqlBlock } from './ExperimentUI';
import { DiscoveryToolbar } from './DiscoveryToolbar';
import { LoadingSpinner, EmptyState } from './StatusViews';

interface SqlCard {
  id: string;
  title: string | null;
  description: string | null;
  data: string;
  experiment_slug: string;
  experiment_title: string;
  experiment_authors: string;
}

export function SqlDiscoveryView() {
  const [items, setItems] = useState<SqlCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [template, setTemplate] = useState('');
  const [sort, setSort] = useState<DiscoverySort>('recent');

  useEffect(() => {
    setLoading(true);
    fetchDiscovery('sql', { q: q || undefined, tag: tag || undefined, template: template || undefined, sort }).then((results) => {
      setItems(results as unknown as SqlCard[]);
      setLoading(false);
    });
  }, [q, tag, template, sort]);

  return (
    <div>
      <DiscoveryToolbar
        lens="sql"
        q={q} onQChange={setQ}
        sort={sort} onSortChange={setSort}
        tag={tag} onTagChange={setTag}
        template={template} onTemplateChange={setTemplate}
        searchPlaceholder="Search SQL..."
      />

      {loading && <LoadingSpinner />}

      {!loading && items.length === 0 && (
        <EmptyState title="No SQL published yet" body="Queries added to published Experiments will appear here." />
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => {
            let sql = '';
            try { sql = JSON.parse(item.data).sql; } catch { /* ignore */ }
            return (
              <div key={item.id} className="bg-bg-card border border-[var(--border)] rounded-xl p-4">
                {/* Parent Experiment link is always shown — a saved query is a
                    derived artifact, never standalone content. */}
                <a href={`#gallery/${item.experiment_slug}`} className="text-[10px] uppercase tracking-wider text-accent font-semibold hover:underline">
                  &larr; {item.experiment_title}
                </a>
                {item.title && <p className="text-sm font-semibold text-white mt-1.5 mb-2">{item.title}</p>}
                <SqlBlock sql={sql} />
                <p className="text-[10px] text-[var(--muted)] mt-2">by {item.experiment_authors || 'Anonymous'}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
