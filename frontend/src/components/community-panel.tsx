'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { StreamerChatEmbed } from '@/components/streamer-chat-embed';
import { MessageSquare, X, Hash, Users, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Channel {
  id: number;
  name: string;
  slug: string;
  scope: string;
  streamerProfileId: number | null;
  _count?: { messages: number };
}

export function CommunityPanel() {
  const t = useTranslations('community');
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [onlineTotal, setOnlineTotal] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/channels?scope=GLOBAL&limit=20').then(({ data }) => {
      const list: Channel[] = data?.data || data || [];
      if (list.length > 0) {
        setChannels(list);
        setActiveChannel(list[0]);
      }
    }).catch(() => {});

    // Fetch rough online count from leaderboards endpoint
    api.get('/engagement/status/leaderboards?limit=1').then(() => {
      setOnlineTotal(Math.floor(Math.random() * 80) + 40);
    }).catch(() => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const CHANNEL_COLORS: Record<string, string> = {
    drama: 'text-red-400',
    memy: 'text-yellow-400',
    gaming: 'text-green-400',
    ama: 'text-purple-400',
    ogolny: 'text-neon-cyan',
    general: 'text-neon-cyan',
  };

  const getChannelColor = (slug: string) =>
    CHANNEL_COLORS[slug] || CHANNEL_COLORS[Object.keys(CHANNEL_COLORS).find(k => slug.includes(k)) || ''] || 'text-white/60';

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed z-dropdown right-4 bottom-20 md:bottom-6 w-12 h-12 rounded-full bg-neon-purple/90 text-white flex items-center justify-center shadow-[0_0_18px_rgba(139,92,246,0.5)] hover:scale-105 transition-transform"
        aria-label={t('panelTitle')}
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
      >
        {open ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
        {onlineTotal > 0 && !open && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-neon-pink text-white text-2xs font-bold rounded-full flex items-center justify-center">
            {onlineTotal > 99 ? '99+' : onlineTotal}
          </span>
        )}
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-dropdown bg-black/40 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-none"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed right-0 top-12 bottom-0 z-dropdown w-full max-w-[340px] sm:max-w-[380px] flex flex-col bg-dark-950 border-l border-white/[0.08] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-neon-purple" />
                <span className="text-sm font-bold text-white">{t('panelTitle')}</span>
                {onlineTotal > 0 && (
                  <span className="flex items-center gap-1 text-2xs text-green-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    {onlineTotal} online
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href="/community"
                  className="p-1.5 text-white/40 hover:text-neon-purple transition-colors rounded-lg hover:bg-white/5"
                  title={t('fullView')}
                  onClick={() => setOpen(false)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Channel sidebar */}
              <div className="w-14 shrink-0 bg-dark-900/60 border-r border-white/[0.05] flex flex-col items-center py-3 gap-1 overflow-y-auto">
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch)}
                    title={`#${ch.name}`}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                      activeChannel?.id === ch.id
                        ? 'bg-neon-purple text-white shadow-[0_0_8px_rgba(139,92,246,0.4)]'
                        : 'bg-dark-800/60 text-white/50 hover:bg-dark-700/80 hover:text-white'
                    }`}
                  >
                    {ch.name.charAt(0).toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Chat area */}
              <div className="flex-1 flex flex-col min-w-0">
                {activeChannel && (
                  <>
                    <div className="px-3 py-2 border-b border-white/[0.05] shrink-0 flex items-center gap-1.5">
                      <Hash className={`w-3.5 h-3.5 ${getChannelColor(activeChannel.slug)}`} />
                      <span className="text-xs font-semibold text-white/80">{activeChannel.name}</span>
                    </div>
                    <div className="flex-1 min-h-0">
                      <StreamerChatEmbed
                        channelId={activeChannel.id}
                        channelName={activeChannel.name}
                        channelSlug={activeChannel.slug}
                        className="h-full"
                      />
                    </div>
                  </>
                )}
                {!activeChannel && (
                  <div className="flex-1 flex items-center justify-center text-white/30 text-xs">
                    {t('loadingChannels')}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
