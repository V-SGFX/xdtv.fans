import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

type ClickEvent = {
  ts: string;
  source: string;
  variant: string;
  ip?: string;
  ua?: string;
};

const LOG_FILE = process.env.GROWTH_CLIPS_CLICK_LOG || path.join(/*turbopackIgnore: true*/ process.cwd(), 'logs', 'clips-clicks.ndjson');

function clampHours(value: number): number {
  if (!Number.isFinite(value)) return 24;
  if (value < 1) return 1;
  if (value > 168) return 168;
  return Math.floor(value);
}

async function appendClick(event: ClickEvent): Promise<void> {
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  await fs.appendFile(LOG_FILE, `${JSON.stringify(event)}\n`, 'utf8');
}

async function readClicks(): Promise<ClickEvent[]> {
  try {
    const raw = await fs.readFile(LOG_FILE, 'utf8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as ClickEvent;
        } catch {
          return null;
        }
      })
      .filter((item): item is ClickEvent => Boolean(item));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const source = String(body?.source || '').trim().slice(0, 64);
    const variant = String(body?.variant || 'A4').trim().slice(0, 32) || 'A4';

    if (!source) {
      return NextResponse.json({ ok: false, error: 'source_required' }, { status: 400 });
    }

    const event: ClickEvent = {
      ts: new Date().toISOString(),
      source,
      variant,
      ip: (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || undefined,
      ua: (req.headers.get('user-agent') || '').slice(0, 180) || undefined,
    };

    await appendClick(event);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'write_failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const hours = clampHours(Number(req.nextUrl.searchParams.get('hours') || '24'));
  const since = Date.now() - hours * 60 * 60 * 1000;

  const all = await readClicks();
  const recent = all.filter((event) => {
    const ts = new Date(event.ts).getTime();
    return Number.isFinite(ts) && ts >= since;
  });

  const bySource: Record<string, number> = {};
  const byVariant: Record<string, number> = {};

  recent.forEach((event) => {
    bySource[event.source] = (bySource[event.source] || 0) + 1;
    byVariant[event.variant] = (byVariant[event.variant] || 0) + 1;
  });

  return NextResponse.json({
    ok: true,
    windowHours: hours,
    totalClicks: recent.length,
    bySource,
    byVariant,
  });
}
