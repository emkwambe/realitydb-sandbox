import { useState, useEffect } from 'react';
import { fetchFacets, type DiscoveryLens, type DiscoverySort, type DiscoveryFacets } from '../services/discoveryService';

const SORT_LABELS: { value: DiscoverySort; label: string }[] = [
  { value: 'recent', label: 'Newest' },
  { value: 'relevance', label: 'Relevance' },
  { value: 'trending', label: 'Trending' },
  { value: 'most_cited', label: 'Most Cited' },
  { value: 'most_reproduced', label: 'Most Reproduced' },
  { value: 'most_validated', label: 'Most Validated' },
  { value: 'most_reviewed', label: 'Most Reviewed' },
];

interface Props {
  lens: DiscoveryLens;
  q: string;
  onQChange: (v: string) => void;
  sort: DiscoverySort;
  onSortChange: (v: DiscoverySort) => void;
  tag: string;
  onTagChange: (v: string) => void;
  template: string;
  onTemplateChange: (v: string) => void;
  searchPlaceholder?: string;
  extra?: React.ReactNode;
}

/**
 * One toolbar, reused by every browsable discovery lens (Visualizations,
 * SQL, and the Experiments list view) — sort options and tag/template
 * dropdowns are sourced from the shared facets endpoint (the whole
 * published population), not derived from whatever page of results
 * happens to already be loaded client-side.
 */
export function DiscoveryToolbar({ lens, q, onQChange, sort, onSortChange, tag, onTagChange, template, onTemplateChange, searchPlaceholder, extra }: Props) {
  const [facets, setFacets] = useState<DiscoveryFacets>({ tags: [], templates: [], authors: [] });

  useEffect(() => {
    fetchFacets(lens).then(setFacets);
  }, [lens]);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <input
        type="text"
        value={q}
        onChange={(e) => onQChange(e.target.value)}
        placeholder={searchPlaceholder || 'Search...'}
        className="flex-1 min-w-[200px] px-3 py-2 bg-bg-card border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-accent/50"
      />

      {facets.templates.length > 0 && (
        <select
          value={template}
          onChange={(e) => onTemplateChange(e.target.value)}
          className="px-3 py-2 bg-bg-card border border-[var(--border)] rounded-lg text-sm text-white focus:outline-none focus:border-accent/50"
        >
          <option value="">All Templates</option>
          {facets.templates.map((f) => (
            <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
          ))}
        </select>
      )}

      {facets.tags.length > 0 && (
        <select
          value={tag}
          onChange={(e) => onTagChange(e.target.value)}
          className="px-3 py-2 bg-bg-card border border-[var(--border)] rounded-lg text-sm text-white focus:outline-none focus:border-accent/50"
        >
          <option value="">All Tags</option>
          {facets.tags.map((f) => (
            <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
          ))}
        </select>
      )}

      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as DiscoverySort)}
        className="px-3 py-2 bg-bg-card border border-[var(--border)] rounded-lg text-sm text-white focus:outline-none focus:border-accent/50"
      >
        {SORT_LABELS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {extra}
    </div>
  );
}
