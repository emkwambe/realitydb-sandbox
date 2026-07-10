// SimLabPricingPage.tsx — informational SimLab pricing (4 tiers).
// No Stripe/Dodo wiring. CTAs are external links / mailto only.
// Full pricing and checkout live at realitydb.dev/pricing.

import { Check, ArrowRight } from 'lucide-react';

interface Tier {
  name: string;
  price: string;
  cadence?: string;
  color: string;
  highlight?: boolean;
  features: string[];
  cta: { label: string; href: string };
}

const TIERS: Tier[] = [
  {
    name: 'Community',
    price: '$0',
    color: '#00e5a0',
    features: [
      '10K rows per run',
      '1 active lab',
      '2-hour TTL',
      'All templates',
      'CLI access',
    ],
    cta: { label: 'Install CLI', href: 'https://www.npmjs.com/package/@realitydb/cli' },
  },
  {
    name: 'Data',
    price: '$19',
    cadence: '/mo',
    color: '#22d3ee',
    features: [
      'Unlimited rows',
      '3 active labs',
      '8-hour TTL',
      'seed:supabase',
      'Priority download',
    ],
    cta: { label: 'Get Started', href: 'https://realitydb.dev/pricing' },
  },
  {
    name: 'Professional',
    price: '$49',
    cadence: '/mo',
    color: '#a78bfa',
    highlight: true,
    features: [
      'Unlimited rows',
      '5 active labs',
      '24-hour TTL',
      '6 compliance frameworks',
      'examine bias + attest sign',
      'Priority support',
    ],
    cta: { label: 'Get Started', href: 'https://realitydb.dev/pricing' },
  },
  {
    name: 'Enterprise EU',
    price: '€499',
    cadence: '/mo',
    color: '#ffb444',
    features: [
      'Unlimited',
      'On-premise',
      'DPA + DPIA included',
      'Dedicated support',
    ],
    cta: { label: 'Request Pilot', href: 'mailto:compliance@realitydb.dev?subject=Enterprise%20EU%20Pilot' },
  },
];

export function SimLabPricingPage() {
  return (
    <div className="min-h-screen bg-bg text-gray-200">
      <section className="mx-auto max-w-3xl px-6 pb-8 pt-20 text-center">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent/80">
          Pricing
        </p>
        <h1 className="text-3xl font-bold text-white md:text-4xl">
          Start free. Scale when your experiments do.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
          SimLab tiers scale from free local experimentation to on-premise EU-compliant
          deployments. Enterprise is a tier here — not a separate product.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl border bg-bg-card p-6 ${
                tier.highlight ? 'border-purple/50 ring-1 ring-purple/30' : 'border-[var(--border)]'
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-2.5 left-6 rounded-full bg-purple px-2.5 py-0.5 text-[10px] font-bold uppercase text-black">
                  Most Popular
                </span>
              )}
              <p
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: tier.color }}
              >
                {tier.name}
              </p>
              <div className="mt-2 mb-5 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">{tier.price}</span>
                {tier.cadence && (
                  <span className="text-sm text-[var(--muted)]">{tier.cadence}</span>
                )}
              </div>
              <ul className="mb-6 flex-1 space-y-2.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-gray-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: tier.color }} />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={tier.cta.href}
                target={tier.cta.href.startsWith('mailto:') ? undefined : '_blank'}
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: tier.color, color: '#000' }}
              >
                {tier.cta.label} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <div className="rounded-xl border border-[var(--border)] bg-bg-elevated px-6 py-4">
          <p className="text-sm text-[var(--muted)]">
            Full pricing and checkout at{' '}
            <a
              href="https://realitydb.dev/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent hover:underline"
            >
              realitydb.dev/pricing
            </a>
          </p>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-6 text-center">
        <p className="text-[11px] text-[var(--muted)]">
          Mpingo Systems LLC — Precision Tools built to stay.
        </p>
      </footer>
    </div>
  );
}
