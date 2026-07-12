import { useState, useEffect } from 'react';
import { fetchDiscovery } from '../services/discoveryService';
import { SqlBlock } from './ExperimentUI';

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

  useEffect(() => {
    setLoading(true);
    fetchDiscovery('sql', { q: q || undefined }).then((results) => {
      setItems(results as unknown as SqlCard[]);
      setLoading(false);
    });
  }, [q]);

  return (
    <div>
      <div className="mb-5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search SQL..."
          className="w-full max-w-md px-3 py-2 bg-bg-card border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-accent/50"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-16">
          <h3 className="text-lg font-medium text-white mb-2">No SQL published yet</h3>
          <p className="text-sm text-[var(--muted)]">Queries added to published Experiments will appear here.</p>
        </div>
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
