'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Search, X } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useStreamerSuggest } from '@/lib/queries/content';
import { formatCount } from '@/lib/content/media';

/**
 * Streamer typeahead.
 *
 * Browsing 31,269 profiles by letter works when you do not know the name;
 * this is for when you do. Suggestions start at two characters, which is where
 * the endpoint begins answering.
 *
 * Implemented as an ARIA combobox: arrows move through suggestions, Enter
 * opens the highlighted one, Escape closes. The input keeps focus throughout,
 * so the listbox is referenced by id rather than receiving focus itself.
 */
export function StreamerSearch() {
  const t = useTranslations('discover');
  const router = useRouter();

  const [value, setValue] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  // Debounce so a fast typist issues one request, not one per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), 220);
    return () => clearTimeout(id);
  }, [value]);

  const { data: results = [], isFetching } = useStreamerSuggest(debounced);

  // Close when focus or a click leaves the widget.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const go = (slug: string) => {
    setOpen(false);
    setValue('');
    router.push(`/streamers/${slug}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!results.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      go(results[active].slug);
    }
  };

  const expanded = open && debounced.length >= 2;

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
          aria-label={t('searchStreamers')}
          placeholder={t('searchStreamers')}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-h-10 w-full rounded-lg border border-line bg-surface-raised pl-9 pr-9 text-sm text-content-primary placeholder:text-content-muted focus-visible:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {isFetching && debounced.length >= 2 && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-content-muted"
            aria-hidden="true"
          />
        )}
        {!isFetching && value && (
          <button
            type="button"
            onClick={() => {
              setValue('');
              setOpen(false);
            }}
            aria-label={t('searchNoResults')}
            className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-sm text-content-muted hover:text-content-primary"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('searchStreamers')}
          className="absolute inset-x-0 top-full z-dropdown mt-1 max-h-80 overflow-y-auto rounded-lg border border-line bg-surface-raised py-1 shadow-2xl shadow-black/50"
        >
          {results.length === 0 && !isFetching && (
            <li className="px-3 py-2 text-xs text-content-muted">{t('searchNoResults')}</li>
          )}

          {results.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
            >
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(s.slug)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  i === active ? 'bg-surface-hover' : ''
                }`}
              >
                <Avatar src={s.avatarUrl} name={s.name} size="sm" status={s.isLive ? 'live' : 'none'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-content-primary">{s.name}</span>
                  <span className="block text-2xs text-content-muted">
                    {formatCount(s.followerCount)}
                  </span>
                </span>
                {s.isLive && <Badge variant="live">LIVE</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
