import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
}

export function EmptyState({ icon: Icon = Inbox, title = 'Brak wyników', description }: EmptyStateProps) {
  return (
    // `bg-surface-2` was never a real token, so this circle rendered with no
    // background at all — Tailwind emits nothing for an unknown token rather
    // than failing. Moved onto the design system.
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-xl bg-surface-hover">
        <Icon className="h-7 w-7 text-content-muted" aria-hidden="true" />
      </div>
      <p className="font-medium text-content-secondary">{title}</p>
      {description && <p className="mt-1 text-sm text-content-muted">{description}</p>}
    </div>
  );
}
