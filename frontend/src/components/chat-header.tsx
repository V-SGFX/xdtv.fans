'use client';

import { Hash, Users, Pin, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface ChatHeaderProps {
  channelName: string;
  streamerName?: string;
  isLive?: boolean;
  onlineCount: number;
  pinnedCount: number;
  onTogglePinned: () => void;
  showPinned: boolean;
}

export function ChatHeader({
  channelName,
  streamerName,
  isLive,
  onlineCount,
  pinnedCount,
  onTogglePinned,
  showPinned,
}: ChatHeaderProps) {
  return (
    <div className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-dark-700/50 bg-dark-900/70 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
          <Hash className="w-3.5 h-3.5 text-neon-cyan" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-text-primary text-sm">{channelName}</span>
            {isLive && <Badge variant="live">LIVE</Badge>}
          </div>
          {streamerName && (
            <span className="text-2xs text-text-dimmed">{streamerName}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Pinned messages toggle */}
        {pinnedCount > 0 && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onTogglePinned}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-200 ${
              showPinned
                ? 'bg-neon-purple/15 text-neon-purple border border-neon-purple/25'
                : 'text-text-muted hover:text-text-primary hover:bg-dark-700/40'
            }`}
          >
            <Pin className="w-3 h-3" />
            <span className="font-medium">{pinnedCount}</span>
          </motion.button>
        )}

        {/* Online count */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-dark-800/40 text-xs text-text-muted">
          <span className="w-2 h-2 rounded-full bg-neon-green shadow-[0_0_6px_rgba(34,197,94,0.4)]" />
          <Users className="w-3 h-3" />
          <span className="font-medium">{onlineCount}</span>
        </div>
      </div>
    </div>
  );
}
