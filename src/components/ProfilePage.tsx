import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { CredibilityBadges } from './ExperimentUI';
import { LoadingSpinner, EmptyState as SharedEmptyState } from './StatusViews';
import { getPublicProfile, updateUserProfile } from '../services/discoveryService';
import {
  getMyExperiments,
  getMyBookmarks,
  getMyReproductions,
  getMyReviewsAuthored,
  getMyValidations,
} from '../services/cloudSandboxService';

interface Props {
  onClose: () => void;
  onOpenExperiment: (slug: string) => void;
}

type Tab = 'published' | 'drafts' | 'bookmarks' | 'reproductions' | 'reviews' | 'validations';

const TABS: { id: Tab; label: string }[] = [
  { id: 'published', label: 'Published' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'bookmarks', label: 'Bookmarks' },
  { id: 'reproductions', label: 'Reproductions' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'validations', label: 'Validations' },
];

export function ProfilePage({ onClose, onOpenExperiment }: Props) {
  const { user, session } = useAuth();
  const accessToken = session?.access_token;
  const [showAuth, setShowAuth] = useState(false);

  const [tab, setTab] = useState<Tab>('published');
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState<Record<string, unknown>[]>([]);
  const [bookmarks, setBookmarks] = useState<Record<string, unknown>[]>([]);
  const [reproductions, setReproductions] = useState<Record<string, unknown>[]>([]);
  const [reviews, setReviews] = useState<Record<string, unknown>[]>([]);
  const [validations, setValidations] = useState<Record<string, unknown>[]>([]);

  const [editingProfile, setEditingProfile] = useState(false);
  const [bio, setBio] = useState('');
  const [researchInterests, setResearchInterests] = useState('');
  const [expertiseTags, setExpertiseTags] = useState('');
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (!accessToken || !user) { setShowAuth(true); setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getMyExperiments(accessToken),
      getMyBookmarks(accessToken),
      getMyReproductions(accessToken),
      getMyReviewsAuthored(accessToken),
      getMyValidations(accessToken),
      getPublicProfile(user.id),
    ]).then(([exps, bm, repro, rev, val, profile]) => {
      setExperiments(exps);
      setBookmarks(bm);
      setReproductions(repro);
      setReviews(rev);
      setValidations(val);
      if (profile?.profile) {
        setBio(profile.profile.bio || '');
        setResearchInterests(profile.profile.researchInterests || '');
        setExpertiseTags(profile.profile.expertiseTags || '');
        setFeaturedIds(profile.profile.featured.map((f) => f.id));
      }
      setLoading(false);
    });
  }, [accessToken]);

  async function handleSaveProfile() {
    if (!accessToken) return;
    setProfileSaving(true);
    const ok = await updateUserProfile(accessToken, {
      bio: bio.trim(),
      researchInterests: researchInterests.trim(),
      expertiseTags: expertiseTags.trim(),
      featuredExperimentIds: featuredIds,
    });
    setProfileSaving(false);
    if (ok) setEditingProfile(false);
  }

  function toggleFeatured(id: string) {
    setFeaturedIds((prev) => prev.includes(id) ? prev.filter((f) => f !== id) : prev.length >= 5 ? prev : [...prev, id]);
  }

  const published = experiments.filter((e) => e.status === 'published');
  const drafts = experiments.filter((e) => e.status === 'draft');

  const counts: Record<Tab, number> = {
    published: published.length,
    drafts: drafts.length,
    bookmarks: bookmarks.length,
    reproductions: reproductions.length,
    reviews: reviews.length,
    validations: validations.length,
  };

  // Aggregate reputation signals across everything this person has published —
  // the same primitives that make an individual Experiment credible, rolled
  // up to the person. This is the seed of a future reputation score, not a
  // popularity counter: it only counts things other people did in response
  // to real evidence (reproduced, validated, reviewed), never raw views.
  const totalReproductionsReceived = published.reduce((s, e) => s + ((e.reproduction_count as number) || 0), 0);
  const totalValidationsReceived = published.reduce((s, e) => s + ((e.validation_count as number) || 0), 0);
  const totalConfirmsReceived = published.reduce((s, e) => s + ((e.validation_confirms_count as number) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      <div className="h-12 border-b border-[var(--border)] bg-bg-elevated flex items-center px-4 gap-3 shrink-0">
        <span className="text-accent font-bold">Profile</span>
        <span className="ml-auto">
          <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-white">Close</button>
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {!accessToken ? (
          <div className="max-w-md mx-auto text-center py-24 px-6">
            <h2 className="text-lg font-semibold text-white mb-2">Sign in to view your Profile</h2>
            <p className="text-sm text-[var(--muted)] mb-5">Your published work, drafts, bookmarks, and analytical activity live here.</p>
            <button onClick={() => setShowAuth(true)} className="px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:bg-accent/90 transition-colors">Sign in</button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto p-6">
            {/* Profile header — deliberately shaped like a researcher/org
                profile masthead (name, identity, aggregate credibility)
                rather than a settings page, so it can grow into a public
                route later without restructuring. */}
            <div className="border-b border-[var(--border)] pb-6 mb-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-accent to-purple flex items-center justify-center text-black text-xl font-bold shrink-0">
                  {(user?.email || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">{user?.email}</h1>
                  <p className="text-xs text-[var(--muted)] mt-0.5">RealityDB SimLab &middot; Individual Profile</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 mt-5 text-sm">
                <div>
                  <p className="text-lg font-bold text-white">{published.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Published</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{totalReproductionsReceived}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Reproductions received</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{totalConfirmsReceived}<span className="text-[var(--muted)] text-sm">/{totalValidationsReceived}</span></p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Validations confirmed</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{reviews.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Reviews contributed</p>
                </div>
              </div>
            </div>

            {/* Identity — About / Research Interests / Expertise / Featured.
                Omitted entirely (no placeholder prompts) when not editing
                and nothing has been set — same "no fake content" precedent
                as the Discover layer's Coming Soon lenses. */}
            <div className="border-b border-[var(--border)] pb-6 mb-6">
              {!editingProfile ? (
                <>
                  {(bio || researchInterests || expertiseTags) && (
                    <div className="space-y-3 mb-3">
                      {bio && <p className="text-sm text-gray-200 leading-relaxed">{bio}</p>}
                      {researchInterests && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">Research Interests</p>
                          <p className="text-xs text-gray-300">{researchInterests}</p>
                        </div>
                      )}
                      {expertiseTags && (
                        <div className="flex flex-wrap gap-1.5">
                          {expertiseTags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                            <span key={t} className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent rounded-full">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <button onClick={() => setEditingProfile(true)} className="text-xs text-accent hover:underline">
                    {bio || researchInterests || expertiseTags ? 'Edit profile' : 'Add a bio, research interests, and expertise tags'}
                  </button>
                </>
              ) : (
                <div className="bg-bg-card border border-[var(--border)] rounded-lg p-4 space-y-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1 block">About</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="A short bio — who you are and what you work on."
                      className="w-full min-h-[70px] px-3 py-2 bg-bg-elevated border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1 block">Research Interests</label>
                    <input
                      value={researchInterests}
                      onChange={(e) => setResearchInterests(e.target.value)}
                      placeholder="e.g. fraud detection, data quality, supply chain analytics"
                      className="w-full px-3 py-2 bg-bg-elevated border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1 block">Expertise Tags</label>
                    <input
                      value={expertiseTags}
                      onChange={(e) => setExpertiseTags(e.target.value)}
                      placeholder="tags, comma, separated"
                      className="w-full px-3 py-2 bg-bg-elevated border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  {published.length > 0 && (
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1 block">Featured Experiments (up to 5)</label>
                      <div className="space-y-1.5 max-h-40 overflow-auto">
                        {published.map((e) => (
                          <label key={e.id as string} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                            <input type="checkbox" checked={featuredIds.includes(e.id as string)} onChange={() => toggleFeatured(e.id as string)} />
                            <span className="truncate">{e.title as string}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleSaveProfile}
                      disabled={profileSaving}
                      className="px-3 py-1.5 bg-accent text-black text-[11px] font-semibold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                    >
                      {profileSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditingProfile(false)} className="text-[11px] text-[var(--muted)] hover:text-white">Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-5 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    tab === t.id ? 'bg-accent text-black' : 'text-[var(--muted)] hover:text-white'
                  }`}
                >
                  {t.label} <span className="opacity-60">({counts[t.id]})</span>
                </button>
              ))}
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : (
              <div className="space-y-2">
                {tab === 'published' && (
                  published.length === 0
                    ? <EmptyState text="Nothing published yet. Run an analysis in SimLab and publish it here." />
                    : published.map((e) => (
                      <ExperimentRow key={e.id as string} exp={e} onOpen={() => e.slug && onOpenExperiment(e.slug as string)} showBadges />
                    ))
                )}
                {tab === 'drafts' && (
                  drafts.length === 0
                    ? <EmptyState text="No drafts in progress." />
                    : drafts.map((e) => (
                      <ExperimentRow key={e.id as string} exp={e} onOpen={undefined} />
                    ))
                )}
                {tab === 'bookmarks' && (
                  bookmarks.length === 0
                    ? <EmptyState text="Bookmark experiments from Discover to save them here." />
                    : bookmarks.map((e) => (
                      <ExperimentRow key={e.id as string} exp={e} onOpen={() => e.slug && onOpenExperiment(e.slug as string)} />
                    ))
                )}
                {tab === 'reproductions' && (
                  reproductions.length === 0
                    ? <EmptyState text="Reproduce a published Experiment to record your result here." />
                    : reproductions.map((r) => (
                      <ActivityRow
                        key={r.id as string}
                        title={r.title as string}
                        subtitle={(r.matched ? '✓ Matched' : '✗ Different result') + (r.notes ? ` — ${r.notes}` : '')}
                        date={r.created_at as string}
                        tone={r.matched ? 'positive' : 'warning'}
                        onOpen={() => r.slug && onOpenExperiment(r.slug as string)}
                      />
                    ))
                )}
                {tab === 'reviews' && (
                  reviews.length === 0
                    ? <EmptyState text="Review evidence on a published Experiment to build a track record here." />
                    : reviews.map((r) => (
                      <ActivityRow
                        key={r.id as string}
                        title={r.title as string}
                        subtitle={`${r.review_type}: ${r.content}`}
                        date={r.created_at as string}
                        tone={r.status === 'open' ? 'attention' : 'neutral'}
                        onOpen={() => r.slug && onOpenExperiment(r.slug as string)}
                      />
                    ))
                )}
                {tab === 'validations' && (
                  validations.length === 0
                    ? <EmptyState text="Validate a published Experiment's evidence to build a track record here." />
                    : validations.map((v) => (
                      <ActivityRow
                        key={v.id as string}
                        title={v.title as string}
                        subtitle={(v.note as string) || v.verdict as string}
                        date={v.created_at as string}
                        tone={v.verdict === 'confirms' ? 'positive' : v.verdict === 'disputes' ? 'warning' : 'neutral'}
                        onOpen={() => v.slug && onOpenExperiment(v.slug as string)}
                      />
                    ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <SharedEmptyState title={text} />;
}

function ExperimentRow({ exp, onOpen, showBadges }: { exp: Record<string, unknown>; onOpen?: () => void; showBadges?: boolean }) {
  const Wrapper = onOpen ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onOpen}
      className={`w-full text-left bg-bg-card border border-[var(--border)] rounded-lg p-4 flex items-center justify-between gap-4 ${onOpen ? 'hover:border-accent/30 transition-colors cursor-pointer' : ''}`}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-white truncate">{exp.title as string}</h3>
        {exp.question ? <p className="text-xs text-[var(--muted)] truncate mt-0.5">{exp.question as string}</p> : null}
        {showBadges && <div className="mt-2"><CredibilityBadges counts={exp} compact /></div>}
      </div>
      <span className="text-[10px] text-[var(--muted)] shrink-0">{exp.template as string}</span>
    </Wrapper>
  );
}

function ActivityRow({ title, subtitle, date, tone, onOpen }: { title: string; subtitle: string; date: string; tone: 'positive' | 'warning' | 'attention' | 'neutral'; onOpen: () => void }) {
  const toneColor = tone === 'positive' ? 'border-l-[#00e5a0]' : tone === 'warning' ? 'border-l-red-400' : tone === 'attention' ? 'border-l-accent' : 'border-l-[var(--border)]';
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left bg-bg-card border border-[var(--border)] ${toneColor} border-l-2 rounded-lg p-4 hover:border-accent/30 transition-colors`}
    >
      <p className="text-xs font-medium text-white truncate">{title || 'Untitled experiment'}</p>
      <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{subtitle}</p>
      <p className="text-[9px] text-[var(--muted)] mt-2">{new Date(date).toLocaleDateString()}</p>
    </button>
  );
}
