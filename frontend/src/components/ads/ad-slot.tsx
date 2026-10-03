'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Klucze bloków — muszą się zgadzać z kolumną `key` w tabeli ad_slots. */
export type AdSlotKey =
  | 'home-top'
  | 'feed-inline'
  | 'sidebar-right'
  | 'post-detail'
  | 'discover-top';

interface AdSlotProps {
  slotKey: AdSlotKey;
  className?: string;
}

/**
 * Wszystkie aktywne bloki jednym żądaniem, wspólnie dla całej strony.
 *
 * Czas świeżości jest długi, bo kod reklamy zmienia się raz na kilka
 * miesięcy, a nie co wejście. Backend trzyma to dodatkowo w Redisie na
 * pięć minut, więc zmiana w panelu wchodzi bez restartu.
 */
export function useAdSlots() {
  return useQuery({
    queryKey: ['ads', 'slots'],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data } = await api.get('/ads');
      return data ?? {};
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
}

/**
 * Miejsce na reklamę.
 *
 * Nie renderuje NICZEGO, dopóki nie ma kodu: ani ramki, ani odstępu, ani
 * pustego kontenera. Zarezerwowane miejsce na wyłączonym bloku to dziura
 * w układzie, którą widać na każdej stronie i której nikt nie umie
 * wytłumaczyć.
 *
 * Kod wstrzykujemy ręcznie, zamiast przez `dangerouslySetInnerHTML`,
 * z jednego powodu: przeglądarka NIE wykonuje znaczników <script>
 * wstawionych przez `innerHTML`, a snippet AdSense to właśnie <script>.
 * Bez odtworzenia tych węzłów blok wyglądałby na wstawiony i nie
 * wyświetlał nic — najgorszy rodzaj awarii, bo cichy.
 */
export function AdSlot({ slotKey, className }: AdSlotProps) {
  const { data } = useAdSlots();
  const host = useRef<HTMLDivElement>(null);
  const code = data?.[slotKey];

  useEffect(() => {
    const node = host.current;
    if (!node || !code) return;

    node.innerHTML = code;

    // Odtworzenie skryptów: węzeł utworzony przez document.createElement jest
    // przez przeglądarkę wykonywany, w przeciwieństwie do tego z innerHTML.
    const scripts = Array.from(node.querySelectorAll('script'));
    for (const old of scripts) {
      const fresh = document.createElement('script');
      for (const attr of Array.from(old.attributes)) {
        fresh.setAttribute(attr.name, attr.value);
      }
      fresh.text = old.text;
      old.replaceWith(fresh);
    }

    return () => {
      node.innerHTML = '';
    };
  }, [code]);

  if (!code) return null;

  return (
    <div
      ref={host}
      className={className}
      // Reklama nie jest treścią serwisu — czytnik ekranu ma prawo ją pominąć,
      // a wyszukiwarka nie powinna brać jej za część artykułu.
      role="complementary"
      aria-label="Reklama"
      data-ad-slot={slotKey}
    />
  );
}
