'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg' | 'full';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Rendered in the header and wired to aria-labelledby. Omit for a bare surface. */
  title?: ReactNode;
  children: ReactNode;
  size?: ModalSize;
  /** Hide the header entirely (media viewers, command palette). */
  bare?: boolean;
  /** Disable closing via backdrop click / Escape — use only for destructive confirms. */
  dismissable?: boolean;
  className?: string;
}

const sizes: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  full: 'max-w-none w-full h-full',
};

/** Store that never changes — we only care about server vs client snapshot. */
const subscribeNoop = () => () => {};

/** Elements that can hold focus inside the dialog. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The single dialog primitive for XDTV.
 *
 * Replaces eight hand-rolled `fixed inset-0` implementations, each of which had
 * its own backdrop, z-index and (mostly absent) keyboard handling. Provides
 * focus trapping, focus restore, scroll lock, Escape-to-close and the correct
 * ARIA wiring in one place.
 *
 * Responsive by construction: a bottom sheet on mobile, centred on desktop.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  bare = false,
  dismissable = true,
  className = '',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Portals need a DOM. useSyncExternalStore gives the server `false` and the
  // client `true` without setting state inside an effect, which would cause the
  // cascading re-render that react-hooks/set-state-in-effect warns about.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const requestClose = useCallback(() => {
    if (dismissable) onClose();
  }, [dismissable, onClose]);

  // Lock body scroll while open. Compensating for the scrollbar width keeps the
  // page from shifting sideways as it disappears.
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open]);

  // Remember what had focus, move focus into the dialog, restore it on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Escape to dismiss, Tab cycles within the dialog.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, requestClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-end justify-center sm:items-center"
      role="presentation"
    >
      {/* Backdrop. aria-hidden so screen readers never reach it. */}
      <div
        aria-hidden="true"
        onClick={requestClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm motion-safe:animate-[fadeIn_120ms_ease-out]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`
          relative w-full ${sizes[size]}
          max-h-[92dvh] overflow-y-auto
          border border-line bg-surface-raised
          rounded-t-xl sm:rounded-xl
          outline-none
          motion-safe:animate-[modalIn_160ms_cubic-bezier(0.2,0,0,1)]
          ${size === 'full' ? '' : 'm-0 sm:m-4'}
          ${className}
        `}
      >
        {!bare && (
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            {title ? (
              <h2 id={titleId} className="text-sm font-semibold text-content-primary">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {dismissable && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Zamknij"
                className="-mr-1 grid h-8 w-8 place-items-center rounded-sm text-content-muted transition-colors hover:bg-surface-hover hover:text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </header>
        )}

        {children}
      </div>
    </div>,
    document.body,
  );
}
