import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any --
 * Klient undernetu jest generowany do katalogu poza standardową ścieżką
 * `@prisma/client`, więc TypeScript nie zna jego typów w czasie kompilacji.
 * Deklarowanie ich ręcznie byłoby zgadywaniem kształtu wygenerowanego kodu.
 */

/**
 * Połączenie z bazą UNDERNET.ONE — wyłącznie na potrzeby wspólnego panelu.
 *
 * To NIE jest most między serwisami. Backend xdtv nie czyta stąd niczego
 * do własnych widoków; ten klient żyje tylko po to, żeby AdminJS umiał
 * pokazać drugą sekcję. Użytkownicy, sesje i treści obu serwisów zostają
 * w swoich bazach.
 *
 * Bez adresu bazy w środowisku klient się nie tworzy, a sekcja UNDERNET.ONE
 * po prostu nie pojawia się w panelu — panel xdtv ma działać niezależnie
 * od tego, czy undernet akurat istnieje.
 */
@Injectable()
export class UndernetPrismaService implements OnModuleDestroy {
  private readonly logger = new Logger(UndernetPrismaService.name);
  /** Instancja klienta albo null, gdy brak konfiguracji. */
  readonly client: any = null;
  /** Moduł klienta — potrzebny adapterowi AdminJS do odczytu schematu. */
  readonly module: any = null;

  constructor(config: ConfigService) {
    const url = config.get<string>('UNDERNET_DATABASE_URL');
    if (!url) {
      this.logger.log('Brak UNDERNET_DATABASE_URL — sekcja UNDERNET.ONE wyłączona.');
      return;
    }

    try {
      const mod = require('.prisma/client-undernet');
      this.module = mod;
      this.client = new mod.PrismaClient({ datasources: { db: { url } } });
      this.logger.log('Klient bazy UNDERNET.ONE gotowy.');
    } catch (error) {
      // Brak wygenerowanego klienta nie może zdjąć panelu xdtv.
      this.logger.error(`Nie udało się wczytać klienta undernetu: ${String(error)}`);
    }
  }

  get isAvailable(): boolean {
    return Boolean(this.client && this.module);
  }

  async onModuleDestroy() {
    await this.client?.$disconnect?.();
  }
}
