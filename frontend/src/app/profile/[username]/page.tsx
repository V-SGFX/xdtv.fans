'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AppLayout } from '@/components/layout/app-layout';
import { UserPostsWall } from '@/components/content/user-posts-wall';
import { Avatar } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  PenLine, MessageSquare, Calendar, Shield, Loader2,
} from 'lucide-react';

interface PublicProfile {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  _count: { posts: number; comments: number };
}

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    (async () => {
      try {
        // Posts belong to UserPostsWall now; this only loads the identity
        // the header renders.
        const profileRes = await api.get(`/users/username/${username}`);
        setProfile(profileRes.data);
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    })();
  }, [username]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-neon-cyan animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (notFound || !profile) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto text-center py-20">
          <p className="text-text-muted text-lg">Użytkownik nie został znaleziony</p>
        </div>
      </AppLayout>
    );
  }

  const roleLabels: Record<string, string> = {
    USER: 'Użytkownik',
    STREAMER: 'Streamer',
    MODERATOR: 'Moderator',
    ADMIN: 'Administrator',
  };

  const stats = [
    { label: 'Posty', value: profile._count.posts, icon: PenLine },
    { label: 'Komentarze', value: profile._count.comments, icon: MessageSquare },
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
                Dołączył {formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true, locale: pl })}
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
          </div>
        </motion.div>

        {/* Posts */}
        <div className="space-y-4">
          <h2 className="text-lg font-display font-semibold text-text-primary flex items-center gap-2">
            <PenLine className="w-5 h-5 text-neon-cyan" />
            Posty ({profile._count.posts})
          </h2>
          <UserPostsWall
            endpoint={`/users/username/${username}/posts`}
            label={username}
            emptyTitle="Ten uzytkownik nie ma jeszcze zadnych postow"
          />
        </div>
      </div>
    </AppLayout>
  );
}
