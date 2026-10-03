'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Four intents, not eight.
 *
 * The previous set carried `neon-cyan`, `neon-pink`, `neon-green` and `glass`
 * alongside `primary` — five ways to say "the affirmative button", none of them
 * used. An audit of every call site found only primary/secondary/ghost live in
 * the app, so the palette variants are gone and `danger` is kept for
 * destructive intent.
 *
 * Motion is CSS, not framer-motion: a spring on every button in the app is
 * exactly the "everything animates" feel XDTV is moving away from, and it
 * pulled a JS animation runtime into every surface that renders a button.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, disables interaction, and announces busy state. */
  loading?: boolean;
  /** Icon-only buttons must pass a label — there is no visible text to read. */
  'aria-label'?: string;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-black font-semibold hover:bg-accent/85 active:bg-accent/75',
  secondary:
    'bg-surface-hover text-content-primary border border-line hover:border-line-strong hover:bg-surface-hover/80',
  ghost: 'bg-transparent text-content-secondary hover:bg-surface-hover hover:text-content-primary',
  danger: 'bg-live/10 text-live border border-live/25 hover:bg-live/20',
};

/**
 * Heights are floors, not fixed sizes. `sm` was 32px, which is a fine mouse
 * target and a poor finger one, so it grows to 36px on touch-primary devices
 * while desktop keeps the compact rhythm.
 */
const sizes: Record<Size, string> = {
  sm: 'h-8 [@media(pointer:coarse)]:h-9 px-3 text-xs gap-1.5',
  md: 'h-9 [@media(pointer:coarse)]:h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...props },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`
        inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg
        transition-colors duration-[120ms] ease-out
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
        disabled:pointer-events-none disabled:opacity-45
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
