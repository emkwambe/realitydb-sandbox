import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { ConnectionSnippets } from './ConnectionSnippets';

const LAB_API_URL = import.meta.env.VITE_LAB_API_URL || 'https://realitydb-lab-api.eddy-078.workers.dev';

interface SizeInfo {
  priceCents: number;
  available: boolean;
}

interface TemplateSizes {
  template: string;
  sizes: string[];
  allSizes: string[];
  formats: string[];
  pricing: Record<string, SizeInfo>;
}

const TEMPLATE_META: Record<string, { name: string; icon: string; tables: number; description: string; quality: number }> = {
  banking: { name: 'Retail Banking', icon: '\u{1F3E6}', tables: 16, description: 'Accounts, transactions, loans, compliance, KYC data with temporal lifecycle rules', quality: 98 },
  oncology: { name: 'Oncology Research', icon: '\u{1F3E5}', tables: 20, description: 'Patients, diagnoses, treatments, outcomes, clinical trials with medical coding', quality: 100 },
  healthcare: { name: 'Healthcare Analytics', icon: '⚕️', tables: 18, description: 'Hospital operations, insurance claims, provider networks, patient journeys', quality: 99 },
  'supply-chain': { name: 'Supply Chain', icon: '\u{1F69A}', tables: 24, description: 'Suppliers, inventory, shipments, warehouses, demand forecasting data', quality: 97 },
  aml: { name: 'AML Compliance', icon: '\u{1F50D}', tables: 14, description: 'Anti-money laundering: suspicious transactions, SAR filings, risk scoring, entity resolution', quality: 99 },
  fintech: { name: 'FinTech Platform', icon: '\u{1F4B3}', tables: 9, description: 'Customers, merchants, accounts, transactions, fraud alerts, KYC', quality: 99 },
  telecom: { name: 'Telecom & Network', icon: '\u{1F4E1}', tables: 21, description: 'Subscribers, cell towers, usage records, billing, churn predictions', quality: 99 },
  universal: { name: 'Universal Starter', icon: '\u{1F310}', tables: 6, description: 'Users, transactions, audit logs, API requests, errors, addresses', quality: 98 },
  'eu-banking': { name: 'EU Banking', icon: '\u{1F3E6}', tables: 11, description: 'SEPA, PSD2, MiFID II, KYC/EDD, AML/SAR filings. DORA compliant.', quality: 99 },
  'eu-healthcare': { name: 'EU Healthcare', icon: '⚕️', tables: 14, description: 'ICD-10 diagnoses, WHO ATC medications, EHDS encounters, GDPR Article 9', quality: 99 },
  'eu-telecom': { name: 'EU Telecom', icon: '\u{1F4F6}', tables: 12, description: 'BEREC QoS, EECC portability, GDPR consent, churn events', quality: 100 },
};

const FORMAT_OPTIONS = [
  { id: 'sql', label: 'SQL', available: true },
  { id: 'csv', label: 'CSV', available: false },
  { id: 'json', label: 'JSON', available: false },
];

interface Props {
  onClose: () => void;
  onNavigate?: (route: string, params?: Record<string, unknown>) => void;
}

export function DataStorePage({ onClose, onNavigate }: Props) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<string[]>([]);
  const [templateSizes, setTemplateSizes] = useState<Record<string, TemplateSizes>>({});
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState('sql');

  useEffect(() => {
    loadStore();
  }, []);

  async function loadStore() {
    try {
      const res = await fetch(`${LAB_API_URL}/v1/store`);
      const data = await res.json() as { datasets: Array<{ template: string }> };
      const templateIds = data.datasets.map((d) => d.template);
      setTemplates(templateIds);

      const sizesMap: Record<string, TemplateSizes> = {};
      await Promise.all(
        templateIds.map(async (t) => {
          try {
            const sRes = await fetch(`${LAB_API_URL}/v1/store/${t}/sizes`);
            if (sRes.ok) sizesMap[t] = await sRes.json();
          } catch {}
        })
      );
      setTemplateSizes(sizesMap);
    } catch {} finally {
      setLoading(false);
    }
  }

  function handleDownload(template: string, size: string, priceCents: number) {
    if (priceCents === 0) {
      window.open(`${LAB_API_URL}/v1/store/${template}/download?size=${size}&format=sql`, '_blank');
      return;
    }
    if (!user) {
      setShowAuth(true);
      return;
    }
    alert('Stripe checkout coming soon. Contact academic@mpingo.ai for bulk purchases.');
  }

  function formatPrice(cents: number): string {
    if (cents === 0) return 'Free';
    if (cents >= 10000) return `$${(cents / 100).toFixed(0)}`;
    return `$${(cents / 100).toFixed(0)}`;
  }

  function qualityColor(score: number): string {
    if (score >= 99) return '#00e5a0';
    if (score >= 95) return '#22d3ee';
    return '#fbbf24';
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      <div className="h-12 border-b border-[var(--border)] bg-bg-elevated flex items-center px-4 gap-3 shrink-0">
        <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-white">&larr; Back</button>
        <span className="text-[#a78bfa] font-bold">Data Store</span>
        <span className="text-[var(--muted)] text-sm">Production-realistic datasets</span>
        <span className="ml-auto">
          <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-white">Close</button>
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">

          {/* Academic pricing banner */}
          {showBanner && (
            <div className="mb-6 border border-[#fbbf24]/30 bg-[#fbbf24]/5 rounded-lg p-3 flex items-center justify-between">
              <p className="text-xs text-[var(--muted)]">
                <span className="mr-1">{'\u{1F393}'}</span>
                <span className="text-white font-medium">Academic &amp; Research Licenses available</span>
                {' — '}Faculty $499/semester, Department $1,999/year {' — '}
                <a href="mailto:academic@mpingo.ai" className="text-[#fbbf24] hover:underline">Contact academic@mpingo.ai</a>
              </p>
              <button onClick={() => setShowBanner(false)} className="text-[var(--muted)] hover:text-white ml-3 shrink-0">&times;</button>
            </div>
          )}

          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-white mb-2">Synthetic Datasets for Every Use Case</h1>
            <p className="text-sm text-[var(--muted)] max-w-lg mx-auto">
              Production-realistic data with proper relationships, temporal rules, and domain-specific patterns.
              Download free 5K datasets instantly or purchase larger sizes.
            </p>
          </div>

          {/* Format selector */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {FORMAT_OPTIONS.map((f) => (
              <button
                key={f.id}
                onClick={() => f.available && setSelectedFormat(f.id)}
                disabled={!f.available}
                className={`px-3 py-1 text-[10px] rounded-lg border transition-colors ${
                  selectedFormat === f.id
                    ? 'border-accent bg-accent/10 text-accent font-semibold'
                    : f.available
                      ? 'border-[var(--border)] text-[var(--muted)] hover:text-white'
                      : 'border-[var(--border)] text-[var(--muted)]/40 cursor-not-allowed'
                }`}
              >
                {f.label}{!f.available && ' (soon)'}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
            </div>
          )}

          {!loading && (
            <div className="space-y-4">
              {templates.map((template) => {
                const meta = TEMPLATE_META[template] || {
                  name: template, icon: '\u{1F4CA}', tables: 0,
                  description: 'Synthetic dataset', quality: 90,
                };
                const sizes = templateSizes[template];
                const isExpanded = expandedTemplate === template;

                return (
                  <div key={template} className="border border-[var(--border)] bg-bg-card rounded-xl overflow-hidden">
                    {/* Header row */}
                    <div
                      className="p-4 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => setExpandedTemplate(isExpanded ? null : template)}
                    >
                      <span className="text-2xl">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white">{meta.name}</h3>
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ backgroundColor: qualityColor(meta.quality) + '15', color: qualityColor(meta.quality) }}
                          >
                            Q{meta.quality}
                          </span>
                          <span className="text-[10px] text-[var(--muted)]">&middot; {meta.tables} tables</span>
                        </div>
                        <p className="text-[10px] text-[var(--muted)] mt-0.5 truncate">{meta.description}</p>
                      </div>

                      {/* Quick free download */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(template, '5k', 0); }}
                        className="px-3 py-1.5 text-[10px] font-semibold text-[#00e5a0] border border-[#00e5a0]/30 rounded-lg hover:bg-[#00e5a0]/10 transition-colors shrink-0 flex items-center gap-1"
                      >
                        <span>{'⬇'}</span> Free 5K
                      </button>

                      {/* Load into SimLab — the Data Store → SimLab trio connection */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onNavigate?.('simlab', { template, rows: 5000, source: 'data-store' }); }}
                        className="px-3 py-1.5 text-[10px] font-semibold rounded-lg transition-opacity hover:opacity-90 shrink-0 whitespace-nowrap"
                        style={{ backgroundColor: '#f59e0b', color: '#0a0a12' }}
                      >
                        ⚡ Load in SimLab →
                      </button>

                      <span className="text-[var(--muted)] text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </div>

                    {/* Expanded: all sizes + connection snippets */}
                    {isExpanded && sizes && (
                      <div className="border-t border-[var(--border)]">
                        <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-[var(--border)]">
                          {sizes.allSizes.map((size) => {
                            const info = sizes.pricing[size];
                            if (!info) return null;
                            const isAvailable = info.available;
                            const isFree = info.priceCents === 0;

                            return (
                              <div key={size} className="p-3 text-center">
                                <p className="text-[10px] text-[var(--muted)] mb-0.5">{size.toUpperCase()}</p>
                                <p className={`text-sm font-bold mb-1.5 ${isFree ? 'text-[#00e5a0]' : 'text-white'}`}>
                                  {formatPrice(info.priceCents)}
                                </p>
                                {isAvailable ? (
                                  <button
                                    onClick={() => handleDownload(template, size, info.priceCents)}
                                    className={`px-2 py-1 text-[9px] font-semibold rounded transition-colors ${
                                      isFree
                                        ? 'text-[#00e5a0] border border-[#00e5a0]/30 hover:bg-[#00e5a0]/10'
                                        : 'text-accent border border-accent/30 hover:bg-accent/10'
                                    }`}
                                  >
                                    {isFree ? '⬇ Download' : 'Buy'}
                                  </button>
                                ) : (
                                  <span className="text-[9px] text-[var(--muted)]">Not generated</span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Connection snippets for this template */}
                        <div className="p-4 border-t border-[var(--border)]">
                          <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-2 font-semibold">How to use this dataset</p>
                          <ConnectionSnippets fileName={`realitydb-${template}-5k.sql`} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Subscription callout */}
          <div className="mt-8 border border-accent/20 bg-accent/5 rounded-xl p-6 text-center">
            <h3 className="text-sm font-semibold text-white mb-2">Want unlimited access?</h3>
            <p className="text-xs text-[var(--muted)] mb-4 max-w-md mx-auto">
              Subscribe to Core ($49/mo) for 50K-row downloads, or Compliance ($199/mo) for 100K rows.
              Research licenses available at $299/year.
            </p>
            <div className="flex items-center justify-center gap-4 text-[10px] text-[var(--muted)]">
              <span>Core: 2 downloads/mo</span>
              <span>|</span>
              <span>Compliance: 5 downloads/mo</span>
              <span>|</span>
              <span>Research: 10 downloads/mo</span>
            </div>
          </div>
        </div>
      </div>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
