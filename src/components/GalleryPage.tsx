import { useState, useEffect } from 'react';
import {
  browseGallery,
  forkGalleryLab,
  getGalleryLab,
} from '../services/cloudSandboxService';

interface Props {
  onClose: () => void;
  onLabCreated?: (connectionString: string) => void;
  slug?: string;
}

interface PublishedLab {
  id: string;
  slug: string;
  title: string;
  authors: string;
  description: string;
  tags: string;
  template: string;
  rows: number;
  tables_count: number;
  license: string;
  view_count: number;
  fork_count: number;
  published_at: string;
}

const LAB_API_URL = import.meta.env.VITE_LAB_API_URL || 'https://realitydb-lab-api.eddy-078.workers.dev';

export function GalleryPage({ onClose, onLabCreated, slug }: Props) {
  const [labs, setLabs] = useState<PublishedLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [forking, setForking] = useState<string | null>(null);
  const [forkResult, setForkResult] = useState<{ slug: string; connectionString: string } | null>(null);
  const [error, setError] = useState('');

  const [detailLab, setDetailLab] = useState<PublishedLab | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setDetailLoading(true);
    setDetailError('');
    getGalleryLab(slug).then((lab) => {
      if (!lab) {
        setDetailError('Lab not found.');
      } else {
        setDetailLab(lab as unknown as PublishedLab);
      }
      setDetailLoading(false);
    });
  }, [slug]);

  useEffect(() => {
    if (slug) return;
    loadGallery();
  }, [tagFilter, templateFilter, searchQuery, slug]);

  async function loadGallery() {
    setLoading(true);
    const params: { tag?: string; template?: string; q?: string } = {};
    if (tagFilter) params.tag = tagFilter;
    if (templateFilter) params.template = templateFilter;
    if (searchQuery) params.q = searchQuery;
    const result = await browseGallery(params);
    setLabs(result as unknown as PublishedLab[]);
    setLoading(false);
  }

  async function handleFork(slug: string) {
    setForking(slug);
    setError('');
    const result = await forkGalleryLab(slug);
    if (!result) {
      setError('Failed to fork lab. Try again.');
      setForking(null);
      return;
    }
    setForkResult({ slug, connectionString: result.connectionString });
    setForking(null);
    onLabCreated?.(result.connectionString);
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
  }

  // Extract unique tags from all labs
  const allTags = Array.from(
    new Set(labs.flatMap((l) => l.tags ? l.tags.split(',').map((t) => t.trim()).filter(Boolean) : []))
  );
  const allTemplates = Array.from(new Set(labs.map((l) => l.template).filter(Boolean)));

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      {/* Header */}
      <div className="h-12 border-b border-[var(--border)] bg-bg-elevated flex items-center px-4 gap-3 shrink-0">
        <span className="text-accent font-bold">Lab Gallery</span>
        <span className="text-[var(--muted)] text-sm">Community published labs</span>
        <span className="ml-auto">
          <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-white">Close</button>
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">
          {slug && (
            <div className="mb-6">
              <button
                onClick={onClose}
                className="text-xs text-[var(--muted)] hover:text-white mb-4"
              >
                &larr; Back to gallery
              </button>

              {detailLoading && (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
                </div>
              )}

              {!detailLoading && detailError && (
                <div className="text-center py-16">
                  <h3 className="text-lg font-medium text-white mb-2">{detailError}</h3>
                  <p className="text-sm text-[var(--muted)]">This lab may have been unpublished.</p>
                </div>
              )}

              {!detailLoading && detailLab && (
                <div className="bg-bg-card border border-[var(--border)] rounded-lg p-6 max-w-2xl">
                  <h3 className="text-xl font-semibold text-white mb-1">{detailLab.title}</h3>
                  <p className="text-xs text-[var(--muted)] mb-4">by {detailLab.authors || 'Anonymous'}</p>

                  {detailLab.description && (
                    <p className="text-sm text-[var(--muted)] mb-4">{detailLab.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mb-4 text-[10px] text-[var(--muted)]">
                    <span className="bg-bg-elevated px-1.5 py-0.5 rounded">{detailLab.template}</span>
                    {detailLab.rows > 0 && (
                      <span className="bg-bg-elevated px-1.5 py-0.5 rounded">
                        {detailLab.rows >= 1000 ? `${detailLab.rows / 1000}K` : detailLab.rows} rows
                      </span>
                    )}
                    {detailLab.tables_count > 0 && (
                      <span className="bg-bg-elevated px-1.5 py-0.5 rounded">{detailLab.tables_count} tables</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-[var(--muted)] mb-4">
                    <span>{detailLab.view_count ?? 0} views</span>
                    <span>{detailLab.fork_count ?? 0} forks</span>
                    {detailLab.license && <span>{detailLab.license}</span>}
                  </div>

                  {detailLab.tags && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {detailLab.tags.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-red-400/10 border border-red-400/20 rounded-lg text-xs text-red-400 mb-4">{error}</div>
                  )}

                  {forkResult ? (
                    <div className="p-4 bg-[#00e5a0]/5 border border-[#00e5a0]/30 rounded-lg">
                      <p className="text-sm text-[#00e5a0] font-medium mb-2">Lab forked successfully!</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-bg-elevated rounded p-2 text-[10px] font-mono text-white break-all">
                          {forkResult.connectionString}
                        </code>
                        <button onClick={() => handleCopy(forkResult.connectionString)} className="text-[10px] text-accent shrink-0">
                          Copy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pt-4 border-t border-[var(--border)]">
                      <button
                        onClick={() => handleFork(detailLab.slug)}
                        disabled={forking === detailLab.slug}
                        className="flex-1 px-3 py-1.5 bg-accent text-black text-[11px] font-semibold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                      >
                        {forking === detailLab.slug ? 'Forking...' : 'Fork Lab'}
                      </button>
                      <a
                        href={`${LAB_API_URL}/v1/labs/${detailLab.id}/export?format=notebook`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-[11px] text-[var(--muted)] border border-[var(--border)] rounded-lg hover:text-white hover:border-white/30 transition-colors"
                      >
                        .ipynb
                      </a>
                    </div>
                  )}

                  <p className="text-[9px] text-[var(--muted)] mt-4">
                    {new Date(detailLab.published_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {!slug && (
          <>
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search labs..."
              className="flex-1 min-w-[200px] px-3 py-2 bg-bg-card border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-accent/50"
            />

            {allTemplates.length > 0 && (
              <select
                value={templateFilter}
                onChange={(e) => setTemplateFilter(e.target.value)}
                className="px-3 py-2 bg-bg-card border border-[var(--border)] rounded-lg text-sm text-white focus:outline-none focus:border-accent/50"
              >
                <option value="">All Templates</option>
                {allTemplates.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}

            {allTags.length > 0 && (
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="px-3 py-2 bg-bg-card border border-[var(--border)] rounded-lg text-sm text-white focus:outline-none focus:border-accent/50"
              >
                <option value="">All Tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-400/10 border border-red-400/20 rounded-lg text-xs text-red-400 mb-4">{error}</div>
          )}

          {/* Fork success banner */}
          {forkResult && (
            <div className="p-4 bg-[#00e5a0]/5 border border-[#00e5a0]/30 rounded-lg mb-4">
              <p className="text-sm text-[#00e5a0] font-medium mb-2">Lab forked successfully!</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-bg-elevated rounded p-2 text-[10px] font-mono text-white break-all">
                  {forkResult.connectionString}
                </code>
                <button
                  onClick={() => handleCopy(forkResult.connectionString)}
                  className="text-[10px] text-accent shrink-0"
                >
                  Copy
                </button>
              </div>
              <button
                onClick={() => setForkResult(null)}
                className="mt-2 text-[10px] text-[var(--muted)] hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
            </div>
          )}

          {/* Empty state */}
          {!loading && labs.length === 0 && (
            <div className="text-center py-16">
              <h3 className="text-lg font-medium text-white mb-2">No published labs yet</h3>
              <p className="text-sm text-[var(--muted)]">
                Labs published via the CLI or snapshots will appear here.
                {searchQuery || tagFilter || templateFilter
                  ? ' Try adjusting your filters.'
                  : ''}
              </p>
            </div>
          )}

          {/* Gallery Grid */}
          {!loading && labs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {labs.map((lab) => (
                <div
                  key={lab.id}
                  className="bg-bg-card border border-[var(--border)] rounded-lg p-4 hover:border-accent/30 transition-colors flex flex-col"
                >
                  {/* Title & Author */}
                  <h3 className="text-sm font-semibold text-white mb-1 line-clamp-1">{lab.title}</h3>
                  <p className="text-[10px] text-[var(--muted)] mb-2">
                    by {lab.authors || 'Anonymous'}
                  </p>

                  {/* Description */}
                  {lab.description && (
                    <p className="text-xs text-[var(--muted)] mb-3 line-clamp-2">{lab.description}</p>
                  )}

                  {/* Metadata row */}
                  <div className="flex flex-wrap items-center gap-2 mb-3 text-[10px] text-[var(--muted)]">
                    <span className="bg-bg-elevated px-1.5 py-0.5 rounded">{lab.template}</span>
                    {lab.rows > 0 && (
                      <span className="bg-bg-elevated px-1.5 py-0.5 rounded">
                        {lab.rows >= 1000 ? `${lab.rows / 1000}K` : lab.rows} rows
                      </span>
                    )}
                    {lab.tables_count > 0 && (
                      <span className="bg-bg-elevated px-1.5 py-0.5 rounded">
                        {lab.tables_count} tables
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-[10px] text-[var(--muted)] mb-3">
                    <span>{lab.view_count ?? 0} views</span>
                    <span>{lab.fork_count ?? 0} forks</span>
                    {lab.license && <span>{lab.license}</span>}
                  </div>

                  {/* Tags */}
                  {lab.tags && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {lab.tags.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                        <span
                          key={tag}
                          onClick={() => setTagFilter(tag)}
                          className="text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent rounded cursor-pointer hover:bg-accent/20"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                    <button
                      onClick={() => handleFork(lab.slug)}
                      disabled={forking === lab.slug}
                      className="flex-1 px-3 py-1.5 bg-accent text-black text-[11px] font-semibold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                    >
                      {forking === lab.slug ? 'Forking...' : 'Fork Lab'}
                    </button>
                    <a
                      href={`${LAB_API_URL}/v1/labs/${lab.id}/export?format=notebook`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-[11px] text-[var(--muted)] border border-[var(--border)] rounded-lg hover:text-white hover:border-white/30 transition-colors"
                    >
                      .ipynb
                    </a>
                  </div>

                  {/* Published date */}
                  <p className="text-[9px] text-[var(--muted)] mt-2">
                    {new Date(lab.published_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
