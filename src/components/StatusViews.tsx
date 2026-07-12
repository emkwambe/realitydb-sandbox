// Shared loading/empty/not-found treatments — previously the same
// spinner markup was duplicated verbatim across 8 files, and "nothing
// here yet" / "not found" rendered visually identically everywhere
// (plain centered white heading, no way to tell an empty state from a
// failure at a glance).

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="text-center py-16">
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      {body && <p className="text-sm text-[var(--muted)] max-w-md mx-auto">{body}</p>}
    </div>
  );
}

export function NotFoundState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-10 h-10 rounded-full bg-red-400/10 border border-red-400/20 flex items-center justify-center mx-auto mb-3">
        <span className="text-red-400 text-lg">?</span>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      {body && <p className="text-sm text-[var(--muted)] max-w-md mx-auto">{body}</p>}
    </div>
  );
}
