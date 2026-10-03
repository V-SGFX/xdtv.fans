import { Module } from '@nestjs/common';
import { PrometheusModule as PromModule } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import {
  SteamSyncCounterProvider,
  ProtonDbSyncCounterProvider,
  SteamGamesGaugeProvider,
  QueueJobsGaugeProvider,
  SyncDurationHistogramProvider,
} from './metrics.service';

@Module({
  imports: [
    PromModule.register({
      defaultMetrics: {
        enabled: true,
      },
      path: '/metrics',
      defaultLabels: {
        app: 'xdtv-backend',
      },
    }),
  ],
  providers: [
    MetricsService,
    SteamSyncCounterProvider,
    ProtonDbSyncCounterProvider,
    SteamGamesGaugeProvider,
    QueueJobsGaugeProvider,
    SyncDurationHistogramProvider,
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
