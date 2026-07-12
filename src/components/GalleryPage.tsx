import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import {
  browseExperiments,
  getExperiment,
  forkExperiment,
  setExperimentBookmark,
  submitReproduction,
  getExperimentReviews,
  submitExperimentReview,
  withdrawExperimentReview,
  resolveExperimentReview,
} from '../services/cloudSandboxService';

interface Props {
  onClose: () => void;
  slug?: string;
}

interface EvidenceBlock {
  id: string;
  type: 'sql_query' | 'result_table' | 'chart' | 'markdown';
  title: string | null;
  data: any;
}

interface ExperimentSummary {
  id: string;
  slug: string;
  title: string;
  question: string;
  authors: string;
  tags: string;
  template: string;
  seed: number | null;
  rows: number;
  view_count: number;
  fork_count: number;
  published_at: string;
}

interface ReviewItem {
  id: string;
  evidence_id: string | null;
  reviewer_user_id: string;
  review_type: 'suggestion' | 'question' | 'concern' | 'endorsement';
  content: string;
  status: 'open' | 'addressed' | 'dismissed';
  created_at: string;
}

interface ExperimentDetail extends ExperimentSummary {
  findings: string;
  lab_version: string;
  engine_version: string;
  forked_from_id: string | null;
  license: string;
  user_id: string;
  viewerAccess: 'owner' | 'editor' | 'reviewer' | 'viewer' | 'none';
  bookmarked: boolean;
  evidence: EvidenceBlock[];
}

const PIE_COLORS = ['#06d6a0', '#38bdf8', '#f59e0b', '#ef4444', '#a78bfa', '#f472b6', '#22d3ee', '#84cc16'];

function EvidenceChartView({ block, evidence }: { block: EvidenceBlock; evidence: EvidenceBlock[] }) {
  const source = evidence.find((e) => e.id === block.data.sourceEvidenceId);
  const rows = source?.data?.rows;
  if (!rows || rows.length === 0) return <p className="text-xs text-[var(--muted)]">No data available for this chart.</p>;

  const { chartType, xKey, yKey } = block.data;

  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={rows} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={100} label>
            {rows.map((_: unknown, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip />
          <Line type="monotone" dataKey={yKey} stroke="#06d6a0" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip />
        <Bar dataKey={yKey} fill="#06d6a0" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GalleryPage({ onClose, slug }: Props) {
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  const [experiments, setExperiments] = useState<ExperimentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [error, setError] = useState('');

  const [detail, setDetail] = useState<ExperimentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [forking, setForking] = useState(false);
  const [forkResult, setForkResult] = useState<{ connectionString: string } | null>(null);

  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [reproMatched, setReproMatched] = useState<boolean | null>(null);
  const [reproNotes, setReproNotes] = useState('');
  const [reproSubmitting, setReproSubmitting] = useState(false);
  const [reproSubmitted, setReproSubmitted] = useState(false);

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewType, setReviewType] = useState<'suggestion' | 'question' | 'concern' | 'endorsement'>('suggestion');
  const [reviewContent, setReviewContent] = useState('');
  const [reviewEvidenceId, setReviewEvidenceId] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  function requireAuth(): boolean {
    if (!user) { setShowAuth(true); return false; }
    return true;
  }

  async function loadDetail() {
    if (!slug) return;
    setDetailLoading(true);
    setDetailError('');
    setForkResult(null);
    const exp = await getExperiment(slug, user?.id);
    if (!exp) setDetailError('Experiment not found — it may have been unpublished.');
    else setDetail(exp as unknown as ExperimentDetail);
    setDetailLoading(false);
    const rev = await getExperimentReviews(slug, user?.id);
    setReviews(rev as unknown as ReviewItem[]);
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user?.id]);

  async function handleToggleBookmark() {
    if (!requireAuth() || !detail || !user) return;
    setBookmarkBusy(true);
    const next = !detail.bookmarked;
    const ok = await setExperimentBookmark(detail.id, user.id, next);
    if (ok) setDetail((d) => (d ? { ...d, bookmarked: next } : d));
    setBookmarkBusy(false);
  }

  async function handleSubmitReproduction() {
    if (!requireAuth() || !detail || !user || reproMatched === null) return;
    setReproSubmitting(true);
    const ok = await submitReproduction(detail.id, user.id, reproMatched, reproNotes.trim() || undefined);
    if (ok) setReproSubmitted(true);
    setReproSubmitting(false);
  }

  async function handleSubmitReview() {
    if (!requireAuth() || !detail || !user) return;
    if (!reviewContent.trim()) { setReviewError('Write your suggestion, question, or concern first.'); return; }
    setReviewSubmitting(true);
    setReviewError('');
    const result = await submitExperimentReview(detail.id, user.id, reviewType, reviewContent.trim(), reviewEvidenceId || undefined);
    if (!result.ok) {
      setReviewError(result.error || 'Failed to submit review.');
    } else {
      setReviewContent('');
      const rev = await getExperimentReviews(slug!, user.id);
      setReviews(rev as unknown as ReviewItem[]);
    }
    setReviewSubmitting(false);
  }

  async function handleWithdrawReview(reviewId: string) {
    if (!detail || !user) return;
    const ok = await withdrawExperimentReview(detail.id, reviewId, user.id);
    if (ok) setReviews((prev) => prev.filter((r) => r.id !== reviewId));
  }

  async function handleResolveReview(reviewId: string, status: 'addressed' | 'dismissed') {
    if (!detail || !user) return;
    const ok = await resolveExperimentReview(detail.id, reviewId, user.id, status);
    if (ok) setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, status } : r)));
  }

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
    const result = await browseExperiments(params);
    setExperiments(result as unknown as ExperimentSummary[]);
    setLoading(false);
  }

  async function handleFork() {
    if (!requireAuth() || !detail || !user) return;
    setForking(true);
    setError('');
    const result = await forkExperiment(detail.slug, user.id);
    if (!result) {
      setError('Failed to fork experiment. Try again.');
      setForking(false);
      return;
    }
    setForkResult({ connectionString: result.connectionString });
    setForking(false);
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
  }

  const allTags = Array.from(
    new Set(experiments.flatMap((e) => e.tags ? e.tags.split(',').map((t) => t.trim()).filter(Boolean) : []))
  );
  const allTemplates = Array.from(new Set(experiments.map((e) => e.template).filter(Boolean)));

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      {/* Header */}
      <div className="h-12 border-b border-[var(--border)] bg-bg-elevated flex items-center px-4 gap-3 shrink-0">
        <span className="text-accent font-bold">Experiment Gallery</span>
        <span className="text-[var(--muted)] text-sm">Published analytical work — evidence, findings, and reproducible investigations</span>
        <span className="ml-auto">
          <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-white">Close</button>
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">

          {/* ── DETAIL VIEW ─────────────────────────────────────────── */}
          {slug && (
            <div>
              <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-white mb-4">
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
                </div>
              )}

              {!detailLoading && detail && (
                <div className="space-y-5">
                  {/* Question */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-1">Question</p>
                      <h1 className="text-2xl font-bold text-white mb-1">{detail.title}</h1>
                      {detail.question && <p className="text-sm text-[var(--muted)]">{detail.question}</p>}
                      <p className="text-xs text-[var(--muted)] mt-2">
                        by {detail.authors || 'Anonymous'} &middot; {new Date(detail.published_at).toLocaleDateString()}
                        {detail.forked_from_id && <span> &middot; forked experiment</span>}
                      </p>
                    </div>
                    <button
                      onClick={handleToggleBookmark}
                      disabled={bookmarkBusy}
                      className={`shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors ${
                        detail.bookmarked
                          ? 'bg-accent/10 border-accent/40 text-accent'
                          : 'border-[var(--border)] text-[var(--muted)] hover:text-white'
                      }`}
                    >
                      {detail.bookmarked ? '★ Bookmarked' : '☆ Bookmark'}
                    </button>
                  </div>

                  {/* Environment */}
                  <div className="bg-bg-card border border-[var(--border)] rounded-lg p-4">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">Environment</p>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="bg-bg-elevated px-2 py-1 rounded">template: {detail.template}</span>
                      {detail.seed != null && <span className="bg-bg-elevated px-2 py-1 rounded">seed: {detail.seed}</span>}
                      <span className="bg-bg-elevated px-2 py-1 rounded">rows: {detail.rows?.toLocaleString()}</span>
                      <span className="bg-bg-elevated px-2 py-1 rounded">engine: {detail.engine_version}</span>
                      <span className="bg-bg-elevated px-2 py-1 rounded">lab: {detail.lab_version}</span>
                    </div>
                  </div>

                  {/* Method + Evidence */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">Method &amp; Evidence</p>
                    <div className="space-y-4">
                      {detail.evidence.filter((e) => e.type !== 'result_table').map((e) => (
                        <div key={e.id} className="bg-bg-card border border-[var(--border)] rounded-lg p-4">
                          {e.type === 'sql_query' && (
                            <>
                              {e.title && <p className="text-xs font-medium text-white mb-2">{e.title}</p>}
                              <pre className="text-[11px] text-[var(--muted)] whitespace-pre-wrap font-mono bg-bg-elevated rounded p-3 overflow-x-auto">{e.data.sql}</pre>
                              {e.data.executionTimeMs != null && (
                                <p className="text-[10px] text-[var(--muted)] mt-1">{e.data.executionTimeMs}ms</p>
                              )}
                              {(() => {
                                const result = detail.evidence.find((r) => r.type === 'result_table' && r.data.sourceEvidenceId === e.id);
                                if (!result) return null;
                                return (
                                  <div className="overflow-x-auto mt-3">
                                    <table className="text-[11px] w-full">
                                      <thead>
                                        <tr>{result.data.columns.map((c: string) => (
                                          <th key={c} className="text-left px-2 py-1 text-[var(--muted)] border-b border-[var(--border)]">{c}</th>
                                        ))}</tr>
                                      </thead>
                                      <tbody>
                                        {result.data.rows.slice(0, 10).map((r: any, i: number) => (
                                          <tr key={i}>{result.data.columns.map((c: string) => (
                                            <td key={c} className="px-2 py-1 text-white border-b border-[var(--border)]">{String(r[c])}</td>
                                          ))}</tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    <p className="text-[10px] text-[var(--muted)] mt-1">
                                      {result.data.rowCount} rows{result.data.truncated ? ' (showing first 500, capped for storage)' : ''}
                                    </p>
                                  </div>
                                );
                              })()}
                            </>
                          )}
                          {e.type === 'chart' && (
                            <>
                              {e.title && <p className="text-xs font-medium text-white mb-2">{e.title}</p>}
                              <EvidenceChartView block={e} evidence={detail.evidence} />
                            </>
                          )}
                          {e.type === 'markdown' && (
                            <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">{e.data.content}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Findings */}
                  {detail.findings && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">Findings</p>
                      <div className="bg-bg-card border border-[var(--border)] rounded-lg p-4">
                        <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{detail.findings}</p>
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {detail.tags && (
                    <div className="flex flex-wrap gap-1">
                      {detail.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                        <span key={t} className="text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent rounded">{t}</span>
                      ))}
                    </div>
                  )}

                  {/* Reproducibility */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">Reproducibility</p>
                    {error && (
                      <div className="p-3 bg-red-400/10 border border-red-400/20 rounded-lg text-xs text-red-400 mb-3">{error}</div>
                    )}
                    {forkResult ? (
                      <div className="p-4 bg-[#00e5a0]/5 border border-[#00e5a0]/30 rounded-lg">
                        <p className="text-sm text-[#00e5a0] font-medium mb-2">Forked! A new lab and draft experiment were created from the same template, seed, and evidence.</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 bg-bg-elevated rounded p-2 text-[10px] font-mono text-white break-all">{forkResult.connectionString}</code>
                          <button onClick={() => handleCopy(forkResult.connectionString)} className="text-[10px] text-accent shrink-0">Copy</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleFork}
                        disabled={forking}
                        className="px-4 py-2 bg-accent text-black text-xs font-semibold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                      >
                        {forking ? 'Forking...' : 'Fork this Experiment'}
                      </button>
                    )}
                    <p className="text-[10px] text-[var(--muted)] mt-2">
                      {detail.view_count} views &middot; {detail.fork_count} forks &middot; {detail.license}
                    </p>
                  </div>

                  {/* Reproduce */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">Reproduce</p>
                    <div className="bg-bg-card border border-[var(--border)] rounded-lg p-4">
                      {reproSubmitted ? (
                        <p className="text-sm text-[#00e5a0]">Thanks — your reproduction report has been recorded.</p>
                      ) : (
                        <>
                          <p className="text-xs text-[var(--muted)] mb-3">Re-ran this experiment yourself? Report whether your result matched.</p>
                          <div className="flex items-center gap-2 mb-3">
                            <button
                              onClick={() => setReproMatched(true)}
                              className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors ${reproMatched === true ? 'bg-[#00e5a0]/10 border-[#00e5a0]/40 text-[#00e5a0]' : 'border-[var(--border)] text-[var(--muted)] hover:text-white'}`}
                            >
                              ✓ Matched
                            </button>
                            <button
                              onClick={() => setReproMatched(false)}
                              className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors ${reproMatched === false ? 'bg-red-400/10 border-red-400/40 text-red-400' : 'border-[var(--border)] text-[var(--muted)] hover:text-white'}`}
                            >
                              ✗ Different result
                            </button>
                          </div>
                          {reproMatched !== null && (
                            <>
                              <textarea
                                value={reproNotes}
                                onChange={(e) => setReproNotes(e.target.value)}
                                placeholder="Optional notes — what you observed"
                                className="w-full min-h-[60px] px-3 py-2 bg-bg-elevated border border-[var(--border)] rounded-lg text-xs text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-accent/50 mb-2"
                              />
                              <button
                                onClick={handleSubmitReproduction}
                                disabled={reproSubmitting}
                                className="px-3 py-1.5 bg-accent text-black text-[11px] font-semibold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                              >
                                {reproSubmitting ? 'Submitting...' : 'Submit reproduction report'}
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Peer Review */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">Peer Review</p>
                    <div className="space-y-2 mb-3">
                      {reviews.length === 0 && (
                        <p className="text-xs text-[var(--muted)]">No reviews yet.</p>
                      )}
                      {reviews.map((r) => (
                        <div key={r.id} className="bg-bg-card border border-[var(--border)] rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold ${
                              r.review_type === 'concern' ? 'bg-red-400/10 text-red-400'
                                : r.review_type === 'endorsement' ? 'bg-[#00e5a0]/10 text-[#00e5a0]'
                                : r.review_type === 'question' ? 'bg-[#38bdf8]/10 text-[#38bdf8]'
                                : 'bg-accent/10 text-accent'
                            }`}>{r.review_type}</span>
                            <span className={`text-[9px] ${r.status === 'open' ? 'text-[var(--muted)]' : r.status === 'addressed' ? 'text-[#00e5a0]' : 'text-red-400'}`}>{r.status}</span>
                          </div>
                          <p className="text-xs text-white whitespace-pre-wrap">{r.content}</p>
                          {r.evidence_id && <p className="text-[9px] text-[var(--muted)] mt-1">on evidence {r.evidence_id.slice(-6)}</p>}
                          <div className="flex items-center gap-3 mt-2">
                            {user && r.reviewer_user_id === user.id && (
                              <button onClick={() => handleWithdrawReview(r.id)} className="text-[9px] text-[var(--muted)] hover:text-red-400">Withdraw</button>
                            )}
                            {user && detail.user_id === user.id && r.status === 'open' && (
                              <>
                                <button onClick={() => handleResolveReview(r.id, 'addressed')} className="text-[9px] text-[#00e5a0] hover:underline">Mark addressed</button>
                                <button onClick={() => handleResolveReview(r.id, 'dismissed')} className="text-[9px] text-[var(--muted)] hover:underline">Dismiss</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {detail.viewerAccess === 'owner' || detail.viewerAccess === 'editor' || detail.viewerAccess === 'reviewer' ? (
                      <div className="bg-bg-card border border-[var(--border)] rounded-lg p-3">
                        {reviewError && <p className="text-[10px] text-red-400 mb-2">{reviewError}</p>}
                        <div className="flex items-center gap-2 mb-2">
                          <select
                            value={reviewType}
                            onChange={(e) => setReviewType(e.target.value as typeof reviewType)}
                            className="px-2 py-1 bg-bg-elevated border border-[var(--border)] rounded text-[11px] text-white"
                          >
                            <option value="suggestion">Suggestion</option>
                            <option value="question">Question</option>
                            <option value="concern">Concern</option>
                            <option value="endorsement">Endorsement</option>
                          </select>
                          {detail.evidence.filter((e) => e.title).length > 0 && (
                            <select
                              value={reviewEvidenceId}
                              onChange={(e) => setReviewEvidenceId(e.target.value)}
                              className="px-2 py-1 bg-bg-elevated border border-[var(--border)] rounded text-[11px] text-white flex-1"
                            >
                              <option value="">General (not tied to specific evidence)</option>
                              {detail.evidence.filter((e) => e.title).map((e) => (
                                <option key={e.id} value={e.id}>{e.title}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        <textarea
                          value={reviewContent}
                          onChange={(e) => setReviewContent(e.target.value)}
                          placeholder="A specific, evidence-anchored suggestion, question, or concern — not free-form discussion."
                          className="w-full min-h-[60px] px-3 py-2 bg-bg-elevated border border-[var(--border)] rounded-lg text-xs text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-accent/50 mb-2"
                        />
                        <button
                          onClick={handleSubmitReview}
                          disabled={reviewSubmitting}
                          className="px-3 py-1.5 bg-accent text-black text-[11px] font-semibold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                        >
                          {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-[var(--muted)]">
                        Reviewing requires reviewer access, granted by the owner. Sharing controls are coming once account-verified access ships.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── LIST VIEW ───────────────────────────────────────────── */}
          {!slug && (
          <>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search experiments..."
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

          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
            </div>
          )}

          {!loading && experiments.length === 0 && (
            <div className="text-center py-16">
              <h3 className="text-lg font-medium text-white mb-2">No published experiments yet</h3>
              <p className="text-sm text-[var(--muted)]">
                Run analyses in SimLab and publish an Experiment to feature your work here.
                {searchQuery || tagFilter || templateFilter ? ' Try adjusting your filters.' : ''}
              </p>
            </div>
          )}

          {!loading && experiments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {experiments.map((exp) => (
                <a
                  key={exp.id}
                  href={`#gallery/${exp.slug}`}
                  className="bg-bg-card border border-[var(--border)] rounded-lg p-4 hover:border-accent/30 transition-colors flex flex-col"
                >
                  <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-1">Question</p>
                  <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2">{exp.title}</h3>
                  {exp.question && <p className="text-xs text-[var(--muted)] mb-3 line-clamp-2">{exp.question}</p>}

                  <div className="flex flex-wrap items-center gap-2 mb-3 text-[10px] text-[var(--muted)]">
                    <span className="bg-bg-elevated px-1.5 py-0.5 rounded">{exp.template}</span>
                    {exp.rows > 0 && (
                      <span className="bg-bg-elevated px-1.5 py-0.5 rounded">
                        {exp.rows >= 1000 ? `${exp.rows / 1000}K` : exp.rows} rows
                      </span>
                    )}
                  </div>

                  <div className="flex-1" />

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-[10px] text-[var(--muted)]">
                    <span>by {exp.authors || 'Anonymous'}</span>
                    <span>{exp.view_count ?? 0} views &middot; {exp.fork_count ?? 0} forks</span>
                  </div>
                  <p className="text-[9px] text-[var(--muted)] mt-2">{new Date(exp.published_at).toLocaleDateString()}</p>
                </a>
              ))}
            </div>
          )}
          </>
          )}
        </div>
      </div>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
