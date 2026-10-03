'use client';

import { useLocale } from 'next-intl';
import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';

const languages = [
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const switchLocale = (newLocale: string) => {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    window.location.reload();
  };

  const current = languages.find((l) => l.code === locale) || languages[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/[0.06] text-xs"
        title="Language"
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{current.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-dark-900 border border-white/[0.08] rounded-lg shadow-xl overflow-hidden z-50 min-w-[140px]">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { switchLocale(lang.code); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                lang.code === locale
                  ? 'text-neon-cyan bg-white/[0.06]'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
