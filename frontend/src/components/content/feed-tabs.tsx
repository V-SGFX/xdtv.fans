'use client';

import { Radio } from 'lucide-react';
import { TabBar } from '@/components/ui/tab-bar';
import { formatCount } from '@/lib/content/media';

export type FeedTab = 'for-you' | 'following' | 'trending' | 'live';

interface FeedTabsProps {
  active: FeedTab;
  onChange: (tab: FeedTab) => void;
  labels: Record<FeedTab, string>;
  /** Shown beside the Live tab so the count is visible before you open it. */
  liveCount?: number;
}

const ORDER: FeedTab[] = ['for-you', 'following', 'trending', 'live'];

/**
 * Feed mode switch — a thin configuration of the shared TabBar.
 *
 * Four modes, as specced. The previous Home had a sort control and six type
 * pills stacked above a marquee, which pushed content below the fold.
 */
export function FeedTabs({ active, onChange, labels, liveCount }: FeedTabsProps) {
  return (
    <TabBar
      idPrefix="feed"
      label="Tryb feedu"
      value={active}
      onChange={onChange}
      items={ORDER.map((value) => ({
        value,
        label: labels[value],
        icon:
          value === 'live' ? (
            <Radio
              className={`h-3.5 w-3.5 ${value === active || liveCount ? 'text-live' : ''}`}
              aria-hidden="true"
            />
          ) : undefined,
        badge:
          value === 'live' && liveCount ? (
            <span className="tabular-nums text-2xs text-content-muted">
              {formatCount(liveCount)}
            </span>
          ) : undefined,
      }))}
    />
  );
}
