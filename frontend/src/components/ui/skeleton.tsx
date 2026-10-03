interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/**
 * Loading placeholders must match the geometry of what replaces them, or the
 * layout jumps on load. The content corpus is ~99% 16:9 (Twitch clip
 * thumbnails are 480x272, stream thumbnails 440x248), so every content
 * skeleton below leads with an aspect-video block.
 *
 * Each is wrapped in a role="status" region by the caller (see ContentWall),
 * not here — one announcement per loading region, not one per tile.
 */

/** Clip / Live tile: 16:9 media, one-line title, author row. */
export function ContentTileSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface-raised">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-2 p-2.5">
        <Skeleton className="h-3.5 w-4/5" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

/** Article tile: 16:9 image, two-line title (median 87 chars), source row. */
export function ArticleTileSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface-raised">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-2 p-2.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/** Text-post tile: no media, title plus body lines. */
export function PostTileSkeleton() {
  return (
    <div className="space-y-2.5 rounded-lg border border-line bg-surface-raised p-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function StreamerCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface-raised">
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="-mt-5 space-y-3 px-4 pb-4">
        <div className="flex items-end gap-3">
          <Skeleton className="ring-surface-raised h-14 w-14 shrink-0 rounded-full ring-4" />
          <div className="flex-1 space-y-1.5 pb-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Retained: existing screens still import this name. */
export function PostCardSkeleton() {
  return <PostTileSkeleton />;
}

export function ChatMessageSkeleton() {
  return (
    <div className="flex gap-3 p-2">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full max-w-xs" />
      </div>
    </div>
  );
}
