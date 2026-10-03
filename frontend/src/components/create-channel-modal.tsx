'use client';

import { useState } from 'react';
import axios from 'axios';
import { api } from '@/lib/api';
import type { Channel } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Hash, Lock, Crown, Plus } from 'lucide-react';

interface CreateChannelModalProps {
  open: boolean;
  onClose: () => void;
  streamerProfileId?: number;
  scope?: 'GLOBAL' | 'STREAMER';
  onCreated: (channel: Channel) => void;
}

const channelTypes = [
  {
    value: 'PUBLIC',
    label: 'Publiczny',
    description: 'Widoczny i dostępny dla wszystkich',
    icon: Hash,
    color: 'text-neon-cyan',
    bgColor: 'bg-neon-cyan/10 border-neon-cyan/30',
  },
  {
    value: 'PRIVATE',
    label: 'Tylko subskrybenci',
    description: 'Dostępny wyłącznie dla subskrybentów',
    icon: Lock,
    color: 'text-neon-purple',
    bgColor: 'bg-neon-purple/10 border-neon-purple/30',
  },
  {
    value: 'PREMIUM',
    label: 'VIP',
    description: 'Kanał premium dla VIP-ów',
    icon: Crown,
    color: 'text-neon-yellow',
    bgColor: 'bg-yellow-500/10 border-yellow-500/30',
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ąà]/g, 'a')
    .replace(/[ćč]/g, 'c')
    .replace(/[ęè]/g, 'e')
    .replace(/[łl]/g, 'l')
    .replace(/[ńñ]/g, 'n')
    .replace(/[óò]/g, 'o')
    .replace(/[śš]/g, 's')
    .replace(/[żźž]/g, 'z')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export function CreateChannelModal({ open, onClose, streamerProfileId, scope = 'STREAMER', onCreated }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('PUBLIC');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugManuallyEdited) {
      setSlug(slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(slugify(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setError('Nazwa i slug są wymagane');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/channels', {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        type,
        scope,
        ...(scope === 'STREAMER' && streamerProfileId ? { streamerProfileId } : {}),
      });
      onCreated(data);
      handleReset();
      onClose();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string | string[] } | undefined)?.message
        : undefined;
      if (typeof msg === 'string') {
        setError(msg);
      } else if (Array.isArray(msg)) {
        setError(msg.join(', '));
      } else {
        setError('Nie udało się utworzyć kanału');
      }
    }
    setLoading(false);
  };

  const handleReset = () => {
    setName('');
    setSlug('');
    setDescription('');
    setType('PUBLIC');
    setError('');
    setSlugManuallyEdited(false);
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-sm bg-accent/10">
            <Plus className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          </span>
          Utwórz kanał
        </span>
      }
    >
      {/* Body */}
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {/* Channel type */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Typ kanału
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {channelTypes.map((ct) => {
                      const Icon = ct.icon;
                      const isActive = type === ct.value;
                      return (
                        <button
                          key={ct.value}
                          type="button"
                          onClick={() => setType(ct.value)}
                          className={`
                            flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center
                            ${isActive
                              ? ct.bgColor
                              : 'border-border-default hover:border-border-hover bg-dark-800'
                            }
                          `}
                        >
                          <Icon className={`w-5 h-5 ${isActive ? ct.color : 'text-text-dimmed'}`} />
                          <span className={`text-xs font-medium ${isActive ? ct.color : 'text-text-muted'}`}>
                            {ct.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Nazwa kanału
                  </label>
                  <input
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="np. ogólny, gry, pytania"
                    maxLength={50}
                    className="w-full bg-dark-800 border border-border-default rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-dimmed focus:outline-none focus:border-neon-purple/50 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)] transition-all"
                  />
                </div>

                {/* Slug */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Slug (URL)
                  </label>
                  <div className="flex items-center gap-2 bg-dark-800 border border-border-default rounded-xl px-3.5 py-2.5">
                    <Hash className="w-4 h-4 text-text-dimmed shrink-0" />
                    <input
                      value={slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="ogolny"
                      maxLength={50}
                      className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-dimmed focus:outline-none"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Opis <span className="text-text-dimmed font-normal normal-case">(opcjonalnie)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="O czym jest ten kanał?"
                    maxLength={200}
                    rows={2}
                    className="w-full bg-dark-800 border border-border-default rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-dimmed focus:outline-none focus:border-neon-purple/50 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)] transition-all resize-none"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-xs text-live">
                    {error}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                    Anuluj
                  </Button>
                  <Button type="submit" variant="primary" size="sm" loading={loading} disabled={loading || !name.trim()}>
                    {!loading && <Plus className="h-4 w-4" aria-hidden="true" />}
                    Utwórz kanał
                  </Button>
                </div>
      </form>
    </Modal>
  );
}
