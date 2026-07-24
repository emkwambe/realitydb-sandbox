// SimLabHomePage.tsx — RealityDB SimLab landing page
// Built from SIMLAB-PRODUCT-VISION.md. Copy is used verbatim from the vision doc.
// Positioning: "An experimentation platform for data-intensive systems."

import type { ReactNode } from 'react';
import {
  Database,
  BarChart3,
  RefreshCw,
  ShieldCheck,
  FlaskConical,
  AppWindow,
  BrainCircuit,
  Activity,
  BookOpenCheck,
  Rocket,
  Plug,
  Search,
  Save,
  Trash2,
  ArrowRight,
  Terminal,
  GraduationCap,
  Briefcase,
} from 'lucide-react';

type Route = 'home' | 'data-store' | 'simlab' | 'pricing';

interface Props {
  onNavigate: (r: Route) => void;
}

// ── Section 3d — Why SimLab Exists (6 use cases) ──────────────────────
const USE_CASES = [
  {
    icon: FlaskConical,
    title: 'Validate Engineering Decisions',
    body: 'Will this schema scale? Does this index improve performance? Will this migration introduce problems? Experiment before making changes to production.',
  },
  {
    icon: BarChart3,
    title: 'Benchmark Data Systems',
    body: 'Test SQL performance. Evaluate transformations. Measure pipeline behavior. Compare architectures using identical datasets.',
  },
  {
    icon: AppWindow,
    title: 'Prototype Applications',
    body: 'Backend development should begin with realistic business data — not empty tables. Launch immediately with representative customers, products, invoices, and transactions.',
  },
  {
    icon: BrainCircuit,
    title: 'Evaluate AI and Machine Learning',
    body: 'Generate reproducible datasets. Create controlled train/test splits. Inject anomalies. Benchmark models. Repeat experiments under identical conditions.',
  },
  {
    icon: Activity,
    title: 'Simulate Real Business Scenarios',
    body: 'Test how systems behave during fraud spikes, inventory shortages, customer growth, infrastructure failures, compliance events, and seasonal demand.',
  },
  {
    icon: BookOpenCheck,
    title: 'Conduct Reproducible Research',
    body: 'Create controlled environments. Capture snapshots. Share datasets. Export notebooks. Repeat experiments consistently so others can reproduce them.',
  },
];

// ── Section 3e — Who SimLab Is For (8 audiences) ──────────────────────
const AUDIENCES = [
  { title: 'Software Engineers', body: 'Prototype applications using realistic databases instead of writing complex seed scripts.' },
  { title: 'Data Engineers', body: 'Validate transformations. Benchmark pipelines. Test architecture. Stress-test infrastructure safely.' },
  { title: 'Data Scientists', body: 'Generate reproducible datasets. Evaluate models. Run controlled experiments. Compare results across scenarios.' },
  { title: 'Analytics Teams', body: 'Prototype metrics. Validate business logic. Develop dashboards. Investigate hypotheses.' },
  { title: 'Research Teams', body: 'Perform repeatable experiments using realistic business environments. Share evidence. Publish reproducible workflows.' },
  { title: 'Product Teams', body: 'Evaluate product ideas against realistic datasets before implementation.' },
  { title: 'Consulting Firms', body: 'Demonstrate solutions using realistic customer environments without exposing client data.' },
  { title: 'Enterprise Innovation Teams', body: 'Support proof-of-concepts, hackathons, technology evaluations, and vendor comparisons without risking production systems.' },
];

// ── Section 3f — How SimLab Works (5 steps) ───────────────────────────
const STEPS = [
  { icon: Rocket, title: 'Provision', body: 'Choose a business template and dataset size. RealityDB provisions an isolated PostgreSQL laboratory populated with production-realistic synthetic data. Typically ready in under one minute.' },
  { icon: Plug, title: 'Connect', body: 'Use the standard PostgreSQL connection string with the tools you already know. No proprietary SDKs. No custom drivers.' },
  { icon: Search, title: 'Experiment', body: 'Write SQL. Develop software. Run notebooks. Benchmark pipelines. Simulate scenarios. Compare alternative approaches.' },
  { icon: Save, title: 'Capture Results', body: 'Export notebooks. Save SQL. Snapshot environments. Generate reproducible experiment artifacts. Share findings with teammates.' },
  { icon: Trash2, title: 'Reset', body: 'Delete the laboratory. Or simply allow automatic expiration. Every experiment starts with a clean environment.' },
];

// ── Section 3h — What "Production-Realistic" means (10 items) ──────────
const REALISTIC = [
  'Realistic schemas',
  'Foreign-key relationships',
  'Business workflows',
  'Transaction history',
  'Customer lifecycles',
  'Inventory movement',
  'Payment activity',
  'Temporal behavior',
  'Operational distributions',
  'Realistic data volumes',
];

// ── Section 3i — Tool Integrations ────────────────────────────────────
// Verified integrations only. Add more incrementally as each is validated.
const TOOLS = [
  'psql', 'Python', 'Node.js', 'Jupyter',
  'DBeaver', 'Tableau', 'Google Colab', 'R Studio',
];

// ── Section 3j — The ecosystem (trio + HireSQL) ───────────────────────
const ECOSYSTEM = [
  { name: 'RealityDB CLI', domain: 'realitydb.dev', body: 'Generate production-realistic data locally. On-premise. DORA compliant.', href: 'https://realitydb.dev', icon: Terminal, color: '#22d3ee' },
  { name: 'RealityDB SimLab', domain: 'sandbox.realitydb.dev', body: 'Spin up live PostgreSQL labs. No setup. Any tool.', href: undefined, icon: FlaskConical, color: '#ffb444', here: true },
  { name: 'RealityDB Academy', domain: 'academy.realitydb.dev', body: 'Learn SQL on realistic data. Get certified.', href: 'https://academy.realitydb.dev', icon: GraduationCap, color: '#a78bfa' },
  { name: 'HireSQL', domain: 'hiresql.dev', body: 'Assess SQL skills with realistic business scenarios.', href: 'https://hiresql.dev', icon: Briefcase, color: '#00e5a0' },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.2em] text-accent/80 font-semibold mb-3">
      {children}
    </p>
  );
}

export function SimLabHomePage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen bg-bg text-gray-200">
      {/* ── 3a — Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[var(--border)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(60% 60% at 50% 0%, rgba(34,211,238,0.10) 0%, rgba(6,7,10,0) 70%)',
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 pt-24 pb-20 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-bg-elevated px-3 py-1 text-[11px] text-[var(--muted)] mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-green" />
            Free tier — 5,000 rows, no credit card
          </span>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight text-white md:text-5xl">
            Try a live database in 60 seconds.
          </h1>
          <p className="mx-auto mt-4 text-2xl font-semibold text-accent">
            Love it? Keep it.
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
            Realistic synthetic data for banking, healthcare, insurance, and more.
            No real data. No setup. No risk.
          </p>

          {/* Terminal — the claim IS the pitch */}
          <div className="mx-auto mt-8 max-w-lg rounded-lg border border-[var(--border)] bg-bg-elevated px-5 py-4 text-left font-mono text-[13px] leading-relaxed">
            <div className="text-gray-200">
              <span className="text-[var(--muted)]">$</span> rdb lab create us-banking --rows 5000
            </div>
            <div className="text-[var(--muted)]">→ Provisioning...</div>
            <div className="text-green">✅ Live in 00:12</div>
            <div className="text-accent">postgresql://...</div>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => onNavigate('simlab')}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Claim a Free Database <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => onNavigate('data-store')}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-bg-elevated px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-accent/50"
            >
              Explore Templates
            </button>
          </div>

          {/* Free tier callout */}
          <p className="mx-auto mt-5 text-[13px] text-[var(--muted)]">
            Free tier includes 5,000 rows and a 30-minute lab — no signup required to start.
          </p>
        </div>
      </section>

      {/* ── 3b — What is RealityDB SimLab? ─────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <SectionLabel>What is RealityDB SimLab?</SectionLabel>
        <p className="text-lg leading-relaxed text-gray-300">
          RealityDB SimLab is an on-demand experimentation platform built on real
          PostgreSQL databases. Every laboratory is a fully functional Neon PostgreSQL
          database preloaded with production-realistic synthetic business data. Each
          environment is isolated, temporary, and disposable, allowing individuals and
          teams to safely test ideas, validate assumptions, compare solutions, and
          perform experiments without affecting production systems.
        </p>
      </section>

      {/* ── 3c — Three Core Principles ─────────────────────────────── */}
      <section className="border-y border-[var(--border)] bg-bg-elevated/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { icon: Database, color: '#22d3ee', title: 'Real PostgreSQL', body: 'This is not a simulator. Every laboratory is a real PostgreSQL database that works with the same tools, drivers, queries, and workflows used in production.' },
              { icon: BarChart3, color: '#a78bfa', title: 'Production-realistic Data', body: 'Synthetic data should not merely look realistic — it should behave realistically. RealityDB preserves relationships, constraints, distributions, temporal patterns, and business structures while containing no confidential information.' },
              { icon: RefreshCw, color: '#00e5a0', title: 'Disposable Laboratories', body: 'Create an environment. Experiment freely. Keep it if you need it. Delete it when finished — or let it expire automatically. No cleanup. No infrastructure management. No long-term cost.' },
            ].map((p) => (
              <div key={p.title} className="rounded-2xl border border-[var(--border)] bg-bg-card p-6">
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: p.color + '18', color: p.color }}
                >
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">{p.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--muted)]">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3d — Why SimLab Exists (6 use cases) ───────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 text-center">
          <SectionLabel>Why SimLab exists</SectionLabel>
          <h2 className="text-2xl font-bold text-white md:text-3xl">The problems it solves</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((u) => (
            <div key={u.title} className="rounded-2xl border border-[var(--border)] bg-bg-card p-6 transition-colors hover:border-accent/40">
              <u.icon className="mb-4 h-6 w-6 text-accent" />
              <h3 className="mb-2 text-base font-semibold text-white">{u.title}</h3>
              <p className="text-sm leading-relaxed text-[var(--muted)]">{u.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3e — Who SimLab Is For (8 audiences) ───────────────────── */}
      <section className="border-y border-[var(--border)] bg-bg-elevated/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 text-center">
            <SectionLabel>Who it's for</SectionLabel>
            <h2 className="text-2xl font-bold text-white md:text-3xl">Built for anyone who tests before they ship</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map((a) => (
              <div key={a.title} className="rounded-xl border border-[var(--border)] bg-bg-card p-5">
                <h3 className="mb-1.5 text-sm font-semibold text-white">{a.title}</h3>
                <p className="text-[13px] leading-relaxed text-[var(--muted)]">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3f — How SimLab Works (5 steps) ────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 text-center">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="text-2xl font-bold text-white md:text-3xl">From idea to evidence in five steps</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-[var(--border)] bg-bg-card p-5">
              <span className="mb-3 inline-block text-xs font-bold text-accent/60">
                {String(i + 1).padStart(2, '0')}
              </span>
              <s.icon className="mb-3 h-6 w-6 text-white" />
              <h3 className="mb-1.5 text-sm font-semibold text-white">{s.title}</h3>
              <p className="text-[12px] leading-relaxed text-[var(--muted)]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3g — Why Synthetic Data? ───────────────────────────────── */}
      <section className="border-y border-[var(--border)] bg-bg-elevated/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mb-10 text-center">
            <SectionLabel>Why synthetic data?</SectionLabel>
            <h2 className="text-2xl font-bold text-white md:text-3xl">Safe experimentation, without the risk</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-[#ef4444]/25 bg-[#ef4444]/[0.04] p-6">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#f87171]">
                <ShieldCheck className="h-4 w-4" /> Why not production data?
              </h3>
              <ul className="space-y-2.5 text-sm text-[var(--muted)]">
                {[
                  'Contains confidential customer information',
                  'Holds financial records and healthcare data',
                  'Exposes operational intelligence',
                  'Sharing is often prohibited by privacy regulations',
                  'Restricted by contractual obligations',
                  'Governed by internal compliance policies',
                ].map((r) => (
                  <li key={r} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#f87171]" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-green/25 bg-green/[0.04] p-6">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-green">
                <ShieldCheck className="h-4 w-4" /> What RealityDB does instead
              </h3>
              <ul className="space-y-2.5 text-sm text-[var(--muted)]">
                {[
                  'Preserves the structure and behavior of real systems',
                  'Never reproduces real individuals or organizations',
                  'Maintains relationships, constraints, and distributions',
                  'Enables safe experimentation by default',
                  'Keeps you inside security and compliance boundaries',
                  'Removes the wait for data access approvals',
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-green" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3h — What "Production-Realistic" means ─────────────────── */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <SectionLabel>What "production-realistic" means</SectionLabel>
        <h2 className="mb-8 text-2xl font-bold text-white md:text-3xl">
          Your laboratory includes
        </h2>
        <div className="flex flex-wrap justify-center gap-2.5">
          {REALISTIC.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[var(--border)] bg-bg-card px-4 py-2 text-sm text-gray-300"
            >
              {item}
            </span>
          ))}
        </div>
        <p className="mt-8 text-sm text-[var(--muted)]">
          Without exposing real customers or confidential information.
        </p>
      </section>

      {/* ── 3i — Tool Integrations ─────────────────────────────────── */}
      <section className="border-y border-[var(--border)] bg-bg-elevated/40">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <SectionLabel>Tool integrations</SectionLabel>
          <h2 className="mb-2 text-2xl font-bold text-white md:text-3xl">
            No proprietary workflow. No vendor lock-in.
          </h2>
          <p className="mb-8 text-sm text-[var(--muted)]">
            A standard PostgreSQL connection string works with every tool you already use.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {TOOLS.map((tool) => (
              <span
                key={tool}
                className="rounded-lg border border-[var(--border)] bg-bg-card px-3.5 py-2 text-[13px] font-medium text-gray-300"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3j — The ecosystem ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 text-center">
          <SectionLabel>The RealityDB ecosystem</SectionLabel>
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            One platform, from local generation to live labs
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ECOSYSTEM.map((e) => {
            const inner = (
              <>
                <div
                  className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: e.color + '18', color: e.color }}
                >
                  <e.icon className="h-5 w-5" />
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{e.name}</h3>
                  {e.here && (
                    <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[9px] font-bold uppercase text-amber">
                      You are here
                    </span>
                  )}
                </div>
                <p className="mb-2 font-mono text-[11px]" style={{ color: e.color }}>{e.domain}</p>
                <p className="text-[13px] leading-relaxed text-[var(--muted)]">{e.body}</p>
              </>
            );
            const cls =
              'block rounded-2xl border border-[var(--border)] bg-bg-card p-6 transition-colors ' +
              (e.here ? 'ring-1 ring-amber/30' : 'hover:border-accent/40');
            return e.href ? (
              <a key={e.name} href={e.href} target="_blank" rel="noopener noreferrer" className={cls}>
                {inner}
              </a>
            ) : (
              <div key={e.name} className={cls}>{inner}</div>
            );
          })}
        </div>
      </section>

      {/* ── 3k — Closing Vision ────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-[var(--border)]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 80% at 50% 100%, rgba(34,211,238,0.10) 0%, rgba(6,7,10,0) 70%)',
          }}
        />
        <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            Experiment Before Reality Does
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
            Whether you're evaluating an engineering change, comparing analytical approaches,
            validating AI models, prototyping applications, or researching new ideas, SimLab
            gives you a safe environment where evidence — not assumptions — drives decisions.
          </p>
          <p className="mt-8 text-lg font-semibold text-white">
            One laboratory. Infinite experiments. Better decisions.
          </p>
          <button
            onClick={() => onNavigate('simlab')}
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Launch a Lab <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-6 text-center">
        <p className="text-[11px] text-[var(--muted)]">
          Mpingo Systems LLC — Precision Tools built to stay.
        </p>
      </footer>
    </div>
  );
}
