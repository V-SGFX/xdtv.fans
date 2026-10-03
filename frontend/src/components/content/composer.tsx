'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  AlertTriangle, BarChart3, HelpCircle, ImagePlus, Link2, Play, Plus,
  Trash2, Type, Upload, X as XIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TagInput } from '@/components/tag';
import { RichTextEditor } from '@/components/rich-text-editor';
import type { Community } from '@/lib/types';
import { useStreamerSuggest } from '@/lib/queries/content';

export type ComposerType = 'TEXT' | 'CLIP' | 'LINK' | 'MEDIA' | 'POLL' | 'AMA';

interface ComposerProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful publish so the caller can refresh its wall. */
  onCreated?: () => void;
  defaultType?: ComposerType;
  /** Preselects the community — used when composing from inside one. */
  defaultCommunityId?: number | null;
}

const MAX_IMAGES = 10;

/**
 * The create flow.
 *
 * Extracted from community-feed-client.tsx, where it lived inline as roughly
 * 300 lines wedged between the feed and the sidebar — which is why creating a
 * post was only possible on one route, and why that file had grown past a
 * thousand lines. It is a dialog now, so any surface can open it.
 *
 * The submit payloads are preserved exactly from the original: same endpoints,
 * same field names, same type coercion (MEDIA resolves to IMAGE or TEXT
 * depending on whether an upload succeeded), same YouTube thumbnail
 * derivation. Only the presentation was rewritten.
 */
export function Composer({
  open,
  onClose,
  onCreated,
  defaultType = 'TEXT',
  defaultCommunityId = null,
}: ComposerProps) {
  const t = useTranslations('community');
  const te = useTranslations('clipsCreate');
  const { user } = useAuth();

  const [postType, setPostType] = useState<ComposerType>(defaultType);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [isNsfw, setIsNsfw] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [clipUrl, setClipUrl] = useState('');
  const [clipStreamerId, setClipStreamerId] = useState<number | null>(null);
  const [clipStreamerQuery, setClipStreamerQuery] = useState('');

  const [communities, setCommunities] = useState<Community[]>([]);
  const [communityId, setCommunityId] = useState<number | null>(defaultCommunityId);

  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollEndsAt, setPollEndsAt] = useState('');
  const [amaDuration, setAmaDuration] = useState('24');

  // Reference data is only needed once the dialog is actually open — this used
  // to load on every community page view whether or not anyone composed.
  useEffect(() => {
    if (!open) return;
    api.get('/communities').then(({ data }) => setCommunities(data)).catch(() => {});
  }, [open, postType]);

  // Object URLs leak if they outlive the dialog.
  useEffect(() => {
    if (open) return;
    imageFiles.forEach((i) => URL.revokeObjectURL(i.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addImages = (files: File[]) => {
    const next = files
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, MAX_IMAGES - imageFiles.length)
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    if (next.length) setImageFiles((prev) => [...prev, ...next]);
  };

  const removeImage = (idx: number) => {
    setImageFiles((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const reset = () => {
    imageFiles.forEach((i) => URL.revokeObjectURL(i.preview));
    setImageFiles([]);
    setTitle('');
    setContent('');
    setLinkUrl('');
    setFormTags([]);
    setClipUrl('');
    setClipStreamerId(null);
    setClipStreamerQuery('');
    setIsNsfw(false);
    setPollOptions(['', '']);
    setPollEndsAt('');
    setAmaDuration('24');
    setError('');
  };

  /** Preserved verbatim — the platform is inferred from the URL shape. */
  function detectClipSource(url: string): { clipSource: string; externalId: string | null } {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
        let id = u.searchParams.get('v');
        if (!id && u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
        if (!id) {
          const m = u.pathname.match(/\/(?:embed|shorts|v)\/([^/?]+)/);
          id = m?.[1] || null;
        }
        return { clipSource: 'YOUTUBE', externalId: id };
      }
      if (u.hostname.includes('tiktok.com')) {
        const m = u.pathname.match(/\/video\/(\d+)/);
        return { clipSource: 'TIKTOK', externalId: m?.[1] || null };
      }
      if (u.hostname.includes('twitch.tv') || u.hostname.includes('clips.twitch.tv')) {
        const m = u.pathname.match(/\/clip\/([^/?]+)/) || u.pathname.match(/\/([^/?]+)$/);
        return { clipSource: 'TWITCH', externalId: m?.[1] || null };
      }
      if (u.hostname.includes('kick.com')) return { clipSource: 'KICK', externalId: null };
    } catch {
      /* not a URL — fall through to UPLOAD */
    }
    return { clipSource: 'UPLOAD', externalId: null };
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || uploading) return;

    const plain = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const resolvedTitle = title.trim() || plain.slice(0, 120);

    if (!resolvedTitle) return setError(t('titlePlaceholder'));
    if (postType === 'CLIP' && !clipUrl.trim()) return setError(t('clipLinkPlaceholder'));
    if (postType === 'LINK' && !linkUrl.trim()) return setError('Podaj link do posta.');
    if (postType === 'POLL' && pollOptions.filter((o) => o.trim()).length < 2) {
      return setError(t('pollOptions'));
    }

    setUploading(true);
    setError('');
    try {
      let imageUrls: string[] = [];
      if (imageFiles.length === 1) {
        const fd = new FormData();
        fd.append('file', imageFiles[0].file);
        const { data } = await api.post('/uploads/posts', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        imageUrls = [data.url];
      } else if (imageFiles.length > 1) {
        const fd = new FormData();
        imageFiles.forEach((img) => fd.append('files', img.file));
        const { data } = await api.post('/uploads/posts/batch', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        imageUrls = data.urls;
      }

      if (postType === 'CLIP') {
        const { clipSource, externalId } = detectClipSource(clipUrl);
        const body: Record<string, unknown> = {
          title: resolvedTitle,
          content: content || resolvedTitle,
          type: 'CLIP',
          videoUrl: clipUrl,
          clipSource,
          externalId,
          isNsfw,
          tags: formTags.length > 0 ? formTags : undefined,
        };
        if (clipStreamerId) body.streamerProfileId = clipStreamerId;
        if (communityId) body.communityId = communityId;
        if (clipSource === 'YOUTUBE' && externalId) {
          body.thumbnailUrl = `https://img.youtube.com/vi/${externalId}/hqdefault.jpg`;
        }
        await api.post('/posts', body);
      } else {
        const body: Record<string, unknown> = {
          title: resolvedTitle,
          content: content || resolvedTitle,
          type: postType === 'MEDIA' ? (imageUrls.length > 0 ? 'IMAGE' : 'TEXT') : postType,
          isNsfw,
          tags: formTags.length > 0 ? formTags : undefined,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        };
        if (postType === 'LINK' && linkUrl.trim()) body.linkUrl = linkUrl.trim();
        if (communityId) body.communityId = communityId;
        if (postType === 'POLL') {
          body.pollOptions = pollOptions.filter((o) => o.trim()).map((o) => o.trim());
          if (pollEndsAt) body.pollEndsAt = new Date(pollEndsAt).toISOString();
        }
        if (postType === 'AMA') {
          const hours = parseInt(amaDuration, 10) || 24;
          body.amaEndsAt = new Date(Date.now() + hours * 3_600_000).toISOString();
        }
        await api.post('/posts', body);
      }

      reset();
      onCreated?.();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
        ?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : typeof msg === 'string' ? msg : t('publishFailed'));
    }
    setUploading(false);
  };

  const TYPES: { key: ComposerType; label: string; icon: React.ReactNode }[] = [
    { key: 'TEXT', label: t('tabText'), icon: <Type className="h-3.5 w-3.5" /> },
    { key: 'CLIP', label: te('title'), icon: <Play className="h-3.5 w-3.5" /> },
    { key: 'MEDIA', label: t('tabMedia'), icon: <ImagePlus className="h-3.5 w-3.5" /> },
    { key: 'LINK', label: t('tabLink'), icon: <Link2 className="h-3.5 w-3.5" /> },
    { key: 'POLL', label: t('tabPoll'), icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { key: 'AMA', label: t('tabAma'), icon: <HelpCircle className="h-3.5 w-3.5" /> },
  ];

  /*
   * Podpowiedzi streamerów pochodzą z serwera.
   *
   * Wcześniej formularz pobierał `/streamers?limit=5000` — 3,2 MB JSON-a
   * przy każdym otwarciu zakładki klipu — i filtrował listę u siebie.
   * Profili jest 31 269, więc do przeszukania trafiało 16% zbioru:
   * wpisanie nazwy kogokolwiek spoza pierwszej piątki tysięcy
   * najpopularniejszych nie dawało ani jednego wyniku, bez żadnego
   * komunikatu. Endpoint `/streamers/suggest` istniał od dawna i używa
   * go już wyszukiwarka w Odkrywaj.
   */
  const { data: suggestions = [] } = useStreamerSuggest(clipStreamerQuery);
  const filteredStreamers = clipStreamerId ? [] : suggestions.slice(0, 6);

  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('createPost')}>
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {/* Type switch */}
        <div
          role="radiogroup"
          aria-label={t('createPost')}
          className="flex flex-wrap gap-1 rounded-lg bg-surface-base p-1"
        >
          {TYPES.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="radio"
              aria-checked={postType === tab.key}
              onClick={() => setPostType(tab.key)}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                postType === tab.key
                  ? 'bg-surface-hover text-content-primary'
                  : 'text-content-muted hover:text-content-secondary'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Community */}
        <label className="block">
          <span className="mb-1 block text-2xs font-medium uppercase tracking-wider text-content-muted">
            {t('chooseCommunity')}
          </span>
          <select
            value={communityId ?? ''}
            onChange={(e) => setCommunityId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-sm text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">{t('selectCommunity')}</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                c/{c.slug}
              </option>
            ))}
          </select>
        </label>

        <Input
          placeholder={t('titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label={t('titlePlaceholder')}
          maxLength={200}
        />

        {postType === 'CLIP' && (
          <div className="space-y-2">
            <Input
              placeholder={t('clipLinkPlaceholder')}
              value={clipUrl}
              onChange={(e) => setClipUrl(e.target.value)}
              aria-label={t('clipLinkPlaceholder')}
            />
            <div className="relative">
              <Input
                placeholder={te('searchStreamer')}
                value={clipStreamerQuery}
                onChange={(e) => {
                  setClipStreamerQuery(e.target.value);
                  setClipStreamerId(null);
                }}
                aria-label={te('searchStreamer')}
              />
              {filteredStreamers.length > 0 && !clipStreamerId && (
                <ul className="absolute z-dropdown mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-line bg-surface-raised py-1">
                  {filteredStreamers.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setClipStreamerId(s.id);
                          setClipStreamerQuery(s.name);
                        }}
                        className="w-full px-3 py-1.5 text-left text-xs text-content-secondary hover:bg-surface-hover hover:text-content-primary"
                      >
                        {s.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {postType === 'LINK' && (
          <Input
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            aria-label="URL"
          />
        )}

        {postType === 'MEDIA' && (
          <div
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              addImages(Array.from(e.dataTransfer.files));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`rounded-lg border border-dashed p-4 text-center transition-colors ${
              isDragging ? 'border-accent bg-accent/5' : 'border-line'
            }`}
          >
            <input
              ref={imgInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={(e) => {
                addImages(Array.from(e.target.files || []));
                if (imgInputRef.current) imgInputRef.current.value = '';
              }}
              className="hidden"
              id="composer-images"
            />
            <label
              htmlFor="composer-images"
              className="inline-flex cursor-pointer items-center gap-2 text-sm text-content-secondary hover:text-content-primary"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {t('imageDesc')}
            </label>

            {imageFiles.length > 0 && (
              <ul className="mt-3 grid grid-cols-4 gap-2">
                {imageFiles.map((img, i) => (
                  <li key={img.preview} className="relative">
                    <Image
                      src={img.preview}
                      alt=""
                      width={120}
                      height={68}
                      unoptimized
                      className="aspect-video w-full rounded-sm object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      aria-label="Usuń zdjęcie"
                      className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-live text-white"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {postType === 'POLL' && (
          <div className="space-y-2">
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={(e) => {
                    const copy = [...pollOptions];
                    copy[i] = e.target.value;
                    setPollOptions(copy);
                  }}
                  placeholder={t('pollOptionPlaceholder', { number: i + 1 })}
                  maxLength={100}
                  className="flex-1 rounded-lg border border-line bg-surface-base px-3 py-1.5 text-xs text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions(pollOptions.filter((_, x) => x !== i))}
                    aria-label="Usuń opcję"
                    className="text-content-muted hover:text-live"
                  >
                    <XIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < 6 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPollOptions([...pollOptions, ''])}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {t('pollOptions')}
              </Button>
            )}
            <input
              type="datetime-local"
              value={pollEndsAt}
              onChange={(e) => setPollEndsAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              aria-label={t('pollOptions')}
              className="w-full rounded-lg border border-line bg-surface-base px-3 py-1.5 text-xs text-content-primary sm:w-auto"
            />
          </div>
        )}

        {postType === 'AMA' && (
          <div
            role="radiogroup"
            aria-label={t('tabAma')}
            className="flex flex-wrap items-center gap-1.5"
          >
            {['12', '24', '48', '72'].map((h) => (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={amaDuration === h}
                onClick={() => setAmaDuration(h)}
                className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                  amaDuration === h
                    ? 'bg-surface-hover text-content-primary'
                    : 'text-content-muted hover:text-content-secondary'
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        )}

        <RichTextEditor content={content} onChange={setContent} placeholder={t('whatToWrite')} />

        <TagInput tags={formTags} onChange={setFormTags} />

        {error && (
          <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-xs text-live">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsNsfw(!isNsfw)}
            aria-pressed={isNsfw}
            className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors ${
              isNsfw ? 'bg-live/15 text-live' : 'text-content-muted hover:text-live'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            18+
          </button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={uploading}>
              {t('publish')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
