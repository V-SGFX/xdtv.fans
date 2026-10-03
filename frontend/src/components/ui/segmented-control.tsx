'use client';

interface Option {
  value: string;
  label: string;
}

/**
 * Small inline mode switch — sort orders, sub-views.
 *
 * Distinct from FeedTabs on purpose: FeedTabs is the primary navigation of a
 * surface and is a full ARIA tablist, while this is a secondary control that
 * reorders the same content. Using radios rather than tabs communicates that
 * difference to assistive tech, and gives arrow-key movement for free.
 */
export function SegmentedControl({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  /** Accessible name for the group. */
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-surface-raised p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            // min-h-9 rather than padding alone: at py-1 these were ~24px
            // tall, well under a comfortable finger target. Desktop keeps the
            // compact look because the height comes from a minimum, not a
            // fixed size.
            className={`
              inline-flex min-h-9 items-center rounded-sm px-3 text-xs font-medium whitespace-nowrap
              transition-colors duration-[120ms]
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
              ${
                active
                  ? 'bg-surface-hover text-content-primary'
                  : 'text-content-muted hover:text-content-secondary'
              }
            `}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
