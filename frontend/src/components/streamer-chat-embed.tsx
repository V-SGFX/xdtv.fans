'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ChatMessage } from '@/components/chat-message';
import { TypingIndicator } from '@/components/typing-indicator';
import { EmojiPicker } from '@/components/emoji-reactions';
import { ChatMessageSkeleton } from '@/components/ui/skeleton';
import { FirstMessageBanner, HotTakeBanner, EmptyStatePoll, SystemMessage } from '@/components/chat-onboarding';
import { Send, Hash, Lock, SmilePlus, Shield, MessageSquare, Users } from 'lucide-react';
import Link from 'next/link';

interface ReactionGroup {
  emoji: string; count: number; userIds: number[];
  users?: { id: number; username: string; displayName: string | null }[];
}
interface Message {
  id: number; channelId?: number; content: string; createdAt: string; isPinned?: boolean; isSystem?: boolean; systemType?: string;
  author: { id: number; username: string; displayName: string | null; avatarUrl: string | null; role: string };
  reactions: ReactionGroup[];
}

interface StreamerChatEmbedProps {
  channelId: number;
  channelName?: string;
  channelSlug?: string;
  streamerProfileId?: number | null;
  className?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function StreamerChatEmbed({ channelId, channelName, channelSlug, streamerProfileId, className = '' }: StreamerChatEmbedProps) {
  const t = useTranslations('chat');
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<{ userId: number; username: string }[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [hasSentMessage, setHasSentMessage] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTypingRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const canModerate = user?.role === 'ADMIN' || user?.role === 'MODERATOR' || user?.role === 'STREAMER';

  // Check if user has sent a message before
  useEffect(() => {
    if (!user?.id) return;
    if (localStorage.getItem(`xdtv_chat_sent_${user.id}`)) setHasSentMessage(true);
  }, [user?.id]);

  // Load messages
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/messages?channelId=${channelId}&limit=50`);
        setMessages(data.map((m: any) => ({ ...m, reactions: m.reactions || [] })));
      } catch { /* */ }
      setLoading(false);
    })();

    if (token) {
      api.get(`/channels/${channelId}/can-send`)
        .then(({ data }) => setCanWrite(data.allowed))
        .catch(() => setCanWrite(false));
    }
  }, [channelId, token]);

  // Socket
  useEffect(() => {
    if (!token) return;

    const s = io(API_URL, { auth: { token } });
    setSocket(s);

    s.on('connect', () => {
      s.emit('join-channel', channelId);
    });

    s.on('new-message', (msg: Message) => {
      setMessages((prev) => [...prev, { ...msg, reactions: msg.reactions || [] }]);
    });

    s.on('system_message', (data: { body: string; createdAt: string; type?: string }) => {
      const sysMsg: Message = {
        id: -Date.now(),
        content: data.body,
        createdAt: data.createdAt,
        isSystem: true,
        systemType: data.type,
        author: { id: 0, username: 'XDTV Bot', displayName: 'XDTV Bot', avatarUrl: null, role: 'SYSTEM' },
        reactions: [],
      };
      setMessages((prev) => [...prev, sysMsg]);
    });

    s.on('message-deleted', ({ messageId }: { messageId: number }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    s.on('online-users', ({ users }: { channelId: number; users: any[] }) => {
      setOnlineCount(users.length);
    });

    s.on('user-typing', ({ userId, username }: { userId: number; username: string }) => {
      if (userId === user?.id) return;
      setTypingUsers((prev) => {
        if (prev.find((t) => t.userId === userId)) return prev;
        return [...prev, { userId, username }];
      });
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((t) => t.userId !== userId));
      }, 3000);
    });

    s.on('message-reactions-updated', ({ messageId, reactions }: { messageId: number; reactions: ReactionGroup[] }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    });

    return () => {
      s.emit('leave-channel', channelId);
      s.disconnect();
    };
  }, [token, channelId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !socket || !canWrite) return;
    socket.emit('send-message', { channelId, content: input });
    setInput('');
    setShowEmoji(false);
    inputRef.current?.focus();
    if (!hasSentMessage && user?.id) {
      setHasSentMessage(true);
      localStorage.setItem(`xdtv_chat_sent_${user.id}`, '1');
    }
  };

  const quickSend = (text: string) => {
    if (!socket || !canWrite) return;
    socket.emit('send-message', { channelId, content: text });
    if (!hasSentMessage && user?.id) {
      setHasSentMessage(true);
      localStorage.setItem(`xdtv_chat_sent_${user.id}`, '1');
    }
  };

  const handleTyping = () => {
    if (!socket) return;
    const now = Date.now();
    if (now - lastTypingRef.current > 2000) {
      socket.emit('typing', channelId);
      lastTypingRef.current = now;
    }
  };

  return (
    <div className={`flex flex-col bg-dark-900/50 border border-border-default rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="shrink-0 px-4 py-2.5 border-b border-border-default flex items-center gap-2.5">
        <Hash className="w-4 h-4 text-text-dimmed" />
        <span className="text-sm font-semibold text-text-primary flex-1">
          {channelName || 'Czat'}
        </span>
        <div className="flex items-center gap-1 text-xs text-text-dimmed">
          <Users className="w-3.5 h-3.5" />
          {onlineCount}
        </div>
        <Link
          href={channelSlug ? `/community/${channelSlug}` : `/community?channel=${channelId}`}
          className="text-xs text-text-dimmed hover:text-neon-purple transition-colors"
        >
          {t('openFull')}
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2" style={{ maxHeight: '400px', minHeight: '250px' }}>
        {loading ? (
          <div className="space-y-2 px-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <ChatMessageSkeleton key={i} />
            ))}
          </div>
        ) : messages.length === 0 && !hasSentMessage && canWrite ? (
          <EmptyStatePoll onQuickSend={quickSend} />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
            <MessageSquare className="w-8 h-8 text-neon-cyan/30 mb-2" />
            <p className="text-text-dimmed text-sm">{t('noMessages')}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            <HotTakeBanner channelSlug={channelSlug} onFillInput={setInput} />
            {messages.map((m) =>
              m.isSystem ? (
                <SystemMessage key={m.id} body={m.content} type={m.systemType} />
              ) : (
                <ChatMessage
                  key={m.id}
                  {...m}
                  isOwn={user?.id === m.author.id}
                  currentUserId={user?.id}
                  canModerate={canModerate}
                  streamerProfileId={streamerProfileId}
                  onDelete={(id) => socket?.emit('delete-message', { messageId: id })}
                  onReact={(mid, emoji) => socket?.emit('react-message', { messageId: mid, emoji })}
                />
              )
            )}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Typing */}
      <TypingIndicator typingUsers={typingUsers} />

      {/* Input */}
      <div className="shrink-0 border-t border-border-default bg-dark-900/40">
        {!token ? (
          <div className="flex items-center justify-center py-3 text-sm text-text-dimmed gap-2">
            <Lock className="w-4 h-4" />
            <Link href="/login" className="text-neon-purple hover:underline">{t('loginToChat')}</Link>
            <span>{t('loginToChatSuffix')}</span>
          </div>
        ) : !canWrite ? (
          <div className="flex items-center justify-center gap-2 py-3 text-text-dimmed text-sm">
            <Shield className="w-4 h-4" />
            {t('noPermission')}
          </div>
        ) : (
          <div>
            {!hasSentMessage && messages.length > 0 && (
              <FirstMessageBanner onQuickSend={quickSend} />
            )}
            <div className="flex items-center gap-2 p-2.5">
            <div className="relative">
              <button
                onClick={() => setShowEmoji(!showEmoji)}
                className="text-text-dimmed hover:text-neon-purple p-1.5 rounded-lg hover:bg-dark-700/50 transition-all"
              >
                <SmilePlus className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {showEmoji && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute bottom-full left-0 mb-2 z-50"
                  >
                    <EmojiPicker
                      onSelect={(emoji) => { setInput((p) => p + emoji); setShowEmoji(false); }}
                      onClose={() => setShowEmoji(false)}
                      streamerProfileId={streamerProfileId}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); handleTyping(); }}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={!hasSentMessage ? t('firstMessagePlaceholder') : t('placeholder')}
              className="flex-1 bg-dark-800 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dimmed focus:outline-none focus:border-neon-purple/50 transition-all"
              maxLength={2000}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="bg-neon-purple hover:bg-neon-purple/90 disabled:opacity-30 text-white p-2 rounded-lg transition-all"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
