'use client';

import { Navbar } from '@/components/navbar';
import { CommunityPanel } from '@/components/community-panel';
import { Modal } from '@/components/ui/modal';
import Link from 'next/link';
import { ReactNode, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Flame, Plus, Play, Image, HelpCircle, User, Radio, Compass } from 'lucide-react';
import { SidebarAdRail } from '@/components/ads/sidebar-ad-rail';

interface AppLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  rightSidebar?: ReactNode;
  fullWidth?: boolean;
  disableGlobalCreate?: boolean;
}

export function AppLayout({ children, sidebar, rightSidebar, fullWidth, disableGlobalCreate }: AppLayoutProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [showCreate, setShowCreate] = useState(false);

  // Mirrors the desktop navbar so the product has one information
  // architecture rather than one per breakpoint. Profile stays because it is
  // the only way to reach account surfaces on mobile.
  const NAV_ITEMS = [
    { href: '/', icon: Flame, label: t('home') },
    { href: '/clips', icon: Play, label: t('clips') },
    { href: '/live', icon: Radio, label: t('live') },
    { href: '/discover', icon: Compass, label: t('discover') },
    { href: '/profile', icon: User, label: t('profile') },
  ];

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  /*
   * Co można stworzyć spod plusa.
   *
   * Każda pozycja kończy się postem w społeczności — klip też, bo
   * /clips/create pozwala wybrać społeczność i publikuje przez /posts.
   * Predykcje wypadły stąd razem z funkcją: przycisk prowadził do
   * osobnego bytu, który z resztą serwisu nie miał wspólnego modelu.
   */
  const createItems = [
    {
      href: '/clips/create',
      title: t('createClip'),
      subtitle: t('createClipSub'),
      icon: Play,
      accent: 'text-neon-pink border-neon-pink/20 bg-neon-pink/5',
    },
    {
      href: '/community?postType=MEDIA',
      title: t('createMeme'),
      subtitle: t('createMemeSub'),
      icon: Image,
      accent: 'text-neon-cyan border-neon-cyan/20 bg-neon-cyan/5',
    },
    {
      href: '/community?postType=TEXT',
      title: t('createPost'),
      subtitle: t('createPostSub'),
      icon: HelpCircle,
      accent: 'text-purple-300 border-purple-400/20 bg-purple-500/5',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <Navbar />
      <div className="flex flex-1">
        {/* Left sidebar */}
        {sidebar && (
          <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-white/[0.06] bg-black/50 overflow-y-auto">
            {sidebar}
          </aside>
        )}

        {/* Main content.
            BEZ `overflow-y-auto`. Ta klasa robiła z <main> własny kontener
            przewijania, a `position: sticky` odnosi się do najbliższego
            takiego kontenera — nie do okna. Pasek zakładek z `top-12`
            przestawał więc trzymać się pod nawigacją i treść wchodziła pod
            niego. Strona i tak przewija się w całości (`min-h-screen`),
            więc ten kontener nigdy niczego nie przewijał. */}
        <main className="flex-1">
          <div className={fullWidth ? '' : 'mx-auto max-w-5xl px-4 py-6'}>
            {children}
          </div>
        </main>

        {/* Right sidebar */}
        {rightSidebar && (
          <aside className="hidden lg:flex w-64 shrink-0 flex-col border-l border-white/[0.06] bg-black/50 overflow-y-auto">
            {rightSidebar}
          </aside>
        )}

        {/* Kolumna reklamowa.
            Osobna od `rightSidebar`, bo tamta należy do strony, a ta do
            monetyzacji — i przede wszystkim dlatego, że sama decyduje,
            czy w ogóle istnieć. Wspólny warunek dawałby albo pustą kolumnę
            z obramowaniem na każdej stronie, albo blok widoczny wyłącznie
            tam, gdzie strona akurat coś do prawej kolumny przekazuje. */}
        {!rightSidebar && (
          <SidebarAdRail />
        )}
      </div>

      {/* Legal footer */}
      <footer className="hidden md:block border-t border-white/[0.06] py-4 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-4 text-xs text-white/25">
          <span>© {new Date().getFullYear()} XDTV.fans</span>
          <span>·</span>
          <Link href="/regulamin" className="hover:text-white/40 transition-colors">{t('terms')}</Link>
          <span>·</span>
          <Link href="/polityka-prywatnosci" className="hover:text-white/40 transition-colors">{t('privacy')}</Link>
        </div>
      </footer>

      {/* ── Mobile bottom navigation ── */}
      {/* Five items with Polish labels ("Odkrywaj", "Społeczności") exceed a
          320px screen at fixed padding, so each cell is an equal flex share
          with a truncating label. The row cannot overflow at any width, and
          min-h-14 keeps every target comfortably tappable. */}
      <nav
        aria-label={t('home')}
        className="md:hidden fixed bottom-0 left-0 right-0 z-nav flex items-stretch bg-black/95 backdrop-blur-xl border-t border-white/[0.08]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors ${active ? 'text-neon-pink' : 'text-white/40 hover:text-white/70'}`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="w-full truncate text-center text-2xs font-medium">{label}</span>
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-neon-pink"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Floating community chat panel */}
      <CommunityPanel />

      {/* Quick create button */}
      {!disableGlobalCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="fixed z-nav right-4 md:right-6 bottom-24 md:bottom-6 w-12 h-12 rounded-full bg-neon-pink text-white flex items-center justify-center shadow-[0_0_18px_rgba(255,0,170,0.45)] hover:scale-105 transition-transform"
          aria-label="Szybkie tworzenie"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Quick create. Was a hand-rolled fixed-inset block with no focus trap,
          no Escape and no dialog semantics — on mobile it is the primary
          action, so it is the one that most needed the primitive. */}
      {!disableGlobalCreate && (
        <Modal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          size="sm"
          title={t('createTagline')}
        >
          <ul className="grid grid-cols-1 gap-2 p-4">
            {createItems.map(({ href, title, subtitle, icon: Icon, accent }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setShowCreate(false)}
                  className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${accent}`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{title}</span>
                    <span className="block truncate text-xs opacity-70">{subtitle}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {/* Spacer matching the bottom nav (min-h-14) plus the home indicator,
          so the last row of content is never hidden behind it. */}
      <div
        aria-hidden="true"
        className="md:hidden"
        style={{ height: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
      />
    </div>
  );
}
