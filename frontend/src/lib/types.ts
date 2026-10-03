export interface User {
  id: number;
  email?: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'USER' | 'STREAMER' | 'MODERATOR' | 'ADMIN';
  createdAt: string;
}

export interface StreamerProfile {
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
  isClaimed: boolean;
  isVerified: boolean;
  isLive: boolean;
  chatEnabled?: boolean;
  userId?: number | null;
  viewCount: number;
  followerCount: number;
  channels?: Channel[];
  _count?: { follows: number; posts: number };
}

export interface Post {
  id: number;
  title: string;
  content: string;
  type: 'TEXT' | 'LINK' | 'IMAGE' | 'VIDEO' | 'CLIP' | 'POLL' | 'AMA';
  isOfficial: boolean;
  isNsfw: boolean;
  isFlagged: boolean;
  imageUrl: string | null;
  linkUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  clipSource: 'UPLOAD' | 'YOUTUBE' | 'TIKTOK' | 'TWITCH' | 'KICK' | null;
  externalId: string | null;
  duration: number | null;
  viewCount: number;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  isPinned: boolean;
  createdAt: string;
  author: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'> & { role?: string };
  streamerProfile: Pick<StreamerProfile, 'id' | 'slug' | 'name' | 'avatarUrl'> & { isLive?: boolean } | null;
  community?: Pick<Community, 'id' | 'slug' | 'name' | 'iconUrl' | 'color'> | null;
  tags?: Tag[];
  images?: { id: number; url: string; order: number }[];
  amaSession?: { id: number; endsAt: string; isOpen: boolean; _count: { questions: number } } | null;
  poll?: {
    id: number;
    endsAt: string | null;
    options: { id: number; text: string; order: number; voteCount: number }[];
  } | null;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  postCount: number;
}

export interface Channel {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  type: 'PUBLIC' | 'PRIVATE' | 'PREMIUM';
  isActive: boolean;
  streamerProfileId: number;
  _count?: { messages: number };
}

export interface Community {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  color: string | null;
  isOfficial: boolean;
  postCount: number;
  memberCount: number;
  createdById: number;
  createdAt: string;
  isJoined: boolean;
  createdBy?: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  moderators?: { id: number; user: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'> }[];
  _count?: { posts: number; moderators: number; bans?: number };
}

export interface Message {
  id: number;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  author: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'> & { role: string };
}

export interface News {
  id: number;
  title: string;
  summary: string | null;
  content: string | null;
  sourceUrl: string;
  source: 'RSS' | 'SCRAPER' | 'MANUAL';
  sourceName: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  streamerProfile: Pick<StreamerProfile, 'id' | 'slug' | 'name'> | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; pages: number };
}

export interface Comment {
  id: number;
  postId: number;
  content: string;
  upvotes: number;
  downvotes: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  author: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'> & { role: string };
  parentId: number | null;
  depth?: number;
  path?: string;
  replyCount?: number;
  userVote?: 'UP' | 'DOWN' | null;
  replies?: Comment[];
}

export interface PlatformStats {
  usersTotal: number;
  activeUsers: number;
  messagesToday: number;
  postsToday: number;
  newUsersToday: number;
  activeSubscriptions: number;
  streamersTotal: number;
  channelsTotal: number;
  newsTotal: number;
}

export interface Battle {
  id: number;
  title: string | null;
  status: 'ACTIVE' | 'FINISHED';
  votes1: number;
  votes2: number;
  endsAt: string;
  createdAt: string;
  streamer1: Pick<StreamerProfile, 'id' | 'slug' | 'name' | 'avatarUrl'>;
  streamer2: Pick<StreamerProfile, 'id' | 'slug' | 'name' | 'avatarUrl'>;
}

export interface RankedStreamer {
  id: number;
  slug: string;
  name: string;
  avatarUrl: string | null;
  followerCount: number;
  _count: { posts: number };
}
