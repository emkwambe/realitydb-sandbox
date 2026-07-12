import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ─────────────────────────────────────────────────────────────────────────
// Credibility badges — the "is this trustworthy" summary. Reads directly
// from the aggregate counts the backend now returns (reproduction_count,
// validation_count, etc.) — no client-side computation, no extra fetches.
// ─────────────────────────────────────────────────────────────────────────

export interface CredibilityCounts {
  reproduction_count?: number;
  reproduction_matched_count?: number;
  validation_count?: number;
  validation_confirms_count?: number;
  validation_disputes_count?: number;
  review_count?: number;
  review_open_count?: number;
}

export function CredibilityBadges({ counts, compact = false }: { counts: CredibilityCounts; compact?: boolean }) {
  const repro = counts.reproduction_count ?? 0;
  const reproMatched = counts.reproduction_matched_count ?? 0;
  const val = counts.validation_count ?? 0;
  const valConfirms = counts.validation_confirms_count ?? 0;
  const valDisputes = counts.validation_disputes_count ?? 0;
  const reviews = counts.review_count ?? 0;
  const reviewsOpen = counts.review_open_count ?? 0;

  const size = compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2.5 py-1';
  const gap = compact ? 'gap-1.5' : 'gap-2';

  const badge = (label: string, tone: 'positive' | 'warning' | 'neutral' | 'attention') => {
    const toneClass =
      tone === 'positive' ? 'bg-[#00e5a0]/10 text-[#00e5a0] border-[#00e5a0]/25'
      : tone === 'warning' ? 'bg-red-400/10 text-red-400 border-red-400/25'
      : tone === 'attention' ? 'bg-accent/10 text-accent border-accent/25'
      : 'bg-bg-elevated text-[var(--muted)] border-[var(--border)]';
    return (
      <span className={`inline-flex items-center rounded-full border font-medium ${size} ${toneClass}`}>
        {label}
      </span>
    );
  };

  return (
    <div className={`flex flex-wrap items-center ${gap}`}>
      {repro > 0
        ? badge(`✓ Reproduced ${repro}× (${reproMatched} matched)`, reproMatched === repro ? 'positive' : 'warning')
        : badge('Not yet reproduced', 'neutral')}
      {val > 0
        ? badge(
            valDisputes > 0 ? `${valConfirms} confirms · ${valDisputes} disputes` : `✓ ${valConfirms} validation${valConfirms === 1 ? '' : 's'}`,
            valDisputes > 0 ? 'warning' : 'positive'
          )
        : badge('Not yet validated', 'neutral')}
      {reviews > 0
        ? badge(`${reviews} review${reviews === 1 ? '' : 's'}${reviewsOpen > 0 ? ` · ${reviewsOpen} open` : ''}`, reviewsOpen > 0 ? 'attention' : 'positive')
        : badge('No reviews yet', 'neutral')}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SQL — minimal keyword highlighting. Tokenizes into React elements
// directly (no HTML string / dangerouslySetInnerHTML) — safe by
// construction regardless of what the SQL text contains.
// ─────────────────────────────────────────────────────────────────────────

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'ORDER', 'HAVING', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
  'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIMIT', 'OFFSET', 'DISTINCT', 'COUNT', 'SUM', 'AVG',
  'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'EXTRACT', 'CAST', 'INSERT', 'UPDATE', 'DELETE',
  'INTO', 'VALUES', 'SET', 'WITH', 'UNION', 'ALL', 'EXISTS', 'BETWEEN', 'LIKE', 'ASC', 'DESC',
]);

function tokenizeSql(sql: string): Array<{ text: string; className: string }> {
  const tokens = sql.split(/(\s+|'[^']*'|,|\(|\)|;)/);
  return tokens.map((tok) => {
    if (!tok) return { text: tok, className: '' };
    if (/^'[^']*'$/.test(tok)) return { text: tok, className: 'text-[#f59e0b]' };
    if (/^-?\d+(\.\d+)?$/.test(tok)) return { text: tok, className: 'text-[#38bdf8]' };
    if (SQL_KEYWORDS.has(tok.toUpperCase())) return { text: tok, className: 'text-accent font-semibold' };
    return { text: tok, className: 'text-[var(--muted)]' };
  });
}

export function SqlBlock({ sql }: { sql: string }) {
  const tokens = tokenizeSql(sql);
  return (
    <pre className="text-[12px] leading-relaxed font-mono bg-bg-elevated border border-[var(--border)] rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
      {tokens.map((t, i) => (
        <span key={i} className={t.className}>{t.text}</span>
      ))}
    </pre>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Collapsible result table — full data is already fetched (cached in the
// evidence block), this only limits what's rendered by default.
// ─────────────────────────────────────────────────────────────────────────

export function ResultTable({ columns, rows, rowCount, truncated }: { columns: string[]; rows: any[]; rowCount: number; truncated?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const COLLAPSE_AT = 8;
  const visible = expanded ? rows : rows.slice(0, COLLAPSE_AT);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="text-[12px] w-full border-collapse">
          <thead>
            <tr className="bg-bg-elevated">
              {columns.map((c) => (
                <th key={c} className="text-left px-3 py-2 text-[var(--muted)] font-semibold uppercase tracking-wide text-[10px] border-b border-[var(--border)]">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i} className={i % 2 === 0 ? '' : 'bg-bg-elevated/40'}>
                {columns.map((c) => (
                  <td key={c} className="px-3 py-1.5 text-white border-b border-[var(--border)]/60">{String(r[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-[10px] text-[var(--muted)]">
          {rowCount.toLocaleString()} row{rowCount === 1 ? '' : 's'}{truncated ? ' (capped at 500 for storage)' : ''}
        </p>
        {rows.length > COLLAPSE_AT && (
          <button onClick={() => setExpanded((v) => !v)} className="text-[10px] text-accent hover:underline">
            {expanded ? 'Show fewer' : `Show all ${rows.length} rows`}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Publication-styled Markdown — headings, lists, callouts (blockquote),
// code, tables, links. react-markdown never renders raw HTML by default,
// so this is safe against XSS from user-authored findings/review content.
// ─────────────────────────────────────────────────────────────────────────

export function PublicationMarkdown({ content }: { content: string }) {
  return (
    <div className="prose-report">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2 className="text-xl font-bold text-white mt-6 mb-3 first:mt-0">{children}</h2>,
          h2: ({ children }) => <h3 className="text-lg font-bold text-white mt-5 mb-2.5 first:mt-0">{children}</h3>,
          h3: ({ children }) => <h4 className="text-base font-semibold text-white mt-4 mb-2 first:mt-0">{children}</h4>,
          p: ({ children }) => <p className="text-[14px] text-gray-200 leading-[1.7] mb-3">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-outside pl-5 mb-3 space-y-1 text-[14px] text-gray-200 leading-relaxed">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside pl-5 mb-3 space-y-1 text-[14px] text-gray-200 leading-relaxed">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          blockquote: ({ children }) => (
            <div className="border-l-2 border-accent/50 bg-accent/5 rounded-r-lg pl-4 pr-3 py-2.5 my-3 text-[13px] text-gray-300 italic">
              {children}
            </div>
          ),
          code: ({ className, children, ...props }: any) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return <code className="text-[12px] font-mono text-accent" {...props}>{children}</code>;
            }
            return <code className="text-[12px] font-mono bg-bg-elevated text-accent px-1.5 py-0.5 rounded" {...props}>{children}</code>;
          },
          pre: ({ children }) => <pre className="bg-bg-elevated border border-[var(--border)] rounded-lg p-3 overflow-x-auto mb-3">{children}</pre>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{children}</a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)] mb-3">
              <table className="text-[12px] w-full border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-bg-elevated">{children}</thead>,
          th: ({ children }) => <th className="text-left px-3 py-2 text-[var(--muted)] font-semibold uppercase tracking-wide text-[10px] border-b border-[var(--border)]">{children}</th>,
          td: ({ children }) => <td className="px-3 py-1.5 text-white border-b border-[var(--border)]/60">{children}</td>,
          hr: () => <hr className="border-[var(--border)] my-5" />,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
