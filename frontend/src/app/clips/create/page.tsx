'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/navbar';
import { Film, Upload, Link2, Loader2, ArrowLeft, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

function detectSource(url: string): { clipSource: string; externalId: string | null } {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      let id = u.searchParams.get('v');
      if (!id && u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
      if (!id) {
        const match = u.pathname.match(/\/(?:embed|shorts|v)\/([^/?]+)/);
        id = match?.[1] || null;
      }
      return { clipSource: 'YOUTUBE', externalId: id };
    }
    // TikTok
    if (u.hostname.includes('tiktok.com')) {
      const match = u.pathname.match(/\/video\/(\d+)/);
      return { clipSource: 'TIKTOK', externalId: match?.[1] || null };
    }
    // Twitch clips
    if (u.hostname.includes('twitch.tv') || u.hostname.includes('clips.twitch.tv')) {
      const match = u.pathname.match(/\/clip\/([^/?]+)/) || u.pathname.match(/\/([^/?]+)$/);
      return { clipSource: 'TWITCH', externalId: match?.[1] || null };
    }
    // Kick clips
    if (u.hostname.includes('kick.com')) {
      return { clipSource: 'KICK', externalId: null };
    }
  } catch { /* ignore */ }
  return { clipSource: 'UPLOAD', externalId: null };
}

interface StreamerOption {
  id: number;
  name: string;
  slug: string;
}

export default function CreateClipPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const t = useTranslations('clipsCreate');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [streamerProfileId, setStreamerProfileId] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [streamers, setStreamers] = useState<StreamerOption[]>([]);
  const [streamerQuery, setStreamerQuery] = useState('');
  const [streamerOpen, setStreamerOpen] = useState(false);
  const [selectedStreamer, setSelectedStreamer] = useState<StreamerOption | null>(null);
  const streamerRef = useRef<HTMLDivElement>(null);
  const [communities, setCommunities] = useState<{ id: number; name: string; slug: string; color: string | null }[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<number | null>(null);
  const [detectedSource, setDetectedSource] = useState<string>('UPLOAD');
  const [detectedId, setDetectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Upload mode state
  const [inputMode, setInputMode] = useState<'link' | 'upload'>('link');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/streamers?limit=5000&sort=popular')
      .then(({ data }) => setStreamers(data.data || []))
      .catch(() => {});
    api.get('/communities')
      .then(({ data }) => setCommunities(data))
      .catch(() => {});
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (streamerRef.current && !streamerRef.current.contains(e.target as Node)) {
        setStreamerOpen(false);
      }

    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredStreamers = streamers.filter((s) =>
    s.name.toLowerCase().includes(streamerQuery.toLowerCase()) ||
    s.slug.toLowerCase().includes(streamerQuery.toLowerCase())
  );

  useEffect(() => {
    if (videoUrl) {
      const { clipSource, externalId } = detectSource(videoUrl);
      setDetectedSource(clipSource);
      setDetectedId(externalId);
      // Auto-set thumbnail for YouTube
      if (clipSource === 'YOUTUBE' && externalId && !thumbnailUrl) {
        setThumbnailUrl(`https://img.youtube.com/vi/${externalId}/hqdefault.jpg`);
      }
    }
  }, [videoUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { setError(t('mustBeLoggedIn')); return; }
    if (!title.trim()) { setError(t('titleRequired')); return; }
    if (inputMode === 'link' && !videoUrl.trim()) { setError(t('urlRequired')); return; }
    if (inputMode === 'upload' && !videoFile) { setError(t('selectFile')); return; }

    setSubmitting(true);
    setError('');
    try {
      let finalVideoUrl = videoUrl.trim();
      let finalSource = detectedSource;
      let finalExternalId = detectedId;
      let finalThumbnail = thumbnailUrl.trim() || null;

      if (inputMode === 'upload' && videoFile) {
        setUploadProgress(t('uploadingYouTube'));
        const formData = new FormData();
        formData.append('file', videoFile);
        formData.append('title', title.trim());
        if (description.trim()) formData.append('description', description.trim());
        const { data: ytData } = await api.post('/uploads/youtube-clip', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 600000,
        });
        finalVideoUrl = ytData.videoUrl;
        finalSource = 'YOUTUBE';
        finalExternalId = ytData.videoId;
        finalThumbnail = ytData.thumbnailUrl;
        setUploadProgress(null);
      }

      const { data } = await api.post('/posts', {
        type: 'CLIP',
        title: title.trim(),
        content: description.trim() || null,
        videoUrl: finalVideoUrl,
        thumbnailUrl: finalThumbnail,
        clipSource: finalSource,
        externalId: finalExternalId,
        duration,
        streamerProfileId,
        communityId: selectedCommunity || undefined,
      });
      router.push(`/posts/${data.id}`);
    } catch (err: any) {
      setUploadProgress(null);
      setError(err.response?.data?.message || t('addFailed'));
    }
    setSubmitting(false);
  };

  if (!token) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="card-neon p-8 text-center space-y-4 max-w-md">
            <Film className="w-12 h-12 text-neon-pink mx-auto" />
            <h2 className="text-xl font-display font-bold text-text-primary">{t('loginRequired')}</h2>
            <p className="text-text-muted">{t('loginDesc')}</p>
            <Link href="/login" className="inline-flex items-center gap-2 bg-neon-pink text-white px-4 py-2 rounded-lg text-sm font-medium">
              {t('loginRequired')}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 mx-auto max-w-2xl w-full px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/clips" className="text-text-muted hover:text-text-secondary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Film className="w-6 h-6 text-neon-pink" />
          <h1 className="text-2xl font-display font-bold text-text-primary">{t('title')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="card-neon p-6 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">{t('titleLabel')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              maxLength={200}
              className="w-full bg-dark-800 border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder:text-text-dimmed focus:outline-none focus:border-neon-pink/50 transition-colors"
            />
          </div>

          {/* Video URL / Upload toggle */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">{t('videoSource')}</label>
            <div className="flex gap-1 bg-dark-800/50 rounded-lg p-0.5 mb-3">
              <button type="button" onClick={() => setInputMode('link')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all ${inputMode === 'link' ? 'bg-neon-purple/15 text-neon-purple' : 'text-text-muted hover:text-text-primary'}`}>
                <Link2 className="w-4 h-4" /> {t('link')}
              </button>
              <button type="button" onClick={() => setInputMode('upload')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all ${inputMode === 'upload' ? 'bg-neon-purple/15 text-neon-purple' : 'text-text-muted hover:text-text-primary'}`}>
                <Upload className="w-4 h-4" /> {t('fromDisk')}
              </button>
            </div>

            {inputMode === 'link' ? (
              <>
                <div className="relative">
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=... lub link do pliku"
                    className="w-full bg-dark-800 border border-border-default rounded-lg px-3 py-2 pr-24 text-text-primary placeholder:text-text-dimmed focus:outline-none focus:border-neon-pink/50 transition-colors"
                  />
                  {detectedSource !== 'UPLOAD' && (
                    <span className={`absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-2xs font-bold ${
                      detectedSource === 'YOUTUBE' ? 'text-red-400 bg-red-400/10' :
                      detectedSource === 'TIKTOK' ? 'text-pink-400 bg-pink-400/10' :
                      detectedSource === 'TWITCH' ? 'text-purple-400 bg-purple-400/10' :
                      'text-green-400 bg-green-400/10'
                    }`}>
                      {detectedSource}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-dimmed">{t('linkHint')}</p>
              </>
            ) : (
              <>
                <input ref={fileInputRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setVideoFile(f); }} />
                {videoFile ? (
                  <div className="flex items-center gap-3 px-3 py-3 bg-dark-800 border border-neon-purple/30 rounded-lg">
                    <Film className="w-5 h-5 text-neon-purple shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary truncate">{videoFile.name}</p>
                      <p className="text-xs text-text-dimmed">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button type="button" onClick={() => { setVideoFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="text-text-dimmed hover:text-neon-red transition-colors shrink-0"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2 px-4 py-8 border-2 border-dashed border-border-default rounded-lg hover:border-neon-purple/50 hover:bg-dark-800/30 transition-all text-text-muted hover:text-text-primary">
                    <Upload className="w-8 h-8" />
                    <span className="text-sm">{t('clickToSelect')}</span>
                    <span className="text-xs text-text-dimmed">{t('fileTypes')}</span>
                  </button>
                )}
                <p className="text-xs text-text-dimmed">{t('youtubeUploadHint')}</p>
              </>
            )}
          </div>

          {/* Preview — only in link mode */}
          {inputMode === 'link' && videoUrl && detectedSource === 'YOUTUBE' && detectedId && (
            <div className="aspect-video rounded-lg overflow-hidden bg-dark-800">
              <iframe
                src={`https://www.youtube.com/embed/${detectedId}`}
                className="w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                style={{ border: 'none' }}
              />
            </div>
          )}

          {/* Thumbnail URL — only in link mode */}
          {inputMode === 'link' && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">{t('thumbnail')}</label>
            <input
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://example.com/thumbnail.jpg"
              className="w-full bg-dark-800 border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder:text-text-dimmed focus:outline-none focus:border-neon-pink/50 transition-colors"
            />
            {thumbnailUrl && (
              <div className="w-32 aspect-video rounded-lg overflow-hidden bg-dark-800 mt-2">
                <img src={thumbnailUrl} alt="preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">{t('description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descPlaceholder')}
              rows={3}
              maxLength={2000}
              className="w-full bg-dark-800 border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder:text-text-dimmed focus:outline-none focus:border-neon-pink/50 transition-colors resize-none"
            />
          </div>

          {/* Streamer */}
          <div className="space-y-1.5" ref={streamerRef}>
            <label className="text-sm font-medium text-text-secondary">{t('streamer')}</label>
            <div className="relative">
              {selectedStreamer ? (
                <div className="flex items-center justify-between w-full bg-dark-800 border border-neon-purple/30 rounded-lg px-3 py-2">
                  <span className="text-text-primary text-sm">{selectedStreamer.name}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedStreamer(null); setStreamerProfileId(null); setStreamerQuery(''); }}
                    className="text-text-dimmed hover:text-neon-pink transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dimmed" />
                  <input
                    type="text"
                    value={streamerQuery}
                    onChange={(e) => { setStreamerQuery(e.target.value); setStreamerOpen(true); }}
                    onFocus={() => setStreamerOpen(true)}
                    placeholder={t('searchStreamer')}
                    className="w-full bg-dark-800 border border-border-default rounded-lg pl-9 pr-3 py-2 text-text-primary placeholder:text-text-dimmed focus:outline-none focus:border-neon-pink/50 transition-colors"
                  />
                </div>
              )}
              {streamerOpen && !selectedStreamer && (
                <div className="absolute z-30 w-full mt-1 bg-dark-800 border border-border-default rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredStreamers.length > 0 ? (
                    filteredStreamers.slice(0, 20).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedStreamer(s);
                          setStreamerProfileId(s.id);
                          setStreamerOpen(false);
                          setStreamerQuery('');
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-neon-purple/10 hover:text-neon-purple transition-colors"
                      >
                        {s.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-sm text-text-dimmed text-center">{t('noStreamers')}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Community – tile blocks */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">{t('community')}</label>
            <div className="flex flex-wrap gap-2">
              {communities.map((c) => {
                const isSelected = selectedCommunity === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCommunity(isSelected ? null : c.id)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all duration-150 flex items-center gap-1.5 ${
                      isSelected
                        ? 'border-transparent text-white shadow-lg scale-105'
                        : 'border-border-default text-text-muted hover:border-border-hover hover:text-text-primary bg-dark-700'
                    }`}
                    style={isSelected ? {
                      backgroundColor: `${c.color || '#00F5FF'}25`,
                      boxShadow: `0 0 12px ${c.color || '#00F5FF'}40`,
                      borderColor: c.color || '#00F5FF',
                    } : undefined}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: c.color || '#00F5FF' }}
                    />
                    #{c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">{t('duration')}</label>
            <input
              type="number"
              value={duration ?? ''}
              onChange={(e) => setDuration(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="60"
              min={1}
              max={3600}
              className="w-full bg-dark-800 border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder:text-text-dimmed focus:outline-none focus:border-neon-pink/50 transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-neon-pink text-white py-3 rounded-xl font-medium transition-all hover:shadow-[0_0_30px_rgba(255,0,170,0.3)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {uploadProgress || t('adding')}
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                {t('addClip')}
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
