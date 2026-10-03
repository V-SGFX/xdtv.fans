'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAuthGate } from '@/lib/auth-gate';
import { AppLayout } from '@/components/layout/app-layout';
import { Comment } from '@/components/comment';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';
import { useTranslations, useLocale } from 'next-intl';
import {
  ArrowBigUp, ArrowBigDown, MessageSquare, ArrowLeft,
  Pin, Send, AlertTriangle, Eye, ChevronLeft, ChevronRight,
  Film, Clock, HelpCircle, Share2, Check, X, BarChart3,
} from 'lucide-react';
import { ReportButton } from '@/components/report-modal';
import { EmojiReactions } from '@/components/emoji-reactions';
import { RichContent } from '@/components/rich-text-editor';
import { ImageViewer } from '@/components/image-viewer';
import { AmaSection } from '@/components/ama-section';
import type { Post, Comment as CommentType, PaginatedResponse } from '@/lib/types';
import { AdSlot } from '@/components/ads/ad-slot';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const postId = Number(params.id);
  const t = useTranslations('postDetail');
  const tPosts = useTranslations('posts');
  const locale = useLocale();
  const dateLocale = locale === 'pl' ? pl : enUS;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentSort, setCommentSort] = useState<'best' | 'new' | 'controversial'>('best');
  const [myVote, setMyVote] = useState<'UP' | 'DOWN' | null>(null);
  const [up, setUp] = useState(0);
  const [down, setDown] = useState(0);
  const [nsfwRevealed, setNsfwRevealed] = useState(false);
  const [reactions, setReactions] = useState<{ emoji: string; count: number; reacted: boolean; users?: { id: number; username: string; displayName: string | null }[] }[]>([]);
  const [imgIdx, setImgIdx] = useState(0);
  const [shared, setShared] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  // Poll state
  const [pollResults, setPollResults] = useState<{ options: { id: number; text: string; voteCount: number; percentage: number }[]; totalVotes: number; userVoteOptionId: number | null } | null>(null);
  const [votingOptionId, setVotingOptionId] = useState<number | null>(null);

  const fetchPost = useCallback(async () => {
    try {
      const { data } = await api.get(`/posts/${postId}`);
      setPost(data);
      setUp(data.upvotes);
      setDown(data.downvotes);
      // Record view for clip posts
      if (data.type === 'CLIP') {
        api.post(`/posts/${postId}/view`).catch(() => {});
      }
      // Fetch user vote
      try {
        const { data: votes } = await api.get(`/posts/user-votes/batch?ids=${postId}`);
        setMyVote(votes[postId] || null);
      } catch { /* not logged in */ }
      // Fetch reactions
      try {
        const { data: r } = await api.get(`/posts/${postId}/reactions`);
        setReactions(r);
      } catch { /* */ }
      // Fetch poll results
      if (data.type === 'POLL') {
        try {
          const { data: pr } = await api.get(`/posts/${postId}/poll/results`);
          setPollResults(pr);
        } catch { /* */ }
      }
    } catch {
      router.push('/posts');
    }
  }, [postId, router]);

  const fetchComments = useCallback(async (sort?: string) => {
    try {
      const s = sort ?? commentSort;
      const { data } = await api.get<PaginatedResponse<CommentType>>(`/comments?postId=${postId}&limit=50&sort=${s}`);
      setComments(data.data);
    } catch { /* */ }
  }, [postId, commentSort]);

  useEffect(() => {
    Promise.all([fetchPost(), fetchComments()]).finally(() => setLoading(false));
  }, [fetchPost, fetchComments]);



  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    if (!requireAuth('comment')) return;
    setSubmitting(true);
    try {
      await api.post('/comments', { postId, content: newComment.trim() });
      setNewComment('');
      fetchComments();
      // Update local comment count
      setPost((prev) => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
    } catch {
      alert(t('commentFailed'));
    }
    setSubmitting(false);
  };

  const handleReply = async (parentId: number, content: string) => {
    await api.post('/comments', { postId, parentId, content });
    fetchComments();
    setPost((prev) => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
  };

  const handleDelete = async (commentId: number) => {
    await api.delete(`/comments/${commentId}`);
    fetchComments();
    setPost((prev) => prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev);
  };

  const handleVote = async (commentId: number, direction: 'up' | 'down') => {
    const { data } = await api.post(`/comments/${commentId}/vote`, { direction });
    return data;
  };

  const handleSortChange = (sort: 'best' | 'new' | 'controversial') => {
    setCommentSort(sort);
    fetchComments(sort);
  };

  const handlePostVote = async (direction: 'up' | 'down') => {
    if (!requireAuth('vote')) return;
    try {
      const { data } = await api.post(`/posts/${postId}/vote`, { direction });
      setUp(data.upvotes);
      setDown(data.downvotes);
      setMyVote(data.vote);
    } catch { /* */ }
  };

  const handleReact = async (emoji: string) => {
    if (!requireAuth('react')) return;
    try {
      const { data } = await api.post(`/posts/${postId}/reactions`, { emoji });
      setReactions(data);
    } catch { /* */ }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/posts/${postId}`;
    if (navigator.share) {
      try { await navigator.share({ title: post?.title || '', url }); return; } catch { /* */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* */ }
  };

  const handlePollVote = async (optionId: number) => {
    if (!requireAuth('vote')) return;
    setVotingOptionId(optionId);
    try {
      await api.post(`/posts/${postId}/poll/vote`, { optionId });
      const { data: pr } = await api.get(`/posts/${postId}/poll/results`);
      setPollResults(pr);
    } catch { /* */ }
    setVotingOptionId(null);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </AppLayout>
    );
  }

  if (!post) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto text-center py-16">
          <p className="text-text-muted text-sm">{t('notFound')}</p>
          <button onClick={() => router.push('/posts')} className="text-neon-cyan hover:underline text-sm mt-2">
            {t('backToPosts')}
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-[700px] mx-auto space-y-3">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-neon-cyan transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('back')}
        </button>

        {/* Post */}
        <motion.article
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-900 border border-border-default rounded-lg p-4 space-y-3"
        >
          {/* Header */}
          <div className="flex items-center gap-2 text-2xs">
            <Avatar src={post.author.avatarUrl} name={post.author.displayName || post.author.username} size="xs" />
            <span className="text-xs font-medium text-text-primary">
              {post.author.displayName || post.author.username}
            </span>
            {post.streamerProfile && (
              <>
                <span className="text-text-dimmed text-xs">{tPosts('in')}</span>
                <span className="text-xs font-medium text-neon-purple">{post.streamerProfile.name}</span>
              </>
            )}
            <span className="text-text-dimmed text-xs">•</span>
            <span className="text-xs text-text-muted">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: dateLocale })}
            </span>
            {post.isPinned && (
              <Badge variant="premium" className="ml-auto">
                <Pin className="w-2.5 h-2.5" /> {tPosts('pinned')}
              </Badge>
            )}
            {post.type === 'AMA' && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-2xs font-semibold bg-neon-purple/15 text-neon-purple">
                <HelpCircle className="w-2.5 h-2.5" /> AMA
              </span>
            )}
            {post.isNsfw && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-2xs font-semibold bg-neon-red/15 text-neon-red ml-auto">
                <AlertTriangle className="w-2.5 h-2.5" /> 18+
              </span>
            )}
          </div>

          {/* Content (with NSFW overlay) */}
          {post.isNsfw && !nsfwRevealed ? (
            <div className="relative">
              <div className="blur-md select-none pointer-events-none">
                <h1 className="text-2xl font-display font-bold text-text-primary">{post.title}</h1>
                <RichContent html={post.content} />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-900/60 rounded-lg backdrop-blur-sm">
                <AlertTriangle className="w-10 h-10 text-neon-red mb-3" />
                <p className="text-base font-semibold text-text-primary mb-1">{tPosts('nsfw')}</p>
                <p className="text-sm text-text-muted mb-4">{tPosts('nsfwDesc')}</p>
                <button
                  type="button"
                  onClick={() => setNsfwRevealed(true)}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium bg-neon-red/15 text-neon-red rounded-lg hover:bg-neon-red/25 transition-colors"
                >
                  <Eye className="w-4 h-4" /> {tPosts('showContent')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Video player for CLIP posts */}
              {post.type === 'CLIP' && post.videoUrl && (
                <div className="space-y-2">
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-black">
                    {post.clipSource === 'YOUTUBE' && post.externalId ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${post.externalId}?autoplay=0&rel=0`}
                        className="w-full h-full"
                        allow="autoplay; encrypted-media; fullscreen"
                        allowFullScreen
                        style={{ border: 'none' }}
                      />
                    ) : post.clipSource === 'TWITCH' && post.externalId ? (
                      <iframe
                        src={`https://clips.twitch.tv/embed?clip=${post.externalId}&parent=xdtv.fans&autoplay=false`}
                        className="w-full h-full"
                        allow="autoplay; fullscreen"
                        allowFullScreen
                        style={{ border: 'none' }}
                      />
                    ) : (
                      <video
                        src={post.videoUrl}
                        poster={post.thumbnailUrl || undefined}
                        className="w-full h-full object-contain"
                        controls
                        playsInline
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-dimmed">
                    {post.clipSource && (
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        post.clipSource === 'YOUTUBE' ? 'text-red-400 bg-red-400/10' :
                        post.clipSource === 'TIKTOK' ? 'text-pink-400 bg-pink-400/10' :
                        post.clipSource === 'TWITCH' ? 'text-purple-400 bg-purple-400/10' :
                        post.clipSource === 'KICK' ? 'text-green-400 bg-green-400/10' :
                        'text-neon-cyan bg-neon-cyan/10'
                      }`}>{post.clipSource}</span>
                    )}
                    {post.duration && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {Math.floor(post.duration / 60)}:{(post.duration % 60).toString().padStart(2, '0')}</span>
                    )}
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {t('viewCount', { count: post.viewCount })}</span>
                  </div>
                </div>
              )}

              <h1 className="text-lg font-bold text-text-primary leading-snug">{post.title}</h1>
              {post.content && <div className="text-sm text-text-secondary"><RichContent html={post.content} /></div>}

              {/* Poll */}
              {post.type === 'POLL' && pollResults && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <BarChart3 className="w-3.5 h-3.5 text-neon-purple" />
                    <span>{tPosts('voteCount', { count: pollResults.totalVotes })}</span>
                    {post.poll?.endsAt && (
                      <span className="text-text-dimmed">
                        {new Date(post.poll.endsAt) > new Date() ? t('pollEndsIn', { time: formatDistanceToNow(new Date(post.poll.endsAt), { locale: dateLocale, addSuffix: true }) }) : t('pollEnded')}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {pollResults.options.map(opt => {
                      const hasVoted = pollResults.userVoteOptionId !== null;
                      const isMyVote = pollResults.userVoteOptionId === opt.id;
                      const isExpired = post.poll?.endsAt ? new Date(post.poll.endsAt) <= new Date() : false;
                      const showResults = hasVoted || isExpired || !user;
                      const canChange = hasVoted && !isExpired && user;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => (!showResults || canChange) && handlePollVote(opt.id)}
                          disabled={(!showResults ? false : !canChange) || votingOptionId !== null}
                          className={`relative w-full text-left rounded-lg border transition-all overflow-hidden ${
                            isMyVote
                              ? 'border-neon-purple/50 bg-neon-purple/5'
                              : showResults
                                ? canChange ? 'border-border-default bg-dark-800/30 hover:border-neon-purple/20 cursor-pointer' : 'border-border-default bg-dark-800/30'
                                : 'border-border-default bg-dark-800/30 hover:border-neon-purple/30 hover:bg-dark-800/50 cursor-pointer'
                          }`}
                        >
                          {showResults && (
                            <div
                              className={`absolute inset-0 rounded-lg transition-all ${isMyVote ? 'bg-neon-purple/15' : 'bg-dark-700/40'}`}
                              style={{ width: `${opt.percentage}%` }}
                            />
                          )}
                          <div className="relative flex items-center justify-between px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              {isMyVote && <Check className="w-3.5 h-3.5 text-neon-purple shrink-0" />}
                              <span className={`text-sm ${isMyVote ? 'text-neon-purple font-medium' : 'text-text-primary'}`}>{opt.text}</span>
                            </div>
                            {showResults && (
                              <span className={`text-xs font-medium shrink-0 ${isMyVote ? 'text-neon-purple' : 'text-text-muted'}`}>
                                {opt.percentage}%
                              </span>
                            )}
                            {votingOptionId === opt.id && (
                              <span className="text-xs text-text-dimmed animate-pulse">...</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {pollResults.userVoteOptionId && (
                    <p className="text-2xs text-text-dimmed">{t('votedHint')}</p>
                  )}
                </div>
              )}

              {/* Poll — fallback if results endpoint fails but poll data exists */}
              {post.type === 'POLL' && !pollResults && post.poll && (
                <div className="space-y-1.5">
                  {post.poll.options.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => handlePollVote(opt.id)}
                      disabled={votingOptionId !== null}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-border-default bg-dark-800/30 hover:border-neon-purple/30 hover:bg-dark-800/50 transition-all text-sm text-text-primary"
                    >
                      {opt.text}
                    </button>
                  ))}
                </div>
              )}

              {(() => {
                const allImages = post.images && post.images.length > 0
                  ? post.images.map((img) => img.url)
                  : post.imageUrl ? [post.imageUrl] : [];
                if (allImages.length === 0) return null;
                const src = allImages[imgIdx];
                const fullSrc = src.startsWith('/uploads') ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${src}` : src;
                return (
                  <>
                    <div
                      className="relative rounded-lg overflow-hidden max-h-[500px] border border-border-default cursor-zoom-in"
                      onClick={() => setLightbox(true)}
                    >
                      <Image src={fullSrc} alt={post.title} width={800} height={500} className="w-full object-cover" unoptimized />
                      {allImages.length > 1 && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); setImgIdx((p) => (p > 0 ? p - 1 : allImages.length - 1)); }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-dark-800/80 backdrop-blur-sm rounded-full text-text-muted hover:text-text-primary transition-colors"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setImgIdx((p) => (p < allImages.length - 1 ? p + 1 : 0)); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-dark-800/80 backdrop-blur-sm rounded-full text-text-muted hover:text-text-primary transition-colors"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-dark-800/80 backdrop-blur-sm rounded text-2xs text-text-muted">
                            {imgIdx + 1}/{allImages.length}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Fullscreen Lightbox */}
                    <ImageViewer
                      images={allImages.map(s => s.startsWith('/uploads') ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${s}` : s)}
                      initialIndex={imgIdx}
                      open={lightbox}
                      onClose={() => setLightbox(false)}
                    />
                  </>
                );
              })()}
            </>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-border-default">
            <div className="flex items-center gap-0.5 bg-dark-700 rounded-lg px-1">
              <button
                onClick={() => handlePostVote('up')}
                className={`p-1.5 transition-colors ${myVote === 'UP' ? 'text-neon-green' : 'text-text-muted hover:text-neon-green'}`}
              >
                <ArrowBigUp className={`w-5 h-5 ${myVote === 'UP' ? 'fill-current' : ''}`} />
              </button>
              <span className={`text-xs font-medium min-w-[20px] text-center ${myVote === 'UP' ? 'text-neon-green' : myVote === 'DOWN' ? 'text-neon-red' : 'text-text-secondary'}`}>
                {up - down}
              </span>
              <button
                onClick={() => handlePostVote('down')}
                className={`p-1.5 transition-colors ${myVote === 'DOWN' ? 'text-neon-red' : 'text-text-muted hover:text-neon-red'}`}
              >
                <ArrowBigDown className={`w-5 h-5 ${myVote === 'DOWN' ? 'fill-current' : ''}`} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-text-muted">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="text-xs">{post.commentCount} {t('commentsCount')}</span>
            </div>

            {/* Share */}
            <button
              onClick={handleShare}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${shared ? 'text-neon-green bg-neon-green/10' : 'text-text-muted hover:text-text-primary hover:bg-dark-700'}`}
            >
              {shared ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="text-xs">{shared ? tPosts('copied') : tPosts('share')}</span>
            </button>

            {/* Emoji reactions */}
            <EmojiReactions reactions={reactions} onReact={handleReact} streamerProfileId={post.streamerProfile?.id} />

            {user && user.id !== post.author.id && (
              <div className="ml-auto">
                <ReportButton targetType="POST" targetId={post.id} />
              </div>
            )}
          </div>
        </motion.article>

        {/* Blok reklamowy: między treścią a komentarzami. Czytelnik, który
            doszedł tak daleko, jest najbardziej zaangażowany na całej
            stronie — a przerwa między czytaniem a dyskusją to naturalne
            miejsce na przerwę, nie wcięcie w środek zdania. */}
        <AdSlot slotKey="post-detail" className="my-3 flex justify-center empty:hidden" />

        {/* AMA Questions section */}
        {post.type === 'AMA' && post.amaSession && (
          <AmaSection postId={post.id} postAuthorId={post.author.id} />
        )}

        {/* New comment form */}
        {user ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-900 border border-border-default rounded-lg p-3"
          >
            <div className="flex gap-2.5">
              <Avatar src={user.avatarUrl} name={user.displayName || user.username} size="xs" />
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder={t('commentPlaceholder')}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAddComment}
                    disabled={submitting || !newComment.trim()}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {t('submitComment')}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="bg-dark-900 border border-border-default rounded-lg p-3 text-center">
            <p className="text-text-muted text-xs">
              <button onClick={() => router.push('/login')} className="text-neon-cyan hover:underline">
                {t('loginToComment')}
              </button>
              {' '}{t('toAddComment')}
            </p>
          </div>
        )}

        {/* Comments */}
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-neon-cyan" />
              {t('commentsHeader', { count: post.commentCount })}
            </h2>
            <div className="flex items-center gap-1 bg-dark-700 rounded-lg p-0.5">
              {(['best', 'new', 'controversial'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleSortChange(s)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    commentSort === s
                      ? 'bg-dark-600 text-text-primary font-medium'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {s === 'best' ? t('sortBest') : s === 'new' ? t('sortNew') : t('sortControversial')}
                </button>
              ))}
            </div>
          </div>

          {comments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-muted text-sm">{t('noComments')}</p>
              <p className="text-text-dimmed text-xs mt-1">{t('beFirst')}</p>
            </div>
          ) : (
            <AnimatePresence>
              {comments.map((comment) => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  currentUserId={user?.id}
                  sort={commentSort}
                  onReply={handleReply}
                  onDelete={handleDelete}
                  onVote={handleVote}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
