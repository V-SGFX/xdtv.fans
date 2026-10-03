'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AppLayout } from '@/components/layout/app-layout';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';
import {
  Shield, Users, FileText, Flag, BarChart3,
  Ban, UserCheck, Pin, PinOff, Trash2,
  ChevronLeft, ChevronRight, Search, Check, X,
  AlertTriangle, Eye, MessageSquare, ShieldCheck,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

type Tab = 'dashboard' | 'users' | 'posts' | 'reports' | 'communities';

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('dashboard');
  const t = useTranslations('admin');

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'ADMIN' && user.role !== 'MODERATOR'))) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading || !user || (user.role !== 'ADMIN' && user.role !== 'MODERATOR')) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  const tabs: { key: Tab; label: string; icon: any; adminOnly?: boolean }[] = [
    { key: 'dashboard', label: t('dashboard'), icon: BarChart3 },
    { key: 'users', label: t('users'), icon: Users, adminOnly: true },
    { key: 'posts', label: t('posts'), icon: FileText },
    { key: 'reports', label: t('reports'), icon: Flag },
    // Zatwierdzanie moderatorów społeczności należy do administratora:
    // właściciel społeczności zgłasza, admin dopuszcza. Bez tego kroku
    // każdy, kto założy społeczność, mógłby mnożyć moderatorów sam.
    { key: 'communities', label: t('communities'), icon: ShieldCheck, adminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.adminOnly || user.role === 'ADMIN');

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-neon-pink" />
          <h1 className="text-2xl font-display font-bold text-text-primary">
            {t('title')}
          </h1>
          <Badge variant="premium" className="ml-2">{user.role}</Badge>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-dark-800 p-1 rounded-xl">
          {visibleTabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key
                    ? 'bg-neon-pink/10 text-neon-pink'
                    : 'text-text-muted hover:text-text-primary hover:bg-dark-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {tab === 'dashboard' && <DashboardTab />}
            {tab === 'users' && user.role === 'ADMIN' && <UsersTab />}
            {tab === 'posts' && <PostsTab />}
            {tab === 'reports' && <ReportsTab />}
            {tab === 'communities' && user.role === 'ADMIN' && <CommunitiesTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────

function DashboardTab() {
  const [stats, setStats] = useState<any>(null);
  const [reportCounts, setReportCounts] = useState<any>(null);
  const t = useTranslations('admin');

  useEffect(() => {
    api.get('/moderation/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/moderation/reports/counts').then(r => setReportCounts(r.data)).catch(() => {});
  }, []);

  const statCards = stats ? [
    { label: t('usersTotal'), value: stats.usersTotal, color: 'text-neon-cyan' },
    { label: t('activeUsers'), value: stats.activeUsers, color: 'text-neon-green' },
    { label: t('newToday'), value: stats.newUsersToday, color: 'text-neon-purple' },
    { label: t('postsToday'), value: stats.postsToday, color: 'text-neon-pink' },
    { label: t('messagesToday'), value: stats.messagesToday, color: 'text-neon-cyan' },
    { label: t('streamers'), value: stats.streamersTotal, color: 'text-neon-purple' },
    { label: t('channels'), value: stats.channelsTotal, color: 'text-neon-green' },
    { label: t('news'), value: stats.newsTotal, color: 'text-neon-pink' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats ? statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="card-neon p-4 text-center"
          >
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-text-dimmed mt-1">{s.label}</p>
          </motion.div>
        )) : (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card-neon p-4 animate-pulse">
              <div className="h-8 bg-dark-600 rounded w-12 mx-auto" />
              <div className="h-3 bg-dark-600 rounded w-20 mx-auto mt-2" />
            </div>
          ))
        )}
      </div>

      {/* Report Summary */}
      {reportCounts && (
        <div className="card-neon p-5">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
            <Flag className="w-4 h-4 text-neon-pink" /> {t('reports')}
          </h3>
          <div className="flex gap-6">
            <div>
              <p className="text-xl font-bold text-neon-yellow">{reportCounts.pending}</p>
              <p className="text-xs text-text-dimmed">{t('pending')}</p>
            </div>
            <div>
              <p className="text-xl font-bold text-neon-green">{reportCounts.resolved}</p>
              <p className="text-xs text-text-dimmed">{t('resolved')}</p>
            </div>
            <div>
              <p className="text-xl font-bold text-text-muted">{reportCounts.dismissed}</p>
              <p className="text-xs text-text-dimmed">{t('dismissed')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── USERS ────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const t = useTranslations('admin');
  const locale = useLocale();
  const dateLocale = locale === 'pl' ? pl : enUS;

  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '15' });
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);
    const { data } = await api.get(`/moderation/users?${params}`);
    setUsers(data.data);
    setMeta(data.meta);
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (userId: number, role: string) => {
    await api.patch(`/moderation/users/${userId}/role`, { role });
    fetchUsers();
  };

  const handleToggleBan = async (userId: number) => {
    await api.patch(`/moderation/users/${userId}/ban`);
    fetchUsers();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-dimmed" />
          <Input
            placeholder={t('searchUser')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-dark-700 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary"
        >
          <option value="">{t('allRoles')}</option>
          <option value="USER">USER</option>
          <option value="STREAMER">STREAMER</option>
          <option value="MODERATOR">MODERATOR</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </div>

      {/* Table */}
      <div className="card-neon overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-text-dimmed text-left">
                <th className="px-4 py-3">{t('user')}</th>
                <th className="px-4 py-3">{t('email')}</th>
                <th className="px-4 py-3">{t('role')}</th>
                <th className="px-4 py-3">{t('posts')}</th>
                <th className="px-4 py-3">{t('status')}</th>
                <th className="px-4 py-3">{t('joined')}</th>
                <th className="px-4 py-3">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-dark-700 hover:bg-dark-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar src={u.avatarUrl} name={u.displayName || u.username} size="sm" />
                      <div>
                        <p className="font-medium text-text-primary">{u.displayName || u.username}</p>
                        <p className="text-xs text-text-dimmed">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.role === 'ADMIN' ? (
                      <Badge variant="premium">{u.role}</Badge>
                    ) : (
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        className="bg-dark-600 border border-border-default rounded px-2 py-1 text-xs text-text-primary"
                      >
                        <option value="USER">USER</option>
                        <option value="STREAMER">STREAMER</option>
                        <option value="MODERATOR">MODERATOR</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{u._count?.posts ?? 0}</td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <span className="text-neon-green text-xs font-medium">{t('active')}</span>
                    ) : (
                      <span className="text-neon-red text-xs font-medium">{t('banned')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-dimmed">
                    {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true, locale: dateLocale })}
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== 'ADMIN' && (
                      <button
                        onClick={() => handleToggleBan(u.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.isActive
                            ? 'text-text-muted hover:text-neon-red hover:bg-neon-red/10'
                            : 'text-neon-green hover:bg-neon-green/10'
                        }`}
                        title={u.isActive ? t('ban') : t('unban')}
                      >
                        {u.isActive ? <Ban className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {meta && meta.pages > 1 && (
        <Pagination page={page} pages={meta.pages} onPageChange={setPage} />
      )}
    </div>
  );
}

// ─── POSTS ────────────────────────────────────────────────

function PostsTab() {
  const [posts, setPosts] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const t = useTranslations('admin');
  const locale = useLocale();
  const dateLocale = locale === 'pl' ? pl : enUS;

  const fetchPosts = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '15' });
    if (search) params.set('search', search);
    const { data } = await api.get(`/moderation/posts?${params}`);
    setPosts(data.data);
    setMeta(data.meta);
  }, [page, search]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleTogglePin = async (postId: number) => {
    await api.patch(`/moderation/posts/${postId}/pin`);
    fetchPosts();
  };

  const handleDelete = async (postId: number) => {
    if (!confirm(t('confirmDelete'))) return;
    await api.delete(`/moderation/posts/${postId}`);
    fetchPosts();
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-dimmed" />
        <Input
          placeholder={t('searchPosts')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      <div className="space-y-2">
        {posts.map(p => (
          <div key={p.id} className={`card-neon p-4 flex items-center gap-3 ${p.isDeleted ? 'opacity-50' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {/* Tytuł prowadzi do posta. Moderowanie po samym tytule
                    i liczbie głosów to zgadywanie — zwłaszcza przy
                    zgłoszeniach, gdzie liczy się treść, nie nagłówek. */}
                <a
                  href={`/posts/${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-text-primary truncate hover:text-neon-cyan transition-colors"
                  title={t('openPost')}
                >
                  {p.title}
                </a>
                {p.isPinned && <Pin className="w-3 h-3 text-neon-yellow shrink-0" />}
                {p.isDeleted && <Badge variant="live" className="text-2xs">{t('deleted')}</Badge>}
              </div>
              <div className="flex items-center gap-3 text-xs text-text-dimmed mt-1">
                <span>@{p.author?.username}</span>
                <span className="flex items-center gap-0.5">↑{p.upvotes} ↓{p.downvotes}</span>
                <span className="flex items-center gap-0.5">
                  <MessageSquare className="w-3 h-3" /> {p.commentCount}
                </span>
                <span>{formatDistanceToNow(new Date(p.createdAt), { addSuffix: true, locale: dateLocale })}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={`/posts/${p.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-text-muted hover:text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
                title={t('openPost')}
              >
                <Eye className="w-4 h-4" />
              </a>
              <button
                onClick={() => handleTogglePin(p.id)}
                className={`p-1.5 rounded-lg transition-colors ${
                  p.isPinned
                    ? 'text-neon-yellow hover:bg-neon-yellow/10'
                    : 'text-text-muted hover:text-neon-yellow hover:bg-neon-yellow/10'
                }`}
                title={p.isPinned ? t('unpin') : t('pin')}
              >
                {p.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
              {!p.isDeleted && (
                <button
                  onClick={() => handleDelete(p.id)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-neon-red hover:bg-neon-red/10 transition-colors"
                  title="Usuń"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {meta && meta.pages > 1 && (
        <Pagination page={page} pages={meta.pages} onPageChange={setPage} />
      )}
    </div>
  );
}

// ─── REPORTS ──────────────────────────────────────────────

function ReportsTab() {
  const [reports, setReports] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [resolving, setResolving] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const t = useTranslations('admin');
  const locale = useLocale();
  const dateLocale = locale === 'pl' ? pl : enUS;

  const fetchReports = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '15' });
    if (statusFilter) params.set('status', statusFilter);
    const { data } = await api.get(`/moderation/reports?${params}`);
    setReports(data.data);
    setMeta(data.meta);
  }, [page, statusFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleResolve = async (reportId: number, status: string) => {
    await api.patch(`/moderation/reports/${reportId}`, { status, adminNote: adminNote || undefined });
    setResolving(null);
    setAdminNote('');
    fetchReports();
  };

  const handleDeleteTarget = async (report: any) => {
    if (report.targetType === 'POST') {
      await api.delete(`/moderation/posts/${report.targetId}`);
    } else if (report.targetType === 'COMMENT') {
      await api.delete(`/moderation/comments/${report.targetId}`);
    } else if (report.targetType === 'USER') {
      await api.patch(`/moderation/users/${report.targetId}/ban`);
    }
    fetchReports();
  };

  /**
   * Dokąd prowadzi zgłoszenie.
   *
   * Komentarz ma własny identyfikator, więc /posts/{targetId} otworzyłoby
   * przypadkowy post o tym numerze albo nic. Do posta prowadzi dopiero
   * `target.postId`, który backend dołącza właśnie w tym celu. Zgłoszenia
   * użytkowników nie mają dokąd prowadzić.
   */
  const targetHref = (r: any): string | null => {
    if (r.targetType === 'POST') return `/posts/${r.targetId}`;
    if (r.targetType === 'COMMENT' && r.target?.postId) return `/posts/${r.target.postId}`;
    return null;
  };

  const targetTypeLabel = (tt: string) => {
    switch (tt) {
      case 'POST': return t('post');
      case 'COMMENT': return t('comment');
      case 'USER': return t('user');
      default: return tt;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'PENDING': return 'text-neon-yellow';
      case 'RESOLVED': return 'text-neon-green';
      case 'DISMISSED': return 'text-text-muted';
      default: return '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['PENDING', 'RESOLVED', 'DISMISSED', ''].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-neon-pink/10 text-neon-pink'
                : 'text-text-muted hover:text-text-primary hover:bg-dark-700'
            }`}
          >
            {s === '' ? t('all') : s === 'PENDING' ? t('pending') : s === 'RESOLVED' ? t('resolved') : t('dismissed')}
          </button>
        ))}
      </div>

      {reports.length === 0 ? (
        <div className="card-neon p-10 text-center">
          <Flag className="w-12 h-12 text-text-dimmed mx-auto mb-3" />
          <p className="text-text-muted">{t('noReports')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="card-neon p-4 space-y-3">
              {/* Report Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-neon-yellow" />
                  {/* Ta sama zasada co w zakładce postów: zgłoszenie ocenia
                      się po treści, a nie po jego numerze. Użytkownicy nie
                      mają strony profilu pod /posts, więc link dostają tylko
                      typy, które gdzieś prowadzą. */}
                  {targetHref(r) ? (
                    <a
                      href={targetHref(r)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-text-primary hover:text-neon-cyan transition-colors inline-flex items-center gap-1"
                      title={t('openPost')}
                    >
                      {targetTypeLabel(r.targetType)} #{r.targetId}
                      <Eye className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-text-primary">
                      {targetTypeLabel(r.targetType)} #{r.targetId}
                    </span>
                  )}
                  <span className={`text-xs font-medium ${statusColor(r.status)}`}>
                    {r.status}
                  </span>
                </div>
                <span className="text-xs text-text-dimmed">
                  {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: dateLocale })}
                </span>
              </div>

              {/* Reporter + Reason */}
              <div className="text-sm space-y-1">
                <p className="text-text-muted">
                  <span className="text-text-dimmed">{t('reportedBy')}</span> @{r.reporter?.username}
                </p>
                <p className="text-text-secondary">{r.reason}</p>
              </div>

              {/* Target Preview */}
              {r.target && (
                <div className="bg-dark-800 rounded-lg p-3 text-sm">
                  {r.targetType === 'POST' && (
                    <div>
                      <p className="font-medium text-text-primary">{r.target.title}</p>
                      <p className="text-text-muted text-xs mt-1 line-clamp-2">{r.target.content}</p>
                      <p className="text-xs text-text-dimmed mt-1">{t('author')}: @{r.target.author?.username}</p>
                    </div>
                  )}
                  {r.targetType === 'COMMENT' && (
                    <div>
                      <p className="text-text-muted line-clamp-3">{r.target.content}</p>
                      <p className="text-xs text-text-dimmed mt-1">{t('author')}: @{r.target.author?.username} • {t('post')} #{r.target.postId}</p>
                    </div>
                  )}
                  {r.targetType === 'USER' && (
                    <div className="flex items-center gap-2">
                      <p className="text-text-primary font-medium">@{r.target.username}</p>
                      <span className="text-xs text-text-dimmed">{r.target.role}</span>
                      <span className={`text-xs ${r.target.isActive ? 'text-neon-green' : 'text-neon-red'}`}>
                        {r.target.isActive ? t('active') : t('banned')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Admin Note */}
              {r.adminNote && (
                <p className="text-xs text-text-dimmed italic">
                  {t('adminNote')} {r.adminNote}
                </p>
              )}

              {/* Actions */}
              {r.status === 'PENDING' && (
                <div className="flex items-center gap-2 pt-2 border-t border-dark-600">
                  {resolving === r.id ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder={t('adminNotePlaceholder')}
                        value={adminNote}
                        onChange={e => setAdminNote(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="primary" onClick={() => handleResolve(r.id, 'RESOLVED')}>
                          <Check className="w-3 h-3" /> {t('resolve')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleResolve(r.id, 'DISMISSED')}>
                          <X className="w-3 h-3" /> {t('dismiss')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setResolving(null); setAdminNote(''); }}>
                          {t('cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setResolving(r.id)}>
                        <Eye className="w-3 h-3" /> {t('review')}
                      </Button>
                      <button
                        onClick={() => handleDeleteTarget(r)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-neon-red hover:bg-neon-red/10 transition-colors"
                        title={r.targetType === 'USER' ? t('banUser') : t('deleteContent')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {meta && meta.pages > 1 && (
        <Pagination page={page} pages={meta.pages} onPageChange={setPage} />
      )}
    </div>
  );
}

// ─── PAGINATION ───────────────────────────────────────────

function Pagination({ page, pages, onPageChange }: { page: number; pages: number; onPageChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="p-2 rounded-lg text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm text-text-muted">
        {page} / {pages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
        className="p-2 rounded-lg text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Community moderator approvals.
 *
 * The community owner nominates; this is where an administrator decides.
 * The queue shows who is being put forward, by whom and for which
 * community, because "approve" without that context is a rubber stamp.
 */
function CommunitiesTab() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('admin');
  const locale = useLocale();
  const dateLocale = locale === 'pl' ? pl : enUS;

  const fetchPending = useCallback(async () => {
    try {
      const { data } = await api.get('/communities/moderators/pending');
      setPending(data);
      setError(null);
    } catch {
      setError(t('communitiesLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const act = async (id: number, what: 'approve' | 'reject') => {
    setBusy(id);
    try {
      await api.patch(`/communities/moderators/${id}/${what}`,
        what === 'reject' ? { reason: reason || undefined } : {});
      setRejecting(null);
      setReason('');
      await fetchPending();
    } catch {
      setError(t('communitiesActionFailed'));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="text-text-dimmed text-sm">{t('loading')}</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="px-4 py-3 rounded-lg bg-neon-pink/10 text-neon-pink text-sm">
          {error}
        </p>
      )}

      {pending.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-text-dimmed" />
          <p className="text-text-dimmed text-sm">{t('noPendingModerators')}</p>
        </div>
      ) : (
        pending.map((row) => (
          <div key={row.id} className="p-4 rounded-lg bg-surface-elevated border border-border-default">
            <div className="flex items-start gap-3">
              <Avatar src={row.user.avatarUrl} name={row.user.username} size="md" />

              <div className="min-w-0 flex-1">
                <p className="text-text-primary font-medium truncate">{row.user.username}</p>
                <p className="text-text-dimmed text-xs mt-0.5">
                  {t('nominatedFor')}{' '}
                  <span className="text-neon-cyan">{row.community.name}</span>
                  {' · '}
                  {row.community.memberCount} {t('members')}
                </p>
                <p className="text-text-dimmed text-xs mt-0.5">
                  {t('nominatedBy')} {row.nominatedBy?.username ?? '—'}
                  {' · '}
                  {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true, locale: dateLocale })}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  disabled={busy === row.id}
                  onClick={() => act(row.id, 'approve')}
                >
                  <Check className="w-3.5 h-3.5" />
                  {t('approve')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === row.id}
                  onClick={() => setRejecting(rejecting === row.id ? null : row.id)}
                >
                  <X className="w-3.5 h-3.5" />
                  {t('reject')}
                </Button>
              </div>
            </div>

            {rejecting === row.id && (
              <div className="mt-3 flex items-center gap-2">
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('rejectReasonPlaceholder')}
                  className="flex-1"
                />
                <Button size="sm" disabled={busy === row.id} onClick={() => act(row.id, 'reject')}>
                  {t('confirmReject')}
                </Button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
