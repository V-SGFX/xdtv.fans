import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { XpService } from '../engagement/xp.service';
import { StreakService } from '../engagement/streak.service';
import { Prisma } from '@prisma/client';

function sanitize(str: string): string {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const MAX_DEPTH = 10;
const AUTHOR_SELECT = { id: true, username: true, displayName: true, avatarUrl: true, role: true };

type SortMode = 'best' | 'new' | 'controversial';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private xpService: XpService,
    private streakService: StreakService,
  ) {}

  // ─── Wilson score lower bound (Reddit "best" sort) ────
  private wilsonScore(up: number, down: number): number {
    const n = up + down;
    if (n === 0) return 0;
    const z = 1.96;
    const phat = up / n;
    return (phat + z * z / (2 * n) - z * Math.sqrt((phat * (1 - phat) + z * z / (4 * n)) / n)) / (1 + z * z / n);
  }

  private getOrderBy(sort: SortMode): Prisma.CommentOrderByWithRelationInput[] {
    switch (sort) {
      case 'new':
        return [{ createdAt: 'desc' }];
      case 'controversial':
        return [{ upvotes: 'desc' }];
      case 'best':
      default:
        return [{ upvotes: 'desc' }, { createdAt: 'desc' }];
    }
  }

  private sortComments(comments: any[], sort: SortMode): any[] {
    if (sort === 'best') {
      return comments.sort((a, b) => this.wilsonScore(b.upvotes, b.downvotes) - this.wilsonScore(a.upvotes, a.downvotes));
    }
    if (sort === 'controversial') {
      return comments.sort((a, b) => {
        const aTotal = a.upvotes + a.downvotes;
        const bTotal = b.upvotes + b.downvotes;
        if (aTotal === 0 && bTotal === 0) return 0;
        const aRatio = aTotal > 0 ? Math.min(a.upvotes, a.downvotes) / Math.max(a.upvotes, a.downvotes) * aTotal : 0;
        const bRatio = bTotal > 0 ? Math.min(b.upvotes, b.downvotes) / Math.max(b.upvotes, b.downvotes) * bTotal : 0;
        return bRatio - aRatio;
      });
    }
    return comments;
  }

  private attachUserVotes(comments: any[], votesMap: Map<number, string>): any[] {
    return comments.map(c => ({
      ...c,
      userVote: votesMap.get(c.id) || null,
      replies: c.replies ? this.attachUserVotes(c.replies, votesMap) : [],
    }));
  }

  private collectCommentIds(comments: any[]): number[] {
    const ids: number[] = [];
    for (const c of comments) {
      ids.push(c.id);
      if (c.replies) ids.push(...this.collectCommentIds(c.replies));
    }
    return ids;
  }

  // ─── FIND COMMENTS BY POST (threaded, sorted) ─────────

  async findByPost(postId: number, page: number, limit: number, sort: SortMode = 'best', userId?: number) {
    return this.findByTarget({ postId, isDeleted: false, parentId: null }, page, limit, sort, userId);
  }

  /**
   * Shared reader for a comment thread, whatever it hangs off.
   *
   * findByPost and findByNews differ only in the where clause; duplicating
   * sixty lines of nested include and vote hydration for the second target
   * is exactly how two code paths drift apart.
   */
  private async findByTarget(
    where: Record<string, unknown>,
    page: number,
    limit: number,
    sort: SortMode = 'best',
    userId?: number,
  ) {
    const skip = (page - 1) * limit;

    const [rootComments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.getOrderBy(sort),
        include: {
          author: { select: AUTHOR_SELECT },
          _count: { select: { replies: true } },
          replies: {
            where: { isDeleted: false },
            take: 3,
            orderBy: sort === 'new' ? { createdAt: 'desc' } : { upvotes: 'desc' },
            include: {
              author: { select: AUTHOR_SELECT },
              _count: { select: { replies: true } },
              replies: {
                where: { isDeleted: false },
                take: 2,
                orderBy: sort === 'new' ? { createdAt: 'desc' } : { upvotes: 'desc' },
                include: {
                  author: { select: AUTHOR_SELECT },
                  _count: { select: { replies: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);

    const transform = (comments: any[]): any[] =>
      this.sortComments(comments, sort).map(c => ({
        ...c,
        replyCount: c._count?.replies ?? 0,
        _count: undefined,
        replies: c.replies ? transform(c.replies) : [],
      }));

    let result = transform(rootComments);

    if (userId) {
      const allIds = this.collectCommentIds(result);
      if (allIds.length > 0) {
        const votes = await this.prisma.vote.findMany({
          where: { userId, commentId: { in: allIds } },
          select: { commentId: true, type: true },
        });
        const votesMap = new Map(votes.map(v => [v.commentId!, v.type]));
        result = this.attachUserVotes(result, votesMap);
      }
    }

    return { data: result, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  // ─── GET REPLIES FOR A COMMENT ─────────────────────────

  /** Top-level comments on a news article. Same shape as findByPost. */
  async findByNews(newsId: number, page: number, limit: number, sort: SortMode = 'best', userId?: number) {
    return this.findByTarget({ newsId, isDeleted: false, parentId: null }, page, limit, sort, userId);
  }

  async getReplies(commentId: number, page: number, limit: number, sort: SortMode = 'best', userId?: number) {
    const parent = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!parent) throw new NotFoundException('Comment not found');

    const skip = (page - 1) * limit;
    const where = { parentId: commentId, isDeleted: false };

    const [replies, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.getOrderBy(sort),
        include: {
          author: { select: AUTHOR_SELECT },
          _count: { select: { replies: true } },
          replies: {
            where: { isDeleted: false },
            take: 2,
            orderBy: sort === 'new' ? { createdAt: 'desc' } : { upvotes: 'desc' },
            include: {
              author: { select: AUTHOR_SELECT },
              _count: { select: { replies: true } },
            },
          },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);

    const transform = (comments: any[]): any[] =>
      this.sortComments(comments, sort).map(c => ({
        ...c,
        replyCount: c._count?.replies ?? 0,
        _count: undefined,
        replies: c.replies ? transform(c.replies) : [],
      }));

    let result = transform(replies);

    if (userId) {
      const allIds = this.collectCommentIds(result);
      if (allIds.length > 0) {
        const votes = await this.prisma.vote.findMany({
          where: { userId, commentId: { in: allIds } },
          select: { commentId: true, type: true },
        });
        const votesMap = new Map(votes.map(v => [v.commentId!, v.type]));
        result = this.attachUserVotes(result, votesMap);
      }
    }

    return { data: result, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  // ─── GET USER VOTES BATCH ─────────────────────────────

  async getUserVotes(userId: number, commentIds: number[]) {
    if (commentIds.length === 0) return {};
    const votes = await this.prisma.vote.findMany({
      where: { userId, commentId: { in: commentIds } },
      select: { commentId: true, type: true },
    });
    const map: Record<number, string> = {};
    votes.forEach(v => { if (v.commentId) map[v.commentId] = v.type; });
    return map;
  }

  // ─── CREATE COMMENT ───────────────────────────────────

  /**
   * Create a comment on a post or on a news article.
   *
   * Exactly one target. Articles have no author on this platform, so the
   * "someone commented on your post" notification only fires for posts —
   * replies still notify in both cases, because that is a person.
   */
  async create(
    userId: number,
    data: { postId?: number; newsId?: number; content: string; parentId?: number },
  ) {
    if (!data.content?.trim()) {
      throw new BadRequestException('Content is required');
    }
    if (!data.postId && !data.newsId) {
      throw new BadRequestException('postId or newsId is required');
    }

    const post = data.postId
      ? await this.prisma.post.findFirst({ where: { id: data.postId, isDeleted: false } })
      : null;
    if (data.postId && !post) throw new NotFoundException('Post not found');

    const article = data.newsId
      ? await this.prisma.news.findFirst({ where: { id: data.newsId, isPublished: true } })
      : null;
    if (data.newsId && !article) throw new NotFoundException('Article not found');

    let parentComment: any = null;
    let depth = 0;
    let parentPath = '';

    if (data.parentId) {
      parentComment = await this.prisma.comment.findFirst({ where: { id: data.parentId, isDeleted: false } });
      if (!parentComment) throw new NotFoundException('Parent comment not found');
      depth = Math.min((parentComment.depth || 0) + 1, MAX_DEPTH);
      parentPath = parentComment.path || String(parentComment.id);
    }

    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: {
          content: sanitize(data.content.trim()),
          postId: data.postId ?? null,
          newsId: data.newsId ?? null,
          authorId: userId,
          parentId: data.parentId || null,
          depth,
          path: '',
        },
        include: {
          author: { select: AUTHOR_SELECT },
        },
      }),
      ...(data.postId
        ? [this.prisma.post.update({ where: { id: data.postId }, data: { commentCount: { increment: 1 } } })]
        : []),
      ...(data.newsId
        ? [this.prisma.news.update({ where: { id: data.newsId }, data: { commentCount: { increment: 1 } } })]
        : []),
    ]);

    // Update path with the comment's own ID
    const path = parentPath ? `${parentPath}.${comment.id}` : String(comment.id);
    await this.prisma.comment.update({
      where: { id: comment.id },
      data: { path },
    });

    // Notify
    const actorName = comment.author.displayName || comment.author.username;
    if (parentComment) {
      this.notifications.create({
        userId: parentComment.authorId,
        actorId: userId,
        type: 'REPLY_TO_COMMENT',
        postId: data.postId,
        commentId: comment.id,
        message: `${actorName} odpowiedział na Twój komentarz`,
      }).catch(() => {});
    } else if (post) {
      this.notifications.create({
        userId: post.authorId,
        actorId: userId,
        type: 'COMMENT_ON_POST',
        postId: data.postId,
        commentId: comment.id,
        message: `${actorName} skomentował Twój post "${post.title.slice(0, 50)}"`,
      }).catch(() => {});
    }

    this.xpService.awardXp(userId, 'COMMENT', undefined, { postId: data.postId, commentId: comment.id }).catch(() => {});
    this.streakService.recordDailyActivity(userId).catch(() => {});
    this.streakService.completeChallenge(userId, 'CREATE_COMMENT').catch(() => {});

    return { ...comment, path, depth, replyCount: 0, replies: [] };
  }

  async update(id: number, userId: number, userRole: string, data: { content: string }) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.isDeleted) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId && !['ADMIN', 'MODERATOR'].includes(userRole)) {
      throw new ForbiddenException();
    }

    return this.prisma.comment.update({
      where: { id },
      data: { content: sanitize(data.content.trim()) },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  async remove(id: number, userId: number, userRole: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.isDeleted) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId && !['ADMIN', 'MODERATOR'].includes(userRole)) {
      throw new ForbiddenException();
    }

    // A comment hangs off a post or off a news article; decrement whichever
    // counter it actually belongs to.
    await this.prisma.$transaction([
      this.prisma.comment.update({ where: { id }, data: { isDeleted: true, content: '[usunięty]' } }),
      ...(comment.postId
        ? [this.prisma.post.update({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 } } })]
        : []),
      ...(comment.newsId
        ? [this.prisma.news.update({ where: { id: comment.newsId }, data: { commentCount: { decrement: 1 } } })]
        : []),
    ]);
  }

  async vote(commentId: number, userId: number, direction: 'up' | 'down') {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.isDeleted) throw new NotFoundException('Comment not found');
    if (comment.authorId === userId) throw new BadRequestException('Nie możesz głosować na własny komentarz');

    const existing = await this.prisma.vote.findUnique({
      where: { userId_commentId: { userId, commentId } },
    });

    const voteType = direction === 'up' ? 'UP' : 'DOWN';

    if (existing) {
      if (existing.type === voteType) {
        await this.prisma.$transaction([
          this.prisma.vote.delete({ where: { id: existing.id } }),
          this.prisma.comment.update({
            where: { id: commentId },
            data: voteType === 'UP' ? { upvotes: { decrement: 1 } } : { downvotes: { decrement: 1 } },
          }),
        ]);
        const updated = await this.prisma.comment.findUnique({ where: { id: commentId }, select: { upvotes: true, downvotes: true } });
        return { vote: null, upvotes: updated!.upvotes, downvotes: updated!.downvotes };
      } else {
        await this.prisma.$transaction([
          this.prisma.vote.update({ where: { id: existing.id }, data: { type: voteType } }),
          this.prisma.comment.update({
            where: { id: commentId },
            data: voteType === 'UP'
              ? { upvotes: { increment: 1 }, downvotes: { decrement: 1 } }
              : { upvotes: { decrement: 1 }, downvotes: { increment: 1 } },
          }),
        ]);
        const updated = await this.prisma.comment.findUnique({ where: { id: commentId }, select: { upvotes: true, downvotes: true } });
        return { vote: voteType, upvotes: updated!.upvotes, downvotes: updated!.downvotes };
      }
    }

    await this.prisma.$transaction([
      this.prisma.vote.create({ data: { userId, commentId, type: voteType } }),
      this.prisma.comment.update({
        where: { id: commentId },
        data: voteType === 'UP' ? { upvotes: { increment: 1 } } : { downvotes: { increment: 1 } },
      }),
    ]);
    const updated = await this.prisma.comment.findUnique({ where: { id: commentId }, select: { upvotes: true, downvotes: true } });
    return { vote: voteType, upvotes: updated!.upvotes, downvotes: updated!.downvotes };
  }
}
