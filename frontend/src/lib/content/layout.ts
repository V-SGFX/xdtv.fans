import type { ContentItem } from './types';
import type { TileSpan } from '@/components/content/content-tile';

/**
 * Span assignment for the content wall.
 *
 * ── Why not `grid-auto-flow: dense` ──────────────────────────────────────
 *
 * The plan called for dense packing, and building it surfaced a problem the
 * audit had not: dense solves *gaps*, but the gaps here come from mixing tile
 * widths, and mixing widths is exactly what creates them.
 *
 * Every tile is 16:9 plus a fixed body, so height is a function of width. At a
 * 1400px wall a quarter-width tile is ~263px tall and a half-width tile ~460px.
 * Put both in one row and the short one leaves ~200px of dead space beneath it
 * — the "gigantic empty space" the brief explicitly rules out. Dense would then
 * backfill that hole with a *later* item, which reorders the feed visually
 * relative to the DOM. That is the same defect that made CSS-columns masonry
 * the wrong choice: reading order stops matching visual order, which hurts
 * keyboard and screen-reader users and makes ranking meaningless.
 *
 * So spans are assigned a row at a time, and every row is homogeneous: four
 * quarter tiles, or two half tiles, or one full-width hero. Rows can only ever
 * be complete or trailing, never ragged, so no packing heuristic is needed and
 * DOM order always equals visual order.
 *
 * ── Rhythm ───────────────────────────────────────────────────────────────
 *
 * Variation comes from the row pattern rather than from per-tile randomness.
 * The cycle is deterministic and index-based — no Math.random(), so the server
 * and the client agree and infinite scroll stays stable as pages append.
 */

type RowKind = 'hero' | 'half' | 'quarter';

/** Items per row at the widest breakpoint. */
const ROW_CAPACITY: Record<RowKind, number> = {
  hero: 1,
  half: 2,
  quarter: 4,
};

const ROW_SPAN: Record<RowKind, TileSpan> = {
  hero: 'hero',
  half: 'wide',
  quarter: 'narrow',
};

/**
 * One cycle covers 15 items: a hero, then alternating bands of half and
 * quarter rows. Clip-heavy input therefore reads as mostly large tiles, which
 * is the intent — the corpus is 16.7k clips and the wall should look like it.
 */
const PATTERN: RowKind[] = ['hero', 'half', 'quarter', 'half', 'quarter', 'half'];

/** Kinds that earn a full-width hero. Articles and posts never do. */
function canHero(item: ContentItem): boolean {
  return item.kind === 'clip' || item.kind === 'live';
}

/** Kinds that read well at half width. Articles need their title lines. */
function canHalf(item: ContentItem): boolean {
  return item.kind === 'clip' || item.kind === 'live';
}

export interface LaidOutItem {
  item: ContentItem;
  span: TileSpan;
  /** First screen only — drives priority image loading for LCP. */
  priority: boolean;
}

/**
 * Assign a span to every item, row by row.
 *
 * Pure and deterministic: the same list always produces the same layout, and
 * appending a page never changes the spans already assigned to earlier items.
 */
export function assignLayout(items: ContentItem[]): LaidOutItem[] {
  const out: LaidOutItem[] = [];
  let i = 0;
  let row = 0;

  while (i < items.length) {
    let kind = PATTERN[row % PATTERN.length];

    // Demote a row whose lead item does not suit the size. An article is never
    // given a hero row just because the pattern landed there.
    if (kind === 'hero' && !canHero(items[i])) kind = 'half';
    if (kind === 'half' && !canHalf(items[i])) kind = 'quarter';

    const capacity = ROW_CAPACITY[kind];
    const span = ROW_SPAN[kind];

    for (let n = 0; n < capacity && i < items.length; n++, i++) {
      out.push({
        item: items[i],
        span,
        // The first row is above the fold on every breakpoint.
        priority: row === 0,
      });
    }

    row++;
  }

  return out;
}

/**
 * Skeleton shape for the initial load.
 *
 * Mirrors the same pattern so the placeholder grid has the geometry of the
 * content that replaces it, rather than a uniform block that visibly reflows.
 */
export function skeletonLayout(count: number): { span: TileSpan; kind: ContentItem['kind'] }[] {
  const out: { span: TileSpan; kind: ContentItem['kind'] }[] = [];
  let i = 0;
  let row = 0;

  while (i < count) {
    const kind = PATTERN[row % PATTERN.length];
    const capacity = ROW_CAPACITY[kind];
    const span = ROW_SPAN[kind];

    for (let n = 0; n < capacity && i < count; n++, i++) {
      out.push({ span, kind: span === 'narrow' ? 'post' : 'clip' });
    }
    row++;
  }

  return out;
}
