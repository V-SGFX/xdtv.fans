'use client';

import { formatDistanceToNowStrict } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';
import { useLocale } from 'next-intl';

/**
 * Relative timestamp.
 *
 * "3 hours ago" is computed from the current clock, so the server and the
 * browser can legitimately disagree by seconds — the classic hydration
 * mismatch. suppressHydrationWarning is correct here rather than a workaround:
 * the difference is real, expected, and harmless.
 *
 * Renders a <time> element with a machine-readable datetime and the absolute
 * value in the tooltip, so the precise moment is never lost.
 */
export function RelativeTime({ iso, className = '' }: { iso: string; className?: string }) {
  const locale = useLocale();
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return null;

  const dateLocale = locale === 'pl' ? pl : enUS;

  return (
    <time
      dateTime={iso}
      title={date.toLocaleString(locale === 'pl' ? 'pl-PL' : 'en-US')}
      suppressHydrationWarning
      className={`whitespace-nowrap ${className}`}
    >
      {formatDistanceToNowStrict(date, { addSuffix: true, locale: dateLocale })}
    </time>
  );
}
