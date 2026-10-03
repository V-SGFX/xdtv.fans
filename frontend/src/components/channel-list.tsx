'use client';

import { motion } from 'framer-motion';
import { Hash, Lock, Crown, Users, Tv, Radio } from 'lucide-react';

interface Channel {
  id: number;
  name: string;
  slug: string;
  type: string;
  _count?: { messages: number };
}

interface Streamer {
  id: number;
  slug: string;
  name: string;
  channels: Channel[];
  isLive?: boolean;
  isClaimed?: boolean;
  chatEnabled?: boolean;
}

interface ChannelListProps {
  streamers: Streamer[];
  globalChannels?: Channel[];
  activeChannel: number | null;
  onSelectChannel: (id: number) => void;
  onlineCountByChannel?: Record<number, number>;
  unreadChannels?: Set<number>;
  lastMessages?: Record<number, { content: string; author: string }>;
}

export function ChannelList({
  streamers,
  globalChannels = [],
  activeChannel,
  onSelectChannel,
  onlineCountByChannel = {},
  unreadChannels = new Set(),
  lastMessages = {},
}: ChannelListProps) {
  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'PRIVATE': return <Lock className="w-3.5 h-3.5" />;
      case 'PREMIUM': return <Crown className="w-3.5 h-3.5 text-neon-yellow" />;
      default: return <Hash className="w-3.5 h-3.5" />;
    }
  };

  const streamerChannels = streamers.filter((s) => s.isClaimed && s.chatEnabled);
  const communityChannels = streamers.filter((s) => !(s.isClaimed && s.chatEnabled));

  const renderStreamerGroup = (s: Streamer) => {
    const totalOnline = s.channels.reduce(
      (sum, ch) => sum + (onlineCountByChannel[ch.id] || 0),
      0
    );

    return (
      <div key={s.id}>
        <div className="px-2 mb-1.5 flex items-center justify-between">
          <h3 className="text-2xs font-bold uppercase tracking-widest text-text-dimmed flex items-center gap-1.5">
            {s.name}
            {s.isLive && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-neon-red/20 text-neon-red text-2xs font-bold rounded border border-neon-red/30 live-badge">
                LIVE
              </span>
            )}
          </h3>
          {totalOnline > 0 && (
            <span className="flex items-center gap-1 text-2xs text-text-dimmed">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green" />
              {totalOnline}
            </span>
          )}
        </div>
        <div className="space-y-0.5">
          {s.channels.map((ch) => {
            const isActive = activeChannel === ch.id;
            const hasUnread = unreadChannels.has(ch.id);
            const onlineCount = onlineCountByChannel[ch.id] || 0;
            const lastMsg = lastMessages[ch.id];

            return (
              <motion.button
                key={ch.id}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectChannel(ch.id)}
                className={`
                  w-full flex items-start gap-2 px-2 py-2 rounded-lg text-sm transition-all duration-150 text-left
                  ${isActive
                    ? 'bg-neon-purple/10 text-neon-cyan font-medium shadow-[inset_3px_0_0_0_theme(colors.neon-purple)]'
                    : hasUnread
                      ? 'text-text-primary hover:bg-dark-700/50 font-medium'
                      : 'text-text-muted hover:text-text-secondary hover:bg-dark-700/50'
                  }
                `}
              >
                <span className={`mt-0.5 shrink-0 ${isActive ? 'text-neon-cyan' : hasUnread ? 'text-text-primary' : 'text-text-dimmed'}`}>
                  {getChannelIcon(ch.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{ch.name}</span>
                    {hasUnread && !isActive && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-neon-purple animate-pulse" />
                    )}
                  </div>
                  {lastMsg && !isActive && (
                    <p className="text-2xs text-text-dimmed truncate mt-0.5">
                      <span className="text-text-muted">{lastMsg.author}:</span> {lastMsg.content}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 mt-0.5">
                  {onlineCount > 0 && (
                    <span className="flex items-center gap-1 text-2xs text-text-dimmed">
                      <Users className="w-2.5 h-2.5" />
                      {onlineCount}
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Global Channels Section */}
      {globalChannels.length > 0 && (
        <div>
          <div className="px-2 mb-2 flex items-center gap-1.5">
            <Hash className="w-3 h-3 text-neon-cyan" />
            <span className="text-2xs font-bold uppercase tracking-widest text-neon-cyan">
              Globalne
            </span>
          </div>
          <div className="space-y-0.5">
            {globalChannels.map((ch) => {
              const isActive = activeChannel === ch.id;
              const hasUnread = unreadChannels.has(ch.id);
              const onlineCount = onlineCountByChannel[ch.id] || 0;
              const lastMsg = lastMessages[ch.id];

              return (
                <motion.button
                  key={ch.id}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectChannel(ch.id)}
                  className={`
                    w-full flex items-start gap-2 px-2 py-2 rounded-lg text-sm transition-all duration-150 text-left
                    ${isActive
                      ? 'bg-neon-purple/10 text-neon-cyan font-medium shadow-[inset_3px_0_0_0_theme(colors.neon-purple)]'
                      : hasUnread
                        ? 'text-text-primary hover:bg-dark-700/50 font-medium'
                        : 'text-text-muted hover:text-text-secondary hover:bg-dark-700/50'
                    }
                  `}
                >
                  <span className={`mt-0.5 shrink-0 ${isActive ? 'text-neon-cyan' : hasUnread ? 'text-text-primary' : 'text-text-dimmed'}`}>
                    {getChannelIcon(ch.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{ch.name}</span>
                      {hasUnread && !isActive && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-neon-purple animate-pulse" />
                      )}
                    </div>
                    {lastMsg && !isActive && (
                      <p className="text-2xs text-text-dimmed truncate mt-0.5">
                        <span className="text-text-muted">{lastMsg.author}:</span> {lastMsg.content}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 mt-0.5">
                    {onlineCount > 0 && (
                      <span className="flex items-center gap-1 text-2xs text-text-dimmed">
                        <Users className="w-2.5 h-2.5" />
                        {onlineCount}
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Streamer Channels Section */}
      {streamerChannels.length > 0 && (
        <div>
          <div className="px-2 mb-2 flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-neon-pink" />
            <span className="text-2xs font-bold uppercase tracking-widest text-neon-pink">
              Kanały Streamerów
            </span>
          </div>
          <div className="space-y-3 pl-0.5 border-l-2 border-neon-pink/20 ml-2">
            {streamerChannels.map(renderStreamerGroup)}
          </div>
        </div>
      )}

      {/* Community Channels Section */}
      {communityChannels.length > 0 && (
        <div>
          {streamerChannels.length > 0 && (
            <div className="px-2 mb-2 flex items-center gap-1.5">
              <Tv className="w-3 h-3 text-text-dimmed" />
              <span className="text-2xs font-bold uppercase tracking-widest text-text-dimmed">
                Społeczność
              </span>
            </div>
          )}
          <div className="space-y-3">
            {communityChannels.map(renderStreamerGroup)}
          </div>
        </div>
      )}
    </div>
  );
}
