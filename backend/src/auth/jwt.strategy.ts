import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Jak długo konto uchodzi za „widziane przed chwilą" bez ponownego
 * zapisu do bazy.
 *
 * Piętnaście minut, bo to najkrótszy okres, przy którym zapis jest
 * naprawdę rzadki, a odpowiedź nadal uczciwa. Profil pokazuje „ostatnio
 * widziany" z dokładnością do minut i godzin, więc błąd rzędu kwadransa
 * jest niewidoczny w tekście, który z tego powstaje.
 */
const ODSTEP_MS = 15 * 60 * 1000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * Kiedy ostatnio dotknęliśmy `lastActiveAt` danego konta.
   *
   * W pamięci procesu, nie w Redisie: to nie jest dana, którą trzeba
   * przechować. Najgorsze, co robi restart albo drugi proces PM2, to
   * jeden dodatkowy UPDATE na konto na kwadrans.
   */
  private readonly ostatnieDotkniecie = new Map<number, number>();

  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', 'change-me'),
    });
  }

  validate(payload: any) {
    this.odswiezAktywnosc(payload.userId);
    return { userId: payload.userId, role: payload.role };
  }

  /**
   * Odnotowanie, że konto właśnie czegoś użyło.
   *
   * Wcześniej `lastActiveAt` ustawiało się WYŁĄCZNIE przy logowaniu, więc
   * „ostatnio widziany" na profilu mówiło tak naprawdę „ostatnio się
   * zalogował". Przy tokenie ważnym tygodniami ktoś mógł czytać serwis
   * codziennie i wyglądać na nieobecnego od miesiąca — czyli pole
   * odpowiadało na inne pytanie, niż zadawał podpis pod nim.
   *
   * Trzy rzeczy trzymają koszt przy ziemi:
   *
   *  1. Zapis najwyżej raz na kwadrans na konto, pilnowany mapą w pamięci.
   *  2. Bez `await` — żądanie użytkownika nie czeka na ten UPDATE. To
   *     zapis czysto informacyjny; gdy padnie, nie ma czego ratować.
   *  3. Znacznik wchodzi do mapy PRZED zapytaniem, nie po nim. Inaczej
   *     seria równoległych żądań z jednej strony (a strona główna robi
   *     ich kilka naraz) wystartowałaby kilka UPDATE-ów jednocześnie.
   */
  private odswiezAktywnosc(userId: number | undefined) {
    if (!userId) return;

    const teraz = Date.now();
    const ostatnio = this.ostatnieDotkniecie.get(userId);
    if (ostatnio && teraz - ostatnio < ODSTEP_MS) return;

    this.ostatnieDotkniecie.set(userId, teraz);
    this.przytnijMape(teraz);

    this.prisma.user
      .update({ where: { id: userId }, data: { lastActiveAt: new Date(teraz) } })
      .catch(() => {
        /* Konto mogło zniknąć między wydaniem tokenu a tym żądaniem.
           Żądanie i tak odrzuci go dalej — tutaj nie ma co ratować. */
      });
  }

  /**
   * Mapa nie może rosnąć w nieskończoność.
   *
   * Bez tego proces trzymałby wpis dla KAŻDEGO konta, które kiedykolwiek
   * wysłało żądanie od ostatniego restartu — powolny wyciek pamięci,
   * który przy kilku użytkownikach jest niewidoczny, a przy dziesięciu
   * tysiącach już nie. Wpisy starsze niż odstęp i tak nic nie wnoszą:
   * następne żądanie takiego konta ma wywołać zapis.
   */
  private przytnijMape(teraz: number) {
    if (this.ostatnieDotkniecie.size < 1000) return;
    for (const [id, kiedy] of this.ostatnieDotkniecie) {
      if (teraz - kiedy >= ODSTEP_MS) this.ostatnieDotkniecie.delete(id);
    }
  }
}
