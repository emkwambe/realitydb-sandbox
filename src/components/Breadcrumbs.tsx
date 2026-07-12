// Orientation, not history — a fixed Discover / Experiments / <Title>
// strip rather than a referrer-tracking system. No breadcrumb component
// existed anywhere in the app before this.

interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center flex-wrap gap-1.5 text-xs text-[var(--muted)] mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[var(--border)]">/</span>}
          {item.href ? (
            <a href={item.href} className="hover:text-white transition-colors">{item.label}</a>
          ) : (
            <span className="text-white truncate max-w-[220px]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
