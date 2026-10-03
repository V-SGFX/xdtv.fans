'use client';

import { Hash } from 'lucide-react';

interface TagPillProps {
  name: string;
  slug: string;
  color?: string | null;
  count?: number;
  active?: boolean;
  size?: 'sm' | 'md';
  onClick?: (slug: string) => void;
}

export function TagPill({ name, slug, color, count, active, size = 'sm', onClick }: TagPillProps) {
  const base = size === 'sm'
    ? 'px-2 py-0.5 text-2xs gap-1'
    : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(slug);
      }}
      className={`
        inline-flex items-center font-medium rounded-md transition-all
        ${base}
        ${active
          ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/40'
          : 'bg-dark-700 text-text-muted border border-transparent hover:bg-dark-600 hover:text-text-secondary'
        }
      `}
      style={color && !active ? { borderColor: `${color}30`, color } : undefined}
    >
      <Hash className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {name}
      {count !== undefined && count > 0 && (
        <span className="text-text-dimmed ml-0.5">{count}</span>
      )}
    </button>
  );
}

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

export function TagInput({ tags, onChange, maxTags = 5 }: TagInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const value = input.value.trim().toLowerCase().replace(/[^a-z0-9ąćęłńóśźż-]/gi, '');

    if ((e.key === 'Enter' || e.key === ',') && value) {
      e.preventDefault();
      if (tags.length >= maxTags) return;
      if (!tags.includes(value)) {
        onChange([...tags, value]);
      }
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (idx: number) => {
    onChange(tags.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-dark-800 border border-border-default rounded-lg focus-within:border-neon-purple/50 transition-colors">
      {tags.map((tag, i) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-neon-purple/15 text-neon-purple rounded-md"
        >
          <Hash className="w-2.5 h-2.5" />
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="ml-0.5 hover:text-neon-red transition-colors"
          >
            ×
          </button>
        </span>
      ))}
      {tags.length < maxTags && (
        <input
          type="text"
          placeholder={tags.length === 0 ? 'Dodaj tagi (Enter)...' : ''}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-[100px] bg-transparent text-sm text-text-primary placeholder:text-text-dimmed outline-none"
          maxLength={30}
        />
      )}
    </div>
  );
}
