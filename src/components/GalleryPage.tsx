import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { CredibilityBadges, SqlBlock, ResultTable, PublicationMarkdown, EvidenceChart, type CredibilityCounts } from './ExperimentUI';
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
  getRelatedExperiments,
  getExperimentReferences,
  addExperimentReference,
  removeExperimentReference,
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

interface ExperimentSummary extends CredibilityCounts {
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
  key_findings: string | null;
  limitations: string | null;
  future_work: string | null;
  lab_version: string;
  engine_version: string;
  forked_from_id: string | null;
  forkedFrom: { id: string; title: string; slug: string } | null;
  license: string;
  user_id: string;
  viewerAccess: 'owner' | 'editor' | 'reviewer' | 'viewer' | 'none';
  bookmarked: boolean;
  evidence: EvidenceBlock[];
}

interface ReferenceItem {
  id: string;
  note: string | null;
  created_at: string;
  other_title: string | null;
  other_slug: string | null;
}

function estimateReadingTime(detail: ExperimentDetail): number {
  const text = [detail.findings, detail.key_findings, detail.limitations, detail.future_work].filter(Boolean).join(' ');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function citationUrl(slug: string): string {
  return `${window.location.origin}${window.location.pathname}#gallery/${slug}`;
}

function formatCitations(detail: ExperimentDetail): { bibtex: string; apa: string; mla: string } {
  const year = new Date(detail.published_at).getFullYear();
  const author = detail.authors || 'Anonymous';
  const url = citationUrl(detail.slug);
  const bibtex = `@misc{${detail.slug},\n  title = {${detail.title}},\n  author = {${author}},\n  year = {${year}},\n  howpublished = {\\url{${url}}},\n  note = {RealityDB SimLab Experiment}\n}`;
  const apa = `${author}. (${year}). ${detail.title}. RealityDB SimLab. ${url}`;
  const mla = `${author}. "${detail.title}." RealityDB SimLab, ${year}, ${url}.`;
  return { bibtex, apa, mla };
}

function EvidenceChartView({ block, evidence }: { block: EvidenceBlock; evidence: EvidenceBlock[] }) {
  const source = evidence.find((e) => e.id === block.data.sourceEvidenceId);
  const { chartType, xKey, yKey } = block.data;
  return <EvidenceChart chartType={chartType} xKey={xKey} yKey={yKey} rows={source?.data?.rows} />;
}

export function GalleryPage({ onClose, slug }: Props) {
  const { user, session } = useAuth();
  const accessToken = session?.access_token;
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

  const [related, setRelated] = useState<ExperimentSummary[]>([]);
  const [references, setReferences] = useState<{ citedBy: ReferenceItem[]; cites: ReferenceItem[] }>({ citedBy: [], cites: [] });
  const [citeExpanded, setCiteExpanded] = useState<'bibtex' | 'apa' | 'mla' | null>(null);
  const [citeTargetSlug, setCiteTargetSlug] = useState('');
  const [citeNote, setCiteNote] = useState('');
  const [citeSubmitting, setCiteSubmitting] = useState(false);
  const [citeError, setCiteError] = useState('');
  const [citeRemovingId, setCiteRemovingId] = useState<string | null>(null);

  function requireAuth(): boolean {
    if (!user) { setShowAuth(true); return false; }
    return true;
  }

  async function loadDetail() {
    if (!slug) return;
    setDetailLoading(true);
    setDetailError('');
    setForkResult(null);
    const exp = await getExperiment(slug, accessToken);
    if (!exp) { setDetailError('Experiment not found — it may have been unpublished.'); setDetailLoading(false); return; }
    setDetail(exp as unknown as ExperimentDetail);
    setDetailLoading(false);
    const [rev, rel, refs] = await Promise.all([
      getExperimentReviews(slug, accessToken),
      getRelatedExperiments(slug),
      getExperimentReferences(exp.id as string, accessToken),
    ]);
    setReviews(rev as unknown as ReviewItem[]);
    setRelated(rel as unknown as ExperimentSummary[]);
    setReferences(refs as unknown as { citedBy: ReferenceItem[]; cites: ReferenceItem[] });
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, accessToken]);

  async function handleToggleBookmark() {
    if (!requireAuth() || !detail || !accessToken) return;
    setBookmarkBusy(true);
    const next = !detail.bookmarked;
    const ok = await setExperimentBookmark(detail.id, accessToken, next);
    if (ok) setDetail((d) => (d ? { ...d, bookmarked: next } : d));
    setBookmarkBusy(false);
  }

  async function handleSubmitReproduction() {
    if (!requireAuth() || !detail || !accessToken || reproMatched === null) return;
    setReproSubmitting(true);
    const ok = await submitReproduction(detail.id, accessToken, reproMatched, reproNotes.trim() || undefined);
    if (ok) setReproSubmitted(true);
    setReproSubmitting(false);
  }

  async function handleSubmitReview() {
    if (!requireAuth() || !detail || !accessToken) return;
    if (!reviewContent.trim()) { setReviewError('Write your suggestion, question, or concern first.'); return; }
    setReviewSubmitting(true);
    setReviewError('');
    const result = await submitExperimentReview(detail.id, accessToken, reviewType, reviewContent.trim(), reviewEvidenceId || undefined);
    if (!result.ok) {
      setReviewError(result.error || 'Failed to submit review.');
    } else {
      setReviewContent('');
      const rev = await getExperimentReviews(slug!, accessToken);
      setReviews(rev as unknown as ReviewItem[]);
    }
    setReviewSubmitting(false);
  }

  async function handleWithdrawReview(reviewId: string) {
    if (!detail || !accessToken) return;
    const ok = await withdrawExperimentReview(detail.id, reviewId, accessToken);
    if (ok) setReviews((prev) => prev.filter((r) => r.id !== reviewId));
  }

  async function handleResolveReview(reviewId: string, status: 'addressed' | 'dismissed') {
    if (!detail || !accessToken) return;
    const ok = await resolveExperimentReview(detail.id, reviewId, accessToken, status);
    if (ok) setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, status } : r)));
  }

  // Records "this Experiment (detail) builds upon the Experiment at
  // citeTargetSlug" — an edit to detail itself, so it requires editor
  // access on detail, not any permission from the target. Appears
  // immediately under detail's own "Builds Upon" list; the target's
  // "Referenced By" list derives from the same row automatically.
  async function handleAddCitation() {
    if (!requireAuth() || !detail || !accessToken) return;
    if (!citeTargetSlug.trim()) { setCiteError('Enter the slug of the Experiment this one builds upon.'); return; }
    setCiteSubmitting(true);
    setCiteError('');
    const target = await getExperiment(citeTargetSlug.trim(), accessToken);
    if (!target) { setCiteError('No published Experiment found with that slug.'); setCiteSubmitting(false); return; }
    const result = await addExperimentReference(detail.id, accessToken, { targetExperimentId: target.id as string, note: citeNote.trim() || undefined });
    if (!result.ok) { setCiteError(result.error || 'Failed to add citation.'); setCiteSubmitting(false); return; }
    setCiteTargetSlug('');
    setCiteNote('');
    const refs = await getExperimentReferences(detail.id, accessToken);
    setReferences(refs as unknown as { citedBy: ReferenceItem[]; cites: ReferenceItem[] });
    setCiteSubmitting(false);
  }

  async function handleRemoveCitation(referenceId: string) {
    if (!detail || !accessToken) return;
    setCiteRemovingId(referenceId);
    const ok = await removeExperimentReference(detail.id, referenceId, accessToken);
    if (ok) setReferences((prev) => ({ ...prev, cites: prev.cites.filter((r) => r.id !== referenceId) }));
    setCiteRemovingId(null);
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
    if (!requireAuth() || !detail || !accessToken) return;
    setForking(true);
    setError('');
    const result = await forkExperiment(detail.slug, accessToken);
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
                <article className="space-y-8">
                  {/* Masthead */}
                  <header className="border-b border-[var(--border)] pb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] uppercase tracking-[0.15em] text-accent font-semibold">Published Analysis</span>
                      <span className="text-[10px] text-[var(--muted)]">&middot;</span>
                      <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{detail.template}</span>
                    </div>
                    <h1 className="text-[28px] leading-tight font-bold text-white mb-3 tracking-tight">{detail.title}</h1>
                    {detail.question && <p className="text-[15px] text-gray-300 leading-relaxed mb-4 max-w-2xl">{detail.question}</p>}

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-[var(--muted)]">
                        By <span className="text-gray-300 font-medium">{detail.authors || 'Anonymous'}</span>
                        {' · '}{new Date(detail.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                        {' · '}{estimateReadingTime(detail)} min read
                        {detail.forkedFrom && (
                          <> · derived from <a href={`#gallery/${detail.forkedFrom.slug}`} className="text-accent hover:underline">{detail.forkedFrom.title}</a></>
                        )}
                      </p>
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

                    <div className="mt-4">
                      <CredibilityBadges counts={detail} />
                    </div>
                  </header>

                  {/* Executive summary — lede pulled from findings, full text appears later */}
                  {detail.findings && (
                    <div className="bg-accent/5 border border-accent/20 rounded-xl px-6 py-5">
                      <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-2">Executive Summary</p>
                      <p className="text-[15px] text-gray-200 leading-relaxed">
                        {detail.findings.replace(/[#*_`>-]/g, '').trim().slice(0, 280)}
                        {detail.findings.length > 280 ? '…' : ''}
                      </p>
                    </div>
                  )}

                  {/* Environment / reproducibility manifest */}
                  <section>
                    <p className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2.5">Environment</p>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="bg-bg-card border border-[var(--border)] px-2.5 py-1 rounded-md text-gray-300">template: <span className="text-white">{detail.template}</span></span>
                      {detail.seed != null && <span className="bg-bg-card border border-[var(--border)] px-2.5 py-1 rounded-md text-gray-300">seed: <span className="text-white">{detail.seed}</span></span>}
                      <span className="bg-bg-card border border-[var(--border)] px-2.5 py-1 rounded-md text-gray-300">rows: <span className="text-white">{detail.rows?.toLocaleString()}</span></span>
                      <span className="bg-bg-card border border-[var(--border)] px-2.5 py-1 rounded-md text-gray-300">engine: <span className="text-white">{detail.engine_version}</span></span>
                    </div>
                  </section>

                  {/* Method + Evidence */}
                  <section>
                    <p className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-3">Method &amp; Evidence</p>
                    <div className="space-y-5">
                      {detail.evidence.filter((e) => e.type !== 'result_table').map((e) => (
                        <div key={e.id} className="bg-bg-card border border-[var(--border)] rounded-xl p-5">
                          {e.type === 'sql_query' && (
                            <>
                              {e.title && <p className="text-[13px] font-semibold text-white mb-3">{e.title}</p>}
                              <SqlBlock sql={e.data.sql} />
                              {e.data.executionTimeMs != null && (
                                <p className="text-[10px] text-[var(--muted)] mt-1.5">Executed in {e.data.executionTimeMs}ms</p>
                              )}
                              {(() => {
                                const result = detail.evidence.find((r) => r.type === 'result_table' && r.data.sourceEvidenceId === e.id);
                                if (!result) return null;
                                return (
                                  <div className="mt-4">
                                    <ResultTable columns={result.data.columns} rows={result.data.rows} rowCount={result.data.rowCount} truncated={result.data.truncated} />
                                  </div>
                                );
                              })()}
                            </>
                          )}
                          {e.type === 'chart' && (
                            <>
                              {e.title && <p className="text-[13px] font-semibold text-white mb-3">{e.title}</p>}
                              <EvidenceChartView block={e} evidence={detail.evidence} />
                            </>
                          )}
                          {e.type === 'markdown' && (
                            <PublicationMarkdown content={e.data.content} />
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Findings & Conclusions — full markdown */}
                  {detail.findings && (
                    <section>
                      <p className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-3">Findings &amp; Conclusions</p>
                      <div className="bg-bg-card border border-[var(--border)] rounded-xl px-6 py-5">
                        <PublicationMarkdown content={detail.findings} />
                      </div>
                    </section>
                  )}

                  {/* Key Findings / Limitations / Future Work — optional structured
                      sections, each omitted entirely when the author left it empty. */}
                  {detail.key_findings && (
                    <section>
                      <p className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-3">Key Findings</p>
                      <div className="bg-bg-card border border-[var(--border)] rounded-xl px-6 py-5">
                        <PublicationMarkdown content={detail.key_findings} />
                      </div>
                    </section>
                  )}
                  {detail.limitations && (
                    <section>
                      <p className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-3">Limitations</p>
                      <div className="bg-bg-card border border-[var(--border)] rounded-xl px-6 py-5">
                        <PublicationMarkdown content={detail.limitations} />
                      </div>
                    </section>
                  )}
                  {detail.future_work && (
                    <section>
                      <p className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-3">Future Work</p>
                      <div className="bg-bg-card border border-[var(--border)] rounded-xl px-6 py-5">
                        <PublicationMarkdown content={detail.future_work} />
                      </div>
                    </section>
                  )}

                  {/* Tags */}
                  {detail.tags && (
                    <div className="flex flex-wrap gap-1.5">
                      {detail.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent rounded-full">{t}</span>
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
                          <div className="text-xs"><PublicationMarkdown content={r.content} /></div>
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

                  {/* Related Experiments — same template/author/tag overlap */}
                  {related.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">Related Experiments</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {related.map((r) => (
                          <a
                            key={r.id}
                            href={`#gallery/${r.slug}`}
                            className="bg-bg-card border border-[var(--border)] rounded-lg p-3 hover:border-accent/30 transition-colors"
                          >
                            <h4 className="text-xs font-medium text-white truncate">{r.title}</h4>
                            {r.question && <p className="text-[11px] text-[var(--muted)] mt-0.5 line-clamp-2">{r.question}</p>}
                            <div className="mt-2"><CredibilityBadges counts={r} compact /></div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Citations — cite this work, see what cites it, record incoming citations */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">Citations</p>
                    <div className="bg-bg-card border border-[var(--border)] rounded-lg p-4 space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {(['bibtex', 'apa', 'mla'] as const).map((fmt) => (
                            <button
                              key={fmt}
                              onClick={() => setCiteExpanded(citeExpanded === fmt ? null : fmt)}
                              className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition-colors uppercase ${
                                citeExpanded === fmt ? 'bg-accent/10 border-accent/40 text-accent' : 'border-[var(--border)] text-[var(--muted)] hover:text-white'
                              }`}
                            >
                              {fmt}
                            </button>
                          ))}
                        </div>
                        {citeExpanded && (
                          <div className="flex items-start gap-2">
                            <pre className="flex-1 text-[10px] font-mono text-gray-300 bg-bg-elevated border border-[var(--border)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                              {formatCitations(detail)[citeExpanded]}
                            </pre>
                            <button onClick={() => handleCopy(formatCitations(detail)[citeExpanded!])} className="text-[10px] text-accent shrink-0 mt-1">Copy</button>
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1.5">Referenced By</p>
                        {references.citedBy.length === 0 ? (
                          <p className="text-[11px] text-[var(--muted)]">No recorded citations yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {references.citedBy.map((r) => (
                              <div key={r.id} className="text-[11px]">
                                {r.other_slug ? <a href={`#gallery/${r.other_slug}`} className="text-accent hover:underline">{r.other_title}</a> : <span className="text-[var(--muted)] italic">(source not published)</span>}
                                {r.note && <span className="text-[var(--muted)]"> — {r.note}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1.5">Builds Upon</p>
                        {references.cites.length === 0 ? (
                          <p className="text-[11px] text-[var(--muted)]">No recorded outgoing citations.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {references.cites.map((r) => (
                              <div key={r.id} className="text-[11px] flex items-center justify-between gap-2">
                                <span>
                                  <a href={`#gallery/${r.other_slug}`} className="text-accent hover:underline">{r.other_title}</a>
                                  {r.note && <span className="text-[var(--muted)]"> — {r.note}</span>}
                                </span>
                                {(detail.viewerAccess === 'owner' || detail.viewerAccess === 'editor') && (
                                  <button
                                    onClick={() => handleRemoveCitation(r.id)}
                                    disabled={citeRemovingId === r.id}
                                    className="text-[9px] text-[var(--muted)] hover:text-red-400 shrink-0 disabled:opacity-50"
                                  >
                                    {citeRemovingId === r.id ? 'Removing...' : 'Remove'}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {(detail.viewerAccess === 'owner' || detail.viewerAccess === 'editor') && (
                        <div className="pt-2 border-t border-[var(--border)]">
                          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1.5">Add a citation</p>
                          <p className="text-[10px] text-[var(--muted)] mb-2">Enter the slug of a published Experiment this one builds upon.</p>
                          {citeError && <p className="text-[10px] text-red-400 mb-2">{citeError}</p>}
                          <div className="flex items-center gap-2">
                            <input
                              value={citeTargetSlug}
                              onChange={(e) => setCiteTargetSlug(e.target.value)}
                              placeholder="target-experiment-slug"
                              className="px-2 py-1.5 bg-bg-elevated border border-[var(--border)] rounded text-[11px] text-white placeholder:text-[var(--muted)] flex-1"
                            />
                            <input
                              value={citeNote}
                              onChange={(e) => setCiteNote(e.target.value)}
                              placeholder="Note (optional)"
                              className="px-2 py-1.5 bg-bg-elevated border border-[var(--border)] rounded text-[11px] text-white placeholder:text-[var(--muted)] flex-1"
                            />
                            <button
                              onClick={handleAddCitation}
                              disabled={citeSubmitting}
                              className="px-3 py-1.5 bg-accent text-black text-[11px] font-semibold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 shrink-0"
                            >
                              {citeSubmitting ? 'Adding...' : 'Add'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
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
                  className="bg-bg-card border border-[var(--border)] rounded-xl p-5 hover:border-accent/30 hover:shadow-lg hover:shadow-black/10 transition-all flex flex-col"
                >
                  <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-1.5">Question</p>
                  <h3 className="text-[15px] font-semibold text-white mb-1.5 leading-snug line-clamp-2">{exp.title}</h3>
                  {exp.question && <p className="text-[12px] text-[var(--muted)] mb-3 line-clamp-2 leading-relaxed">{exp.question}</p>}

                  <div className="flex flex-wrap items-center gap-2 mb-3 text-[10px] text-[var(--muted)]">
                    <span className="bg-bg-elevated px-1.5 py-0.5 rounded">{exp.template}</span>
                    {exp.rows > 0 && (
                      <span className="bg-bg-elevated px-1.5 py-0.5 rounded">
                        {exp.rows >= 1000 ? `${exp.rows / 1000}K` : exp.rows} rows
                      </span>
                    )}
                  </div>

                  <div className="mb-3"><CredibilityBadges counts={exp} compact /></div>

                  <div className="flex-1" />

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] text-[10px] text-[var(--muted)]">
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
