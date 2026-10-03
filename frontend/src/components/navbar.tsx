'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { CommandPalette } from '@/components/command-palette';
import { NotificationsDropdown } from '@/components/notifications-dropdown';
import { XpDisplay } from '@/components/xp-display';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslations } from 'next-intl';
import {
  Menu, X, Zap, Settings, Bell, Search, Shield, Radio, Flame,
  Film, Compass, Users, LogOut,
} from 'lucide-react';

export function Navbar() {
  const { user, token, logout } = useAuth();
  const t = useTranslations('nav');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [streak, setStreak] = useState<number>(0);
  const pathname = usePathname();
  const [urlSearch, setUrlSearch] = useState('');
  const bellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setUrlSearch(window.location.search);
  }, [pathname]);

  const fetchUnread = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(data.count);
    } catch { /* */ }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.get('/engagement/me').then(({ data }) => {
      setStreak(data?.streak?.currentStreak ?? 0);
    }).catch(() => {});
  }, [token]);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // CMD+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Five destinations, as specced. The navbar previously exposed two of
  // twenty-five routes, which left /clips, /news, /search and the community
  // and streamer directories reachable only by typing the URL.
  //
  // The routes that stayed unreachable were later deleted rather than linked:
  // /battles, /hot-takes, /rankings and /shop had full backend modules and
  // zero rows in every one of their tables. Nobody had ever used them.
  const links = [
    { href: '/', label: t('home'), icon: Flame },
    { href: '/clips', label: t('clips'), icon: Film },
    { href: '/live', label: t('live'), icon: Radio },
    { href: '/discover', label: t('discover'), icon: Compass },
    { href: '/community', label: t('communities'), icon: Users },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      <nav className="sticky top-0 z-nav bg-black/50 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="mx-auto flex items-center justify-between px-4 h-12">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <Zap className="w-5 h-5 text-neon-cyan drop-shadow-[0_0_6px_rgba(0,245,255,0.5)] transition-all group-hover:drop-shadow-[0_0_10px_rgba(0,245,255,0.7)]" />
            <span className="font-display font-bold text-base text-white tracking-tight">XDTV</span>
          </Link>

          {/* Desktop nav — glassmorphic pills */}
          <div className="hidden md:flex items-center gap-0.5">
            {links.map((l) => {
              const Icon = l.icon;
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`
                    relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                    ${active
                      ? 'text-neon-pink bg-white/[0.08]'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                    }
                  `}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {l.label}
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -bottom-[7px] left-3 right-3 h-[2px] bg-neon-pink rounded-full shadow-[0_0_8px_rgba(255,0,170,0.5)]"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-1.5">
            {/* Search — CMD+K */}
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/[0.06]"
              title={t('search')}
            >
              <Search className="w-4 h-4" />
            </button>

            {user ? (
              <div className="flex items-center gap-1">
                <LanguageSwitcher />
                {/* Streak badge */}
                {streak > 0 && (
                  <Link
                    href="/profile"
                    title={`${streak} dni z rzędu`}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 transition-colors border border-orange-500/20"
                  >
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs font-bold text-orange-400">{streak}</span>
                  </Link>
                )}
                {/* Notifications */}
                <div className="relative">
                  <button
                    ref={bellRef}
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/[0.06]"
                    title={t('notifications')}
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center bg-neon-pink text-white text-2xs font-bold rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                  <NotificationsDropdown
                    open={showNotifications}
                    onClose={() => setShowNotifications(false)}
                    anchorRef={bellRef}
                    onUnreadChange={setUnreadCount}
                  />
                </div>

                {(user.role === 'ADMIN' || user.role === 'MODERATOR') && (
                  <Link
                    href="/admin-panel"
                    className="p-2 text-white/50 hover:text-neon-pink transition-colors rounded-lg hover:bg-white/[0.06]"
                    title={t('adminPanel')}
                  >
                    <Shield className="w-4 h-4" />
                  </Link>
                )}
                {(user.role === 'STREAMER' || user.role === 'ADMIN') && (
                  <Link
                    href="/dashboard"
                    className="p-2 text-white/50 hover:text-neon-pink transition-colors rounded-lg hover:bg-white/[0.06]"
                    title={t('streamerDashboard')}
                  >
                    <Radio className="w-4 h-4" />
                  </Link>
                )}
                <Link
                  href="/settings"
                  className="p-2 text-white/50 hover:text-neon-cyan transition-colors rounded-lg hover:bg-white/[0.06]"
                  title={t('settings')}
                >
                  <Settings className="w-4 h-4" />
                </Link>

                <Link href="/profile" className="p-1 rounded-full hover:ring-2 hover:ring-white/20 transition-all ml-1">
                  <Avatar
                    src={user.avatarUrl}
                    name={user.displayName || user.username}
                    size="xs"
                  />
                </Link>

                {/* Logout existed only in the mobile menu, so on desktop there
                    was no way to sign out at all. */}
                <button
                  onClick={logout}
                  title={t('logout')}
                  aria-label={t('logout')}
                  className="p-2 text-white/50 hover:text-neon-red transition-colors rounded-lg hover:bg-white/[0.06]"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <LanguageSwitcher />
                <Link href="/login" className="px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors">
                  {t('login')}
                </Link>
                <Link href="/register" className="px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
                  {t('register')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-white/60 hover:text-white transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-12 z-overlay bg-black/90 backdrop-blur-xl border-b border-white/[0.06] md:hidden"
          >
            <div className="p-4 space-y-1">
              {links.map((l) => {
                const Icon = l.icon;
                const active = isActive(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                      ${active
                        ? 'text-neon-pink bg-white/[0.08]'
                        : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {l.label}
                  </Link>
                );
              })}
              <hr className="border-white/[0.06] my-3" />
              {user ? (
                <div className="flex items-center justify-between px-3 py-2">
                  <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
                    <Avatar src={user.avatarUrl} name={user.displayName || user.username} size="sm" />
                    <span className="text-sm text-white/70">{user.displayName || user.username}</span>
                  </Link>
                  <div className="flex items-center gap-2">
                    {(user.role === 'ADMIN' || user.role === 'MODERATOR') && (
                      <Link href="/admin-panel" onClick={() => setMobileOpen(false)} className="text-white/50 hover:text-neon-pink text-sm">
                        <Shield className="w-4 h-4" />
                      </Link>
                    )}
                    <Link href="/settings" onClick={() => setMobileOpen(false)} className="text-white/50 hover:text-neon-cyan text-sm">
                      <Settings className="w-4 h-4" />
                    </Link>
                    <button onClick={() => { logout(); setMobileOpen(false); }} className="text-white/50 hover:text-neon-red text-sm">
                      {t('logout')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 px-3">
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="flex-1 text-center px-3 py-2 text-xs font-medium text-white/70 hover:text-white rounded-lg hover:bg-white/[0.06] transition-all">
                    {t('login')}
                  </Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="flex-1 text-center px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
                    {t('register')}
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command Palette (CMD+K) */}
      <CommandPalette open={showSearch} onClose={() => setShowSearch(false)} />
    </>
  );
}
