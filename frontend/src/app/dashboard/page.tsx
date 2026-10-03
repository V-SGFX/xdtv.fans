'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Save, Tv, MessageSquare, Hash, Users, Eye, BarChart3,
  Settings, Radio, Plus, Trash2, Upload, Camera, ToggleLeft, ToggleRight,
  TrendingUp, Clock,
} from 'lucide-react';
import Link from 'next/link';

interface Channel {
  id: number;
  name: string;
  slug: string;
  type: string;
  isActive: boolean;
  _count?: { messages: number };
}

interface DashboardData {
  id: number;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  twitchUrl: string | null;
  youtubeUrl: string | null;
  kickUrl: string | null;
  twitterUrl: string | null;
  chatEnabled: boolean;
  isClaimed: boolean;
  isVerified: boolean;
  isLive: boolean;
  viewCount: number;
  followerCount: number;
  channels: Channel[];
  stats: {
    followers: number;
    posts: number;
    channels: number;
    views: number;
    messagesLast24h: number;
    messagesTotal: number;
  };
}

type Tab = 'overview' | 'profile' | 'chat' | 'channels';

export default function DashboardPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile form
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [twitchUrl, setTwitchUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [kickUrl, setKickUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');

  // Chat settings
  const [chatEnabled, setChatEnabled] = useState(false);

  // New channel
  const [newChannelName, setNewChannelName] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data } = await api.get('/streamers/me/dashboard');
        setDashboard(data);
        setName(data.name || '');
        setBio(data.bio || '');
        setTwitchUrl(data.twitchUrl || '');
        setYoutubeUrl(data.youtubeUrl || '');
        setKickUrl(data.kickUrl || '');
        setTwitterUrl(data.twitterUrl || '');
        setChatEnabled(data.chatEnabled || false);
      } catch {
        /* redirect handled below */
      }
      setLoading(false);
    })();
  }, [token]);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!token || !user) {
    router.push('/login');
    return null;
  }

  if (!dashboard) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
          <Tv className="w-16 h-16 text-text-dimmed mx-auto" />
          <h1 className="text-2xl font-bold text-text-primary">{t('noProfile')}</h1>
          <p className="text-text-muted">
            {t('noProfileDesc')}
          </p>
          <Link href="/discover?tab=streamers">
            <Button variant="primary">{t('browseStreamers')}</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.patch(`/streamers/${dashboard.id}`, { name, bio, twitchUrl, youtubeUrl, kickUrl, twitterUrl });
      setMessage({ type: 'success', text: t('profileSaved') });
    } catch {
      setMessage({ type: 'error', text: t('profileSaveError') });
    }
    setSaving(false);
  };

  const toggleChat = async () => {
    const newVal = !chatEnabled;
    setChatEnabled(newVal);
    try {
      await api.patch(`/streamers/${dashboard.id}`, { chatEnabled: newVal });
      setDashboard((prev) => prev ? { ...prev, chatEnabled: newVal } : prev);
      setMessage({ type: 'success', text: newVal ? t('chatEnabled') : t('chatDisabled') });
    } catch {
      setChatEnabled(!newVal);
      setMessage({ type: 'error', text: t('chatToggleError') });
    }
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) return;
    setCreatingChannel(true);
    try {
      const slug = newChannelName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data } = await api.post('/channels', {
        name: newChannelName.trim(),
        slug,
        type: 'PUBLIC',
        streamerProfileId: dashboard.id,
      });
      setDashboard((prev) => prev ? { ...prev, channels: [...prev.channels, data] } : prev);
      setNewChannelName('');
      setMessage({ type: 'success', text: t('channelCreated') });
    } catch {
      setMessage({ type: 'error', text: t('channelCreateError') });
    }
    setCreatingChannel(false);
  };

  const deleteChannel = async (channelId: number) => {
    if (!confirm(t('deleteChannelConfirm'))) return;
    try {
      await api.delete(`/channels/${channelId}`);
      setDashboard((prev) => prev ? { ...prev, channels: prev.channels.filter((c) => c.id !== channelId) } : prev);
      setMessage({ type: 'success', text: t('channelDeleted') });
    } catch {
      setMessage({ type: 'error', text: t('channelDeleteError') });
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: t('tabOverview'), icon: BarChart3 },
    { id: 'profile', label: t('tabProfile'), icon: Settings },
    // { id: 'chat', label: 'Czat', icon: MessageSquare },
    // { id: 'channels', label: 'Kanały', icon: Hash },
  ];

  const statCards = [
    { label: t('followers'), value: dashboard.stats.followers, icon: Users, color: 'neon-cyan' },
    { label: t('views'), value: dashboard.stats.views, icon: Eye, color: 'neon-purple' },
    { label: t('messages24h'), value: dashboard.stats.messagesLast24h, icon: TrendingUp, color: 'neon-pink' },
    { label: t('messagesTotal'), value: dashboard.stats.messagesTotal, icon: MessageSquare, color: 'neon-green' },
    { label: t('postsCount'), value: dashboard.stats.posts, icon: BarChart3, color: 'neon-blue' },
    { label: t('channelsCount'), value: dashboard.stats.channels, icon: Hash, color: 'neon-cyan' },
  ];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/streamers/${dashboard.slug}`} className="text-text-dimmed hover:text-text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Radio className="w-5 h-5 text-neon-pink" />
                {t('title')}
              </h1>
              <p className="text-sm text-text-muted">{dashboard.name}</p>
            </div>
          </div>
          {dashboard.isLive && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neon-red/20 text-neon-red text-xs font-bold rounded-full border border-neon-red/30">
              <span className="w-2 h-2 rounded-full bg-neon-red animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        {/* Toast */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-3 rounded-lg text-sm font-medium ${
                message.type === 'success'
                  ? 'bg-neon-green/10 text-neon-green border border-neon-green/20'
                  : 'bg-neon-red/10 text-neon-red border border-neon-red/20'
              }`}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-dark-800/50 rounded-xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  active
                    ? 'bg-neon-purple/10 text-neon-cyan shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-dark-700/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {statCards.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className="bg-dark-800/60 border border-border-default rounded-xl p-4 space-y-2 hover:bg-dark-800/80 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 text-${stat.color}`} />
                        <span className="text-xs text-text-dimmed uppercase tracking-wider">{stat.label}</span>
                      </div>
                      <p className="text-2xl font-bold text-text-primary">
                        {stat.value.toLocaleString('pl-PL')}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Quick status */}
              <div className="bg-dark-800/60 border border-border-default rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">{t('status')}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">{t('chatLabel')}</span>
                    <span className={dashboard.chatEnabled ? 'text-neon-green' : 'text-text-dimmed'}>
                      {dashboard.chatEnabled ? t('on') : t('off')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">{t('verifiedLabel')}</span>
                    <span className={dashboard.isVerified ? 'text-neon-cyan' : 'text-text-dimmed'}>
                      {dashboard.isVerified ? t('yes') : t('no')}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-dark-800/60 border border-border-default rounded-xl p-5 space-y-5">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">{t('profileData')}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">{t('name')}</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('name')} />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">{t('bio')}</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder={t('bioPlaceholder')}
                      rows={3}
                      className="w-full bg-dark-800/50 border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-dimmed focus:outline-none focus:border-neon-purple/50 transition-all resize-none"
                    />
                  </div>
                </div>

                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider pt-2">{t('links')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">Twitch</label>
                    <Input value={twitchUrl} onChange={(e) => setTwitchUrl(e.target.value)} placeholder="https://twitch.tv/..." />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">YouTube</label>
                    <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/..." />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">Kick</label>
                    <Input value={kickUrl} onChange={(e) => setKickUrl(e.target.value)} placeholder="https://kick.com/..." />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">Twitter / X</label>
                    <Input value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="https://x.com/..." />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button variant="primary" onClick={saveProfile} disabled={saving}>
                    <Save className="w-4 h-4 mr-1.5" />
                    {saving ? t('saving') : t('saveProfile')}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-dark-800/60 border border-border-default rounded-xl p-5 space-y-5">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">{t('chatSettings')}</h3>

                <div className="flex items-center justify-between p-4 bg-dark-800/40 rounded-xl border border-border-default">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-text-primary">{t('streamerChat')}</p>
                    <p className="text-xs text-text-muted">
                      {t('chatDesc')}
                    </p>
                  </div>
                  <button
                    onClick={toggleChat}
                    className="shrink-0 transition-colors"
                  >
                    {chatEnabled ? (
                      <ToggleRight className="w-10 h-10 text-neon-green" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-text-dimmed" />
                    )}
                  </button>
                </div>

                <div className="p-4 bg-dark-800/40 rounded-xl border border-border-default text-xs text-text-dimmed space-y-1.5">
                  <p className="font-medium text-text-muted">{t('howItWorks')}</p>
                  <p>{t('howItWorksDesc')}</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'channels' && (
            <motion.div
              key="channels"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-dark-800/60 border border-border-default rounded-xl p-5 space-y-5">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">{t('yourChannels')}</h3>

                {/* Channel list */}
                <div className="space-y-2">
                  {dashboard.channels.length === 0 ? (
                    <p className="text-sm text-text-dimmed text-center py-6">{t('noChannels')}</p>
                  ) : (
                    dashboard.channels.map((ch) => (
                      <div
                        key={ch.id}
                        className="flex items-center justify-between p-3 bg-dark-800/40 rounded-lg border border-border-default"
                      >
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4 text-text-dimmed" />
                          <span className="text-sm font-medium text-text-primary">{ch.name}</span>
                          <span className="text-2xs px-1.5 py-0.5 bg-dark-600 text-text-dimmed rounded uppercase">
                            {ch.type}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteChannel(ch.id)}
                          className="text-text-dimmed hover:text-neon-red transition-colors p-1.5 rounded-lg hover:bg-neon-red/5"
                          title={t('deleteChannel')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Create new channel */}
                <div className="flex gap-2">
                  <Input
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder={t('channelNamePlaceholder')}
                    onKeyDown={(e) => e.key === 'Enter' && createChannel()}
                  />
                  <Button
                    variant="primary"
                    onClick={createChannel}
                    disabled={creatingChannel || !newChannelName.trim()}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t('create')}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
