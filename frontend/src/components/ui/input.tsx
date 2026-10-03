'use client';

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-lg
            px-4 py-2.5 text-sm text-text-primary
            placeholder:text-text-dimmed
            focus:outline-none focus:border-neon-purple/50
            focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)]
            transition-all duration-200
            ${error ? 'border-neon-red/50 focus:border-neon-red/70' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-neon-red">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-lg
            px-4 py-2.5 text-sm text-text-primary
            placeholder:text-text-dimmed resize-none
            focus:outline-none focus:border-neon-purple/50
            focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)]
            transition-all duration-200
            ${error ? 'border-neon-red/50 focus:border-neon-red/70' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-neon-red">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
