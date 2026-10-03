'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AppLayout } from '@/components/layout/app-layout';
import { UserPostsWall } from '@/components/content/user-posts-wall';
import { SavedWall } from '@/components/content/saved-wall';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';
import {
  Settings, PenLine, MessageSquare, Heart, ThumbsUp, Calendar, Shield, Tv, Bookmark,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

interface ProfileData {
  id: number;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  _count: { posts: number; comments: number; follows: number; votes: number };
}

interface FollowedStreamer {
  id: number;
  streamerProfile: { id: number; slug: string; name: string; avatarUrl: string | null };
}

export default function ProfilePage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations('profile');
  const tFeed = useTranslations('feed');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const dateLocale = locale === 'pl' ? pl : enUS;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [follows, setFollows] = useState<FollowedStreamer[]>([]);
  const [tab, setTab] = useState<'posts' | 'saved' | 'follows'>('posts');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!token) { router.push('/login'); return; }

    const fetchAll = async () => {
      try {
        // Posts are owned by UserPostsWall now; this only loads the
        // identity and follow data the header needs.
        const [meRes, followsRes] = await Promise.all([
          api.get('/users/me'),
          api.get('/follows/me'),
        ]);
        setProfile(meRes.data);
        setFollows(followsRes.data);
      } catch { /* */ }
      setLoading(false);
    };
    fetchAll();
  }, [token, authLoading]);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) return null;

  const roleLabels: Record<string, string> = {
    USER: t('roleUser'),
    STREAMER: t('roleStreamer'),
    MODERATOR: t('roleModerator'),
    ADMIN: t('roleAdmin'),
  };

  const stats = [
    { label: t('tabPosts'), value: profile._count.posts, icon: PenLine },
    { label: t('tabComments'), value: profile._count.comments, icon: MessageSquare },
    { label: t('tabFollowing'), value: profile._count.follows, icon: Heart },
    { label: t('tabVotes'), value: profile._count.votes, icon: ThumbsUp },
  ];

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-neon p-6"
        >
          <div className="flex items-start gap-5">
            <Avatar
              src={profile.avatarUrl}
              name={profile.displayName || profile.username}
              size="xl"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-display font-bold text-text-primary">
                  {profile.displayName || profile.username}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-neon-purple/10 text-neon-purple border border-neon-purple/20">
                  <Shield className="w-3 h-3" />
                  {roleLabels[profile.role] || profile.role}
                </span>
              </div>
              <p className="text-sm text-text-muted mt-1">@{profile.username}</p>
              <div className="flex items-center gap-1.5 text-xs text-text-dimmed mt-2">
                <Calendar className="w-3.5 h-3.5" />
                {t('joined', { time: formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true, locale: dateLocale }) })}
              </div>

              {/* Stats */}
              <div className="flex gap-4 mt-4">
                {stats.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="text-center">
                      <div className="flex items-center gap-1 text-text-primary font-semibold text-sm">
                        <Icon className="w-3.5 h-3.5 text-neon-cyan" />
                        {s.value}
                      </div>
                      <div className="text-2xs text-text-dimmed uppercase tracking-wider">{s.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" /> {tNav('settings')}
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-dark-800/50 rounded-xl p-1">
          <button
            onClick={() => setTab('posts')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'posts' ? 'bg-dark-700/60 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-dark-700/60'
            }`}
          >
            <PenLine className="w-4 h-4" /> {t('myPosts', { count: profile._count.posts })}
          </button>
          <button
            onClick={() => setTab('saved')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'saved' ? 'bg-dark-700/60 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-dark-700/60'
            }`}
          >
            <Bookmark className="w-4 h-4" /> {tFeed('savedTitle')}
          </button>
          <button
            onClick={() => setTab('follows')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'follows' ? 'bg-dark-700/60 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-dark-700/60'
            }`}
          >
            <Heart className="w-4 h-4" /> {t('myFollowing', { count: profile._count.follows })}
          </button>
        </div>

        {/* Tab content */}
        {tab === 'posts' && (
          <UserPostsWall
            endpoint="/users/me/posts"
            label={t('myPosts')}
            emptyTitle={t('noPosts')}
          />
        )}

        {tab === 'saved' && <SavedWall />}

        {tab === 'follows' && (
          <div className="space-y-2">
            {follows.length === 0 ? (
              <div className="text-center py-12">
                <Tv className="w-10 h-10 text-text-dimmed mx-auto mb-3" />
                <p className="text-text-muted">{t('noFollowing')}</p>
                <Link href="/discover?tab=streamers" className="mt-3 inline-block">
                  <Button variant="primary" size="sm">{t('discoverStreamers')}</Button>
                </Link>
              </div>
            ) : (
              follows.map((f) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Link
                    href={`/streamers/${f.streamerProfile.slug}`}
                    className="card-neon p-4 flex items-center gap-3 hover:border-neon-cyan/30 transition-colors"
                  >
                    <Avatar
                      src={f.streamerProfile.avatarUrl}
                      name={f.streamerProfile.name}
                      size="md"
                    />
                    <span className="font-medium text-text-primary">{f.streamerProfile.name}</span>
                    <Tv className="w-4 h-4 text-neon-purple ml-auto" />
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
