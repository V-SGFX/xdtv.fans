'use client';

import { AdSlot, useAdSlots } from './ad-slot';

/**
 * Prawa kolumna z reklamą.
 *
 * Sama decyduje, czy istnieć: sprawdza, czy blok ma kod, i bez niego nie
 * renderuje nawet znacznika. Poleganie w tym miejscu na CSS (`empty:hidden`)
 * byłoby kruche — reguła musiałaby wygrać z `lg:flex`, a kolejność klas
 * w Tailwindzie nie jest czymś, na czym chce się opierać układ strony.
 *
 * Widoczna od 1024 px. Na węższych ekranach nie ma jej wcale, bo kolumna
 * 256 px na telefonie zjadłaby połowę treści.
 */
export function SidebarAdRail() {
  const { data } = useAdSlots();
  if (!data?.['sidebar-right']) return null;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-l border-white/[0.06] bg-black/50 p-3 lg:flex">
      <AdSlot slotKey="sidebar-right" className="sticky top-20" />
    </aside>
  );
}
