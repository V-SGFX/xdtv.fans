'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import {
  Search, Tv, FileText, Users, Newspaper, Radio,
  ArrowBigUp, MessageSquare, X, CornerDownLeft, ArrowUp, ArrowDown,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SearchResults {
  streamers: any[];
  posts: any[];
  users: any[];
  news: any[];
}

interface ResultItem {
  type: 'streamer' | 'post' | 'user' | 'news';
  id: number;
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  href: string;
  isLive?: boolean;
}

function flattenResults(results: SearchResults, formatFollowers: (count: number) => string): ResultItem[] {
  const items: ResultItem[] = [];
  results.streamers.forEach((s) =>
    items.push({
      type: 'streamer',
      id: s.id,
      title: s.name,
      subtitle: formatFollowers(s.followerCount),
      avatarUrl: s.avatarUrl,
      href: `/streamers/${s.slug}`,
      isLive: s.isLive,
    })
  );
  results.posts.forEach((p) =>
    items.push({
      type: 'post',
      id: p.id,
      title: p.title,
      subtitle: p.author?.displayName || p.author?.username,
      href: `/posts/${p.id}`,
    })
  );
  results.users.forEach((u) =>
    items.push({
      type: 'user',
      id: u.id,
      title: u.displayName || u.username,
      subtitle: `@${u.username}`,
      avatarUrl: u.avatarUrl,
      href: `/profile/${u.username}`,
    })
  );
  results.news.forEach((n) =>
    items.push({
      type: 'news',
      id: n.id,
      title: n.title,
      subtitle: n.sourceName,
      href: n.sourceUrl,
    })
  );
  return items;
}

const typeIcons = {
  streamer: Tv,
  post: FileText,
  user: Users,
  news: Newspaper,
};

const typeColors = {
  streamer: 'text-neon-purple',
  post: 'text-neon-cyan',
  user: 'text-neon-green',
  news: 'text-neon-pink',
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ streamers: [], posts: [], users: [], news: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const t = useTranslations('search');
  const typeLabels: Record<string, string> = {
    streamer: t('streamer'),
    post: t('post'),
    user: t('user'),
    news: t('newsItem'),
  };

  const items = flattenResults(results, (count) => t('followersCount', { count }));

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults({ streamers: [], posts: [], users: [], news: [] });
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) onClose();
        else onClose(); // Will be toggled from parent
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults({ streamers: [], posts: [], users: [], news: [] });
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(q.trim())}&limit=5`);
      setResults(data);
      setSelectedIndex(0);
    } catch { /* */ }
    setLoading(false);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 200);
  };

  const handleSelect = (item: ResultItem) => {
    onClose();
    if (item.type === 'news' && item.href.startsWith('http')) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(item.href);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        handleSelect(items[selectedIndex]);
      } else if (query.trim().length >= 2) {
        onClose();
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-modal bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-modal w-full max-w-lg"
          >
            <div className="bg-black/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/70 overflow-hidden">
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
                <Search className="w-5 h-5 text-white/30 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => handleChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('placeholder')}
                  className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm focus:outline-none"
                />
                {loading && (
                  <div className="w-4 h-4 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin shrink-0" />
                )}
                <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 bg-white/[0.06] text-white/30 text-2xs font-mono rounded border border-white/[0.08]">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[400px] overflow-y-auto">
                {items.length > 0 ? (
                  <div className="py-2">
                    {items.map((item, i) => {
                      const Icon = typeIcons[item.type];
                      const color = typeColors[item.type];
                      const isSelected = i === selectedIndex;

                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          data-index={i}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(i)}
                          className={`
                            w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                            ${isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'}
                          `}
                        >
                          {item.avatarUrl ? (
                            <Avatar src={item.avatarUrl} name={item.title} size="sm" />
                          ) : (
                            <div className={`w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 ${color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-white/70'}`}>
                                {item.title}
                              </span>
                              {item.isLive && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-neon-red/10 text-neon-red text-2xs font-bold rounded uppercase">
                                  <Radio className="w-2.5 h-2.5" /> Live
                                </span>
                              )}
                            </div>
                            {item.subtitle && (
                              <p className="text-xs text-white/30 truncate">{item.subtitle}</p>
                            )}
                          </div>
                          <span className={`text-2xs uppercase font-medium shrink-0 ${color}`}>
                            {typeLabels[item.type]}
                          </span>
                          {isSelected && (
                            <CornerDownLeft className="w-3.5 h-3.5 text-white/30 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : query.trim().length >= 2 && !loading ? (
                  <div className="py-8 text-center">
                    <Search className="w-8 h-8 text-white/20 mx-auto mb-2" />
                    <p className="text-sm text-white/40">{t('noResults', { query })}</p>
                  </div>
                ) : query.trim().length < 2 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-white/30">{t('minChars')}</p>
                  </div>
                ) : null}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-3 text-2xs text-white/25">
                  <span className="flex items-center gap-1">
                    <ArrowUp className="w-3 h-3" />
                    <ArrowDown className="w-3 h-3" />
                    nawigacja
                  </span>
                  <span className="flex items-center gap-1">
                    <CornerDownLeft className="w-3 h-3" />
                    wybierz
                  </span>
                </div>
                {query.trim().length >= 2 && (
                  <button
                    onClick={() => {
                      onClose();
                      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                    }}
                    className="text-2xs text-neon-cyan hover:text-neon-cyan/80 transition-colors"
                  >
                    Pokaż wszystkie wyniki →
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
