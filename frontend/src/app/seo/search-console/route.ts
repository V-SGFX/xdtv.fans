import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

const DEFAULT_SITE_URL = 'https://xdtv.fans/';

type SeoBucket = 'home' | 'community' | 'clips';

type BucketConfig = {
  key: SeoBucket;
  pathRegex: string;
};

const BUCKETS: BucketConfig[] = [
  { key: 'home', pathRegex: '^https://xdtv\\.fans/?$' },
  { key: 'community', pathRegex: '^https://xdtv\\.fans/community($|[/?].*)' },
  { key: 'clips', pathRegex: '^https://xdtv\\.fans/clips($|[/?].*)' },
];

function getDateRange(daysBack: number) {
  const end = new Date();
  end.setDate(end.getDate() - 1);

  const start = new Date(end);
  start.setDate(start.getDate() - (daysBack - 1));

  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: toIso(start), endDate: toIso(end) };
}

function parseDays(req: NextRequest): number {
  const raw = Number(req.nextUrl.searchParams.get('days') || '28');
  if (!Number.isFinite(raw)) return 28;
  if (raw < 7) return 7;
  if (raw > 90) return 90;
  return Math.floor(raw);
}

function parseRows(req: NextRequest): number {
  const raw = Number(req.nextUrl.searchParams.get('rows') || '25');
  if (!Number.isFinite(raw)) return 25;
  if (raw < 5) return 5;
  if (raw > 100) return 100;
  return Math.floor(raw);
}

function getPrivateKey(): string {
  const raw = process.env.GSC_PRIVATE_KEY || '';
  return raw.replace(/\\n/g, '\n').trim();
}

function isAuthorized(req: NextRequest): boolean {
  const required = process.env.SEO_METRICS_API_KEY;
  if (!required) return true;
  const provided = req.headers.get('x-seo-key') || '';
  return provided === required;
}

async function querySummary(
  searchconsole: ReturnType<typeof google.searchconsole>,
  siteUrl: string,
  startDate: string,
  endDate: string,
  regex: string,
) {
  const { data } = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: 25000,
      dimensionFilterGroups: [
        {
          filters: [
            {
              dimension: 'page',
              operator: 'includingRegex',
              expression: regex,
            },
          ],
        },
      ],
    },
  });

  const rows = data.rows || [];
  const clicks = rows.reduce((acc, r) => acc + (r.clicks || 0), 0);
  const impressions = rows.reduce((acc, r) => acc + (r.impressions || 0), 0);
  const weightedPositionSum = rows.reduce((acc, r) => acc + ((r.position || 0) * (r.impressions || 0)), 0);

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    avgPosition: impressions > 0 ? weightedPositionSum / impressions : null,
  };
}

async function queryTopQueries(
  searchconsole: ReturnType<typeof google.searchconsole>,
  siteUrl: string,
  startDate: string,
  endDate: string,
  regex: string,
  rowLimit: number,
) {
  const { data } = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit,
      dimensionFilterGroups: [
        {
          filters: [
            {
              dimension: 'page',
              operator: 'includingRegex',
              expression: regex,
            },
          ],
        },
      ],
    },
  });

  return (data.rows || []).map((row) => ({
    query: row.keys?.[0] || '(unknown)',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || null,
  }));
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const clientEmail = process.env.GSC_CLIENT_EMAIL || '';
  const privateKey = getPrivateKey();
  const siteUrl = process.env.GSC_SITE_URL || DEFAULT_SITE_URL;

  if (!clientEmail || !privateKey) {
    return NextResponse.json(
      {
        ok: false,
        error: 'missing_credentials',
        requiredEnv: ['GSC_CLIENT_EMAIL', 'GSC_PRIVATE_KEY'],
      },
      { status: 500 },
    );
  }

  const days = parseDays(req);
  const rows = parseRows(req);
  const { startDate, endDate } = getDateRange(days);

  try {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });

    const metrics: Record<SeoBucket, any> = {
      home: null,
      community: null,
      clips: null,
    };

    for (const bucket of BUCKETS) {
      const summary = await querySummary(searchconsole, siteUrl, startDate, endDate, bucket.pathRegex);
      const topQueries = await queryTopQueries(searchconsole, siteUrl, startDate, endDate, bucket.pathRegex, rows);
      metrics[bucket.key] = {
        ...summary,
        topQueries,
      };
    }

    return NextResponse.json({
      ok: true,
      siteUrl,
      window: { days, startDate, endDate },
      metrics,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'gsc_query_failed',
        message: error?.message || 'Unknown Search Console error',
      },
      { status: 500 },
    );
  }
}
