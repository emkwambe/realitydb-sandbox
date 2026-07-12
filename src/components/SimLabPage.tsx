// SimLabPage.tsx — Full SimLab product page
// Replaces the inline 4-template selector in App.tsx
// Fetches templates from Lab API, explains workflow, shows pricing

import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
// @ts-ignore - SimLabV3 is a JSX file
import SimLabV3 from './SimLabV3';

const LAB_API_URL = import.meta.env.VITE_LAB_API_URL || 'https://realitydb-lab-api.eddy-078.workers.dev';
const LAB_API_KEY = import.meta.env.VITE_LAB_API_KEY || '';

interface StoreTemplate {
  template: string;
  variants: { size: string; rows: number; priceCents: number; free: boolean }[];
}

interface ActiveLab {
  id: string;
  name: string;
  template: string;
  rows: number;
  connection_string: string;
  status: string;
  expiresAt: string;
}

const TEMPLATE_META: Record<string, { name: string; icon: string; tables: number; domain: string; description: string; badge?: string; eu?: boolean }> = {
  'eu-banking':    { name: 'EU Banking',           icon: '\u{1F3E6}',       tables: 11, domain: 'Finance \u00B7 EU Enterprise',    description: 'SEPA transfers, PSD2 consents, MiFID II orders, KYC/EDD, AML/SAR filings', badge: 'EU \u00B7 DORA \u00B7 PSD2',  eu: true },
  'eu-healthcare': { name: 'EU Healthcare',        icon: '\u2695\uFE0F',    tables: 14, domain: 'Healthcare \u00B7 EU Enterprise', description: 'ICD-10 diagnoses, WHO ATC medications, EHDS encounters, GDPR Art.9',       badge: 'EU \u00B7 EHDS \u00B7 Art.9', eu: true },
  'eu-telecom':    { name: 'EU Telecom',           icon: '\u{1F4F6}',       tables: 12, domain: 'Telecom \u00B7 EU Enterprise',    description: 'Subscribers, BEREC QoS, GDPR consent, EECC portability, churn events',       badge: 'EU \u00B7 BEREC \u00B7 EECC', eu: true },
  banking:         { name: 'Retail Banking',       icon: '\u{1F3E6}',       tables: 16, domain: 'Finance',    description: 'Accounts, transactions, loans, KYC, compliance' },
  oncology:        { name: 'Oncology Research',    icon: '\u{1F52C}',       tables: 20, domain: 'Healthcare', description: 'Patients, diagnoses, treatments, clinical trials, biomarker expression' },
  healthcare:      { name: 'Healthcare Analytics', icon: '\u{1F3E5}',       tables: 14, domain: 'Healthcare', description: 'Hospital operations, insurance claims, billing, lab tests' },
  'supply-chain':  { name: 'Supply Chain',         icon: '\u{1F69A}',       tables: 24, domain: 'Enterprise', description: 'Suppliers, shipments, warehouses, inventory, demand forecasting' },
  aml:             { name: 'AML Compliance',       icon: '\u{1F575}\uFE0F', tables: 9,  domain: 'Finance',    description: 'Customers, accounts, KYC docs, devices, beneficiaries, transactions, SARs' },
  fintech:         { name: 'FinTech Platform',     icon: '\u{1F4B3}',       tables: 9,  domain: 'Finance',    description: 'Customers, merchants, accounts, transactions, fraud alerts, KYC' },
  telecom:         { name: 'Telecom & Network',    icon: '\u{1F4E1}',       tables: 21, domain: 'Technology', description: 'Subscribers, cell towers, usage records, billing, churn predictions' },
  universal:       { name: 'Universal Starter',    icon: '\u{1F310}',       tables: 6,  domain: 'Universal', description: 'Users, transactions, audit logs, API requests, errors, addresses' },
};

// Display order for the template grid \u2014 EU enterprise packs first, then standard packs.
const TEMPLATE_ORDER = ['eu-banking', 'eu-healthcare', 'eu-telecom', 'banking', 'oncology', 'healthcare', 'supply-chain', 'aml', 'fintech', 'telecom', 'universal'];

const ROW_OPTIONS = [
  { value: 5000,   label: '5K rows',   tier: 'Free',       tierColor: '#00e5a0' },
  { value: 10000,  label: '10K rows',  tier: 'Core',       tierColor: '#22d3ee' },
  { value: 50000,  label: '50K rows',  tier: 'Core',       tierColor: '#22d3ee' },
  { value: 100000, label: '100K rows', tier: 'Compliance', tierColor: '#a78bfa' },
];

const WORKFLOW_STEPS = [
  { icon: '\u{1F680}', title: 'Create', description: 'Pick a template and row count. A Neon PostgreSQL branch spins up in seconds with your data pre-loaded.' },
  { icon: '\u{1F517}', title: 'Connect', description: 'Get a connection string. Use psql, DBeaver, Jupyter, Tableau, Python, Node.js — any PostgreSQL client.' },
  { icon: '\u{1F50D}', title: 'Query', description: 'Run SQL against production-realistic data. Test joins, aggregations, window functions on real-world schemas.' },
  { icon: '\u{1F4E4}', title: 'Export', description: 'Save queries, export as Jupyter notebook (.ipynb), snapshot to SQL, or share with teammates.' },
  { icon: '\u{1F5D1}\uFE0F', title: 'Destroy', description: 'Delete when done. Auto-expires after 4 hours. No cleanup needed. Zero cost when idle.' },
];

function formatTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface Props {
  onClose: () => void;
  onGallery?: () => void;
  preloadTemplate?: string;
  preloadRows?: number;
}

export function SimLabPage({ onClose, onGallery, preloadTemplate, preloadRows }: Props) {
  const { user, session } = useAuth();
  const [templates, setTemplates] = useState<StoreTemplate[]>([]);
  const [activeLabs, setActiveLabs] = useState<ActiveLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState(5000);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState('');
  const [upgradeInfo, setUpgradeInfo] = useState<{ message: string; tier: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [connectionString, setConnectionString] = useState('');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [showManage, setShowManage] = useState(false);

  // Fetch available templates from Lab API
  useEffect(() => {
    fetch(`${LAB_API_URL}/v1/store`)
      .then(res => res.json())
      .then((data: { datasets: StoreTemplate[] }) => {
        setTemplates(data.datasets);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch active labs for current user
  useEffect(() => {
    if (!user) return;
    fetch(`${LAB_API_URL}/v1/labs`, {
      headers: { 'X-API-Key': LAB_API_KEY },
    })
      .then(res => res.json())
      .then((labs: ActiveLab[]) => {
        setActiveLabs(Array.isArray(labs) ? labs.filter(l => l.status === 'active') : []);
      })
      .catch(() => {});
  }, [user]);

  // Preselect template + row count when arriving from the Data Store ("Load in SimLab").
  useEffect(() => {
    if (preloadTemplate) {
      setSelectedTemplate(preloadTemplate);
      if (preloadRows) setSelectedRows(preloadRows);
    }
  }, [preloadTemplate, preloadRows]);

  const handleLaunch = async () => {
    if (!user) { setShowAuth(true); return; }
    if (!selectedTemplate) return;

    setProvisioning(true);
    setError('');
    setUpgradeInfo(null);

    try {
      const res = await fetch(`${LAB_API_URL}/v1/labs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': LAB_API_KEY },
        body: JSON.stringify({ template: selectedTemplate, rows: selectedRows, userId: user.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        if (res.status === 403 && err.upgradeRequired) {
          setUpgradeInfo({ message: err.error, tier: err.tier || 'free' });
        } else {
          setError(err.error || `Failed to create lab (${res.status})`);
        }
        setProvisioning(false);
        return;
      }

      const lab = await res.json();
      setConnectionString(lab.connectionString || lab.connection_string || '');
      setActiveLabs(prev => [...prev, lab]);
      setProvisioning(false);
      // Auto-scroll to connection section
      setTimeout(() => {
        const el = document.getElementById('connection');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e) {
      setError('Network error. Check your connection.');
      setProvisioning(false);
    }
  };

  const handleDestroy = async (labId: string) => {
    await fetch(`${LAB_API_URL}/v1/labs/${labId}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': LAB_API_KEY },
    });
    setActiveLabs(prev => prev.filter(l => l.id !== labId));
    if (connectionString) setConnectionString('');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(label);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const meta = selectedTemplate ? TEMPLATE_META[selectedTemplate] : null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0c10] flex flex-col overflow-auto">
      {/* Header */}
      <div className="h-12 border-b border-[#1e293b] bg-[#0f1117] flex items-center px-6 gap-3 shrink-0">
        <button onClick={onClose} className="text-xs text-[#64748b] hover:text-white transition-colors">&larr; Back</button>
        <span className="text-[#fbbf24] font-bold text-sm">SimLab</span>
        <span className="text-[#64748b] text-sm">Disposable Cloud PostgreSQL</span>
        <span className="ml-auto flex gap-2 items-center">
          <button onClick={() => setShowManage(true)} className="text-[10px] text-[#06d6a0] border border-[#06d6a0]/30 rounded px-2 py-1 hover:bg-[#06d6a0]/10">
            Open SimLab &rarr;
          </button>
          {onGallery && (
            <button onClick={onGallery} className="text-[10px] text-[#22d3ee] border border-[#22d3ee]/30 rounded px-2 py-1 hover:bg-[#22d3ee]/10">
              Lab Gallery
            </button>
          )}
          {user && (
            <span className="text-[10px] text-[#64748b]">{activeLabs.length} active lab{activeLabs.length !== 1 ? 's' : ''}</span>
          )}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-3">
            Real PostgreSQL.<br />
            <span className="text-[#fbbf24]">Production data. Zero cleanup.</span>
          </h1>
          <p className="text-sm text-[#94a3b8] max-w-lg mx-auto mb-6">
            Spin up a disposable Neon PostgreSQL database pre-loaded with production-realistic synthetic data.
            Connect with any tool. Auto-expires when you're done.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {['Neon PostgreSQL 16', '4-hour TTL (extendable)', 'Auto-cleanup', 'Jupyter + DBeaver + Tableau'].map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#1e293b] text-[10px] text-[#64748b]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24]" />
                {f}
              </span>
            ))}
          </div>
        </section>

        {/* Workflow steps now live in the sticky left column of the two-column
            split below (see "How it works" inside the Template Selection section). */}

        {/* Active Labs */}
        {activeLabs.length > 0 && (
          <section className="max-w-4xl mx-auto px-6 pb-8">
            <h2 className="text-sm font-semibold text-white mb-3">Your Active Labs</h2>
            <div className="space-y-2">
              {activeLabs.map(lab => {
                const m = TEMPLATE_META[lab.template];
                return (
                  <div key={lab.id} className="bg-[#0f1117] border border-[#1e293b] rounded-lg p-4 flex items-center gap-4">
                    <span className="text-lg">{m?.icon || '\u{1F4BE}'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white">{m?.name || lab.template}</p>
                      <p className="text-[10px] text-[#64748b]">{lab.rows.toLocaleString()} rows &middot; {formatTimeRemaining(lab.expiresAt)} remaining</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(lab.connection_string, lab.id)}
                      className="text-[10px] px-2 py-1 bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/30 rounded hover:bg-[#22d3ee]/20"
                    >
                      {copiedSnippet === lab.id ? 'Copied!' : 'Copy Connection'}
                    </button>
                    <button
                      onClick={() => handleDestroy(lab.id)}
                      className="text-[10px] px-2 py-1 text-[#ef4444] border border-[#ef4444]/30 rounded hover:bg-[#ef4444]/10"
                    >
                      Destroy
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Connection String Display */}
        {connectionString && (
          <section id="connection" className="max-w-4xl mx-auto px-6 pb-8">
            <div className="bg-[#0f1117] border-2 border-[#00e5a0] rounded-xl p-5">
              <h2 className="text-sm font-bold text-[#00e5a0] mb-2">Lab Created!</h2>
              <p className="text-[10px] text-[#64748b] mb-3">Your database is ready. Connect with any PostgreSQL client:</p>
              <div className="bg-[#0a0c10] rounded-lg p-3 font-mono text-[11px] text-[#22d3ee] break-all mb-3 relative">
                {connectionString}
                <button
                  onClick={() => copyToClipboard(connectionString, 'conn')}
                  className="absolute top-2 right-2 text-[9px] px-2 py-0.5 bg-[#1e293b] rounded text-[#94a3b8] hover:text-white"
                >
                  {copiedSnippet === 'conn' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: 'psql', cmd: `psql "${connectionString}"` },
                  { label: 'Python', cmd: `import psycopg2\nconn = psycopg2.connect("${connectionString}")` },
                  { label: 'Node.js', cmd: `const { Pool } = require('pg');\nconst pool = new Pool({ connectionString: '${connectionString}' });` },
                  { label: 'Jupyter', cmd: `%load_ext sql\n%sql ${connectionString}` },
                  { label: 'DBeaver', cmd: `Connection URL: ${connectionString}` },
                  { label: 'Tableau', cmd: `Server: (parse host)\nPort: 5432\nDatabase: neondb` },
                  { label: 'Google Colab', cmd: `# In Google Colab\n!pip install psycopg2-binary sqlalchemy\nfrom sqlalchemy import create_engine\nengine = create_engine('\')\n# Query example:\nimport pandas as pd\ndf = pd.read_sql('SELECT * FROM patients LIMIT 10', engine)\ndf.head()` },
                ].map((s, i) => (
                  <button key={i}
                    onClick={() => copyToClipboard(s.cmd, s.label)}
                    className="text-[10px] py-2 px-3 bg-[#1e293b] rounded-lg text-[#94a3b8] hover:text-white hover:bg-[#334155] transition-colors text-left"
                  >
                    {copiedSnippet === s.label ? '\u2705 Copied!' : s.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Two-column split: sticky "How it works" steps (left) + scrollable
            template selection / row size / launch (right). */}
        <section className="max-w-6xl mx-auto px-6 pb-8 lg:grid lg:grid-cols-[300px_1fr] lg:gap-6 lg:items-start">
          {/* LEFT: How it works — sticky on desktop, horizontal scroll bar on mobile */}
          <div className="mb-6 lg:mb-0 lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto lg:py-2">
            <h2 className="text-xs text-[#64748b] uppercase tracking-wider mb-3">How it works</h2>
            <div className="flex flex-row gap-3 overflow-x-auto pb-2 lg:flex-col lg:overflow-x-visible lg:pb-0">
              {WORKFLOW_STEPS.map((step, i) => {
                const stepId = ['templates', 'connection', 'connection', 'connection', 'connection'][i];
                const isActive = i === 0 ? !connectionString : i === 1 ? !!connectionString : false;
                return (
                  <button key={i}
                    onClick={() => {
                      const el = document.getElementById(stepId);
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`w-44 shrink-0 lg:w-auto lg:shrink bg-[#0f1117] border rounded-lg p-3 text-left transition-all cursor-pointer hover:border-[#fbbf24]/50 ${
                      isActive ? 'border-[#fbbf24] bg-[#fbbf24]/5' : 'border-[#1e293b]'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{step.icon}</span>
                      <p className="text-xs font-semibold text-white">{step.title}</p>
                      <span className="ml-auto text-[9px] font-mono text-[#64748b]">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <p className="text-[10px] text-[#64748b] leading-relaxed">{step.description}</p>
                    {isActive && <span className="mt-1 block text-[9px] text-[#fbbf24] font-semibold">Current step</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT: template selection + row size + launch */}
          <div className="min-w-0">
        {/* Template Selection */}
        <section id="templates" className="pb-8">
          <h2 className="text-sm font-semibold text-white mb-1">Select a Template</h2>
          <p className="text-[10px] text-[#64748b] mb-4">
            {templates.length} production-realistic schemas &middot; All with FK integrity, temporal ordering, lifecycle rules
          </p>

          {loading ? (
            <div className="text-center py-8 text-[#64748b] text-sm">Loading templates...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map(t => {
                const m = TEMPLATE_META[t.template];
                if (!m) return null;
                const isSelected = selectedTemplate === t.template;
                return (
                  <Fragment key={t.template}>
                  <button
                    onClick={() => { setSelectedTemplate(t.template); setConnectionString(''); setError(''); }}
                    className={`border rounded-xl p-4 text-left transition-all ${
                      isSelected
                        ? 'border-[#fbbf24] bg-[#fbbf24]/5'
                        : 'border-[#1e293b] bg-[#0f1117] hover:border-[#334155]'
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-lg">{m.icon}</span>
                      <div>
                        <p className="text-xs font-bold text-white">{m.name}</p>
                        <p className="text-[9px] text-[#64748b] uppercase">{m.domain}</p>
                      </div>
                      {isSelected && <span className="ml-auto text-[#fbbf24] text-xs">\u2713</span>}
                    </div>
                    <p className="text-[10px] text-[#94a3b8] mb-2">{m.description}</p>
                    <p className="text-[9px] text-[#64748b]">{m.tables} tables &middot; 5K rows free</p>
                  </button>
                  {isSelected && (
                    <div className="col-span-full">
                      {/* Row Size + Launch — inline, immediately below the selected card */}
                      <div className="bg-[#0f1117] border border-[#1e293b] rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="text-xl">{m.icon}</span>
                          <div>
                            <h3 className="text-sm font-bold text-white">{m.name}</h3>
                            <p className="text-[10px] text-[#64748b]">{m.tables} tables &middot; {m.description}</p>
                          </div>
                        </div>

                        <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Select size</p>
                        <div className="flex gap-2 mb-4 flex-wrap">
                          {ROW_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setSelectedRows(opt.value)}
                              className={`px-3 py-2 rounded-lg text-xs transition-all ${
                                selectedRows === opt.value
                                  ? 'bg-[#fbbf24]/10 border-2 border-[#fbbf24] text-white font-semibold'
                                  : 'bg-[#0a0c10] border border-[#1e293b] text-[#94a3b8] hover:border-[#334155]'
                              }`}
                            >
                              {opt.label}
                              <span className="block text-[9px] mt-0.5" style={{ color: opt.tierColor }}>{opt.tier}</span>
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          <button
                            onClick={handleLaunch}
                            disabled={provisioning}
                            className="px-5 py-2.5 bg-[#fbbf24] text-black text-sm font-semibold rounded-lg hover:bg-[#fbbf24]/90 transition-colors disabled:opacity-50"
                          >
                            {provisioning ? 'Creating database...' : `Launch ${m.name} (${selectedRows >= 1000 ? selectedRows/1000 + 'K' : selectedRows} rows)`}
                          </button>
                          <div className="text-[10px] text-[#64748b]">
                            Auto-expires in 4 hours &middot; Extendable &middot; Neon PostgreSQL 16
                          </div>
                        </div>

                        {error && (
                          <div className="mt-3 p-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg text-xs text-[#ef4444]">
                            {error}
                          </div>
                        )}

                        {upgradeInfo && (
                          <div className="mt-3 p-3 bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded-lg text-xs text-[#fbbf24] flex items-center justify-between gap-3">
                            <span>{upgradeInfo.message}</span>
                            <a
                              href="#pricing"
                              className="shrink-0 px-3 py-1.5 bg-[#fbbf24] text-black text-[10px] font-semibold rounded-lg hover:bg-[#fbbf24]/90 transition-colors whitespace-nowrap"
                            >
                              Upgrade &rarr;
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  </Fragment>
                );
              })}
            </div>
          )}
        </section>

          </div>
        </section>

        {/* Pricing */}
        <section className="max-w-4xl mx-auto px-6 pb-12">
          <h2 className="text-sm font-semibold text-white mb-1">SimLab Pricing</h2>
          <p className="text-[10px] text-[#64748b] mb-4">Start free. Scale when you need more.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { tier: 'Free', price: '$0', features: ['5K rows', '2 active labs', '5 labs/day', 'Community support'], color: '#00e5a0' },
              { tier: 'Core', price: '$99/mo', features: ['50K rows', '3 active labs', '10 labs/day', 'Email support'], color: '#22d3ee' },
              { tier: 'Compliance', price: '$299/mo', features: ['100K rows', '10 active labs', '20 labs/day', 'EU AI Act reports'], color: '#a78bfa' },
              { tier: 'Enterprise', price: 'Custom', features: ['1M+ rows', 'Unlimited labs', 'Dedicated support', 'SLA + on-prem'], color: '#fbbf24' },
            ].map((t, i) => (
              <div key={i} className="bg-[#0f1117] border border-[#1e293b] rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: t.color }}>{t.tier}</p>
                <p className="text-lg font-bold text-white mb-2">{t.price}</p>
                <ul className="space-y-1">
                  {t.features.map((f, j) => (
                    <li key={j} className="text-[10px] text-[#94a3b8] flex items-start gap-1.5">
                      <span style={{ color: t.color }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Connection Methods */}
        <section className="max-w-4xl mx-auto px-6 pb-12">
          <h2 className="text-sm font-semibold text-white mb-1">Connect From Anywhere</h2>
          <p className="text-[10px] text-[#64748b] mb-4">Standard PostgreSQL connection string. Works with every tool.</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {['psql', 'Python', 'Node.js', 'Jupyter', 'DBeaver', 'Tableau', 'Google Colab', 'R Studio'].map((tool, i) => (
              <div key={i} className="bg-[#0f1117] border border-[#1e293b] rounded-lg p-3 text-center">
                <p className="text-xs text-white font-medium">{tool}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CLI + Footer */}
        <section className="max-w-4xl mx-auto px-6 pb-8">
          <div className="bg-[#0f1117] border border-[#1e293b] rounded-xl p-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1">
              <h3 className="text-xs font-bold text-white mb-1">Prefer the CLI?</h3>
              <p className="text-[10px] text-[#64748b]">
                Create labs programmatically with <code className="text-[#fbbf24]">realitydb lab create</code>.
                14 lab commands for scripting and CI/CD.
              </p>
            </div>
            <code className="px-3 py-1.5 bg-[#0a0c10] rounded-lg border border-[#1e293b] text-[#22d3ee] text-[11px] font-mono whitespace-nowrap">
              npm install -g @realitydb/cli
            </code>
          </div>
        </section>

        <footer className="border-t border-[#1e293b] py-4 px-6 text-center">
          <p className="text-[10px] text-[#64748b]">
            Mpingo Systems LLC — Precision Tools built to stay.
          </p>
        </footer>
      </div>

      {showAuth && <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />}

      {showManage && (
        <div className="fixed inset-0 z-[60] overflow-auto bg-[#0a0f1a]">
          <SimLabV3 onClose={() => setShowManage(false)} onGallery={onGallery} accessToken={session?.access_token} userEmail={user?.email} onRequestAuth={() => setShowAuth(true)} />
        </div>
      )}
    </div>
  );
}
