import { Injectable, Inject } from '@nestjs/common';
import { makeCounterProvider, makeGaugeProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram } from 'prom-client';

// Counters
export const SteamSyncCounterProvider = makeCounterProvider({
  name: 'steam_sync_total',
  help: 'Total number of Steam sync operations',
  labelNames: ['source', 'status'],
});

export const ProtonDbSyncCounterProvider = makeCounterProvider({
  name: 'protondb_sync_total',
  help: 'Total number of ProtonDB sync operations',
  labelNames: ['status'],
});

// Gauges
export const SteamGamesGaugeProvider = makeGaugeProvider({
  name: 'steam_games_total',
  help: 'Total number of Steam games in database',
});

export const QueueJobsGaugeProvider = makeGaugeProvider({
  name: 'queue_jobs',
  help: 'Number of jobs in queue',
  labelNames: ['queue', 'status'],
});

// Histograms
export const SyncDurationHistogramProvider = makeHistogramProvider({
  name: 'steam_sync_duration_seconds',
  help: 'Duration of Steam sync operations',
  labelNames: ['source'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
});

@Injectable()
export class MetricsService {
  constructor(
    @Inject('steam_sync_total') private readonly steamSyncCounter: Counter<string>,
    @Inject('protondb_sync_total') private readonly protonDbSyncCounter: Counter<string>,
    @Inject('steam_games_total') private readonly steamGamesGauge: Gauge<string>,
    @Inject('queue_jobs') private readonly queueJobsGauge: Gauge<string>,
    @Inject('steam_sync_duration_seconds') private readonly syncDurationHistogram: Histogram<string>,
  ) {}

  incrementSteamSync(source: string, status: string) {
    this.steamSyncCounter.inc({ source, status });
  }

  incrementProtonDbSync(status: string) {
    this.protonDbSyncCounter.inc({ status });
  }

  setSteamGamesCount(count: number) {
    this.steamGamesGauge.set(count);
  }

  setQueueJobs(queue: string, status: string, count: number) {
    this.queueJobsGauge.set({ queue, status }, count);
  }

  recordSyncDuration(source: string, durationSeconds: number) {
    this.syncDurationHistogram.observe({ source }, durationSeconds);
  }
}
