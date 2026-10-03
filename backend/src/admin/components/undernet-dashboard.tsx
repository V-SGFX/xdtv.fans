import React, { useEffect, useState } from 'react';
import { Box, H2, H3, H4, Text, Button } from '@adminjs/design-system';

/**
 * Pulpit UNDERNET.ONE.
 *
 * Osobny od pulpitu xdtv, bo oba serwisy mierzą się czym innym: tam klipy,
 * streamerzy i kanały czatu, tutaj obieg redakcyjny i to, ile wiedzy wyrosło
 * z dyskusji. Wspólny widok musiałby pokazywać połowę pól pustych albo
 * mieszać liczby z dwóch baz w jednej tabeli.
 *
 * Kolejność sekcji odpowiada temu, jak się tu pracuje: najpierw KOLEJKA
 * (co czeka na moją decyzję), potem baza wiedzy, na końcu forum i ludzie.
 */

const KOLOR = {
  akcent: '#00A3CC',
  czeka: '#E8A317',
  szkic: '#8892A4',
  gotowe: '#2E9E5B',
  forum: '#7B5CF6',
  ludzie: '#D9456B',
  pro: '#7A4FD1',
};

const Karta = ({ etykieta, wartosc, pod, kolor }: {
  etykieta: string; wartosc: number | string; pod?: string; kolor: string;
}) => (
  <Box
    bg="white" p="lg"
    style={{
      borderRadius: 12, flex: '1 1 150px', minWidth: 150,
      borderLeft: `4px solid ${kolor}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}
  >
    <Text style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#8892A4' }}>
      {etykieta}
    </Text>
    <H2 mt="sm" mb={pod ? 'xs' : 'default'} style={{ color: kolor, fontSize: 32, fontWeight: 800 }}>
      {typeof wartosc === 'number' ? wartosc.toLocaleString('pl-PL') : wartosc}
    </H2>
    {pod && <Text style={{ fontSize: 12, color: '#8892A4' }}>{pod}</Text>}
  </Box>
);

const Slupki = ({ dane }: { dane: { date: string; count: number }[] }) => {
  const max = Math.max(...dane.map((d) => d.count), 1);
  return (
    <Box bg="white" p="xl" style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <H4 mb="lg">Opublikowane materiały — ostatnie 14 dni</H4>
      <Box flex alignItems="flex-end" style={{ gap: 6, height: 130 }}>
        {dane.map((d) => (
          <Box key={d.date} flex flexDirection="column" alignItems="center" style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: '#8892A4', marginBottom: 4 }}>{d.count || ''}</Text>
            <Box style={{
              width: '100%', maxWidth: 28,
              height: Math.max((d.count / max) * 95, 2),
              backgroundColor: d.count ? KOLOR.gotowe : '#E4E8EF',
              borderRadius: '4px 4px 0 0',
            }} />
            <Text style={{ fontSize: 9, color: '#8892A4', marginTop: 6 }}>{d.date}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const ETAP: Record<string, string> = {
  DRAFT: 'szkic', REVIEW: 'akceptacja', PUBLISHED: 'opublikowany', ARCHIVED: 'archiwum',
};

const UndernetDashboard: React.FC = () => {
  const [dane, setDane] = useState<any>(null);
  const [blad, setBlad] = useState<string | null>(null);

  const pobierz = () => {
    setBlad(null);
    fetch('/admin/api/undernet-stats', { credentials: 'same-origin' })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
        return j;
      })
      .then(setDane)
      .catch((e) => setBlad(e.message));
  };

  useEffect(pobierz, []);

  if (blad) {
    return (
      <Box p="xxl">
        <H3>UNDERNET.ONE</H3>
        <Text mt="lg" style={{ color: '#D9456B' }}>{blad}</Text>
        <Button mt="lg" onClick={pobierz}>Spróbuj ponownie</Button>
      </Box>
    );
  }
  if (!dane) return <Box p="xxl"><Text>Liczę…</Text></Box>;

  const { uzytkownicy, forum, wiedza, decyzje, dziennie, pro } = dane;
  const doZrobienia = wiedza.wAkceptacji;

  return (
    <Box p="xxl" style={{ background: '#F6F7FB' }}>
      <Box flex justifyContent="space-between" alignItems="center" mb="xl">
        <Box>
          <H2 style={{ fontWeight: 800 }}>UNDERNET.ONE</H2>
          <Text style={{ color: '#8892A4' }}>
            Portal wiedzy technicznej — obieg redakcyjny i społeczność.
          </Text>
        </Box>
        <Button onClick={pobierz} variant="light">Odśwież</Button>
      </Box>

      {/* Kolejka na samej górze: to jedyna liczba, która oznacza zadanie. */}
      <Box
        bg={doZrobienia ? '#FFF7E6' : 'white'} p="xl" mb="xl"
        style={{
          borderRadius: 12,
          border: `1px solid ${doZrobienia ? KOLOR.czeka : '#E4E8EF'}`,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#8892A4' }}>
          Czeka na decyzję
        </Text>
        <Box flex alignItems="baseline" style={{ gap: 12 }} mt="sm">
          <H2 style={{ color: doZrobienia ? KOLOR.czeka : KOLOR.gotowe, fontSize: 40, fontWeight: 800 }}>
            {doZrobienia}
          </H2>
          <Text style={{ color: '#5C6B84' }}>
            {doZrobienia === 0
              ? 'Nic nie czeka w akceptacji.'
              : doZrobienia === 1
                ? 'materiał w akceptacji'
                : 'materiałów w akceptacji'}
          </Text>
          {doZrobienia > 0 && (
            <Button
              as="a"
              href="/admin/resources/UndernetContent?filters.status=REVIEW"
              variant="primary"
              size="sm"
              style={{ marginLeft: 'auto' }}
            >
              Przejrzyj
            </Button>
          )}
        </Box>
      </Box>

      {/*
        UNDERNET PRO tuż pod kolejką, przed treścią.
        To druga rzecz, na którą się tu patrzy: czy abonament się przyjmuje.
      */}
      <H4 mb="default" style={{ color: '#5C6B84' }}>UNDERNET PRO</H4>
      <Box flex flexWrap="wrap" style={{ gap: 16 }} mb="default">
        <Karta
          etykieta="Konta z PRO"
          wartosc={pro?.aktywne ?? 0}
          pod={`${pro?.udzial ?? 0}% wszystkich kont`}
          kolor={KOLOR.pro}
        />
        <Karta
          etykieta="Nowe w tygodniu"
          wartosc={pro?.tydzien ?? 0}
          pod="z datą końca w przyszłości"
          kolor={KOLOR.pro}
        />
        <Karta
          etykieta="Nadane ręcznie"
          wartosc={pro?.bezterminowe ?? 0}
          pod="bez daty końca"
          kolor={KOLOR.szkic}
        />
        <Karta
          etykieta="Wygasłe"
          wartosc={pro?.wygasle ?? 0}
          pod="do odnowienia albo zdjęcia"
          kolor={pro?.wygasle ? KOLOR.czeka : KOLOR.szkic}
        />
        <Karta
          etykieta="Funkcje płatne"
          wartosc={`${pro?.funkcjePlatne ?? 0} / ${pro?.funkcjeWszystkie ?? 0}`}
          pod="reszta dostępna za darmo"
          kolor={KOLOR.pro}
        />
      </Box>

      {/*
        Ostrzeżenie, nie ozdoba.

        Funkcja oznaczona jako płatna, przy zerowej liczbie kont z PRO,
        jest po prostu WYŁĄCZONA DLA WSZYSTKICH — nikt nie może jej mieć.
        Dopóki nie ma płatności, to stan łatwy do wywołania przez pomyłkę.
      */}
      {(pro?.funkcjePlatne ?? 0) > 0 && (pro?.aktywne ?? 0) === 0 && (
        <Box
          bg="#FFF7E6" p="lg" mb="xl"
          style={{ borderRadius: 12, border: `1px solid ${KOLOR.czeka}` }}
        >
          <Text style={{ color: '#7A5B12', fontSize: 13 }}>
            <strong>Uwaga:</strong> {pro?.funkcjePlatne} funkcj{pro?.funkcjePlatne === 1 ? 'a jest' : 'e są'} oznaczon
            {pro?.funkcjePlatne === 1 ? 'a' : 'e'} jako płatn{pro?.funkcjePlatne === 1 ? 'a' : 'e'}, a żadne konto nie ma PRO —
            czyli w praktyce {pro?.funkcjePlatne === 1 ? 'jest wyłączona' : 'są wyłączone'} dla wszystkich.
            Nadaj komuś PRO albo przestaw przełącznik z powrotem.
          </Text>
        </Box>
      )}
      {(pro?.funkcjePlatne ?? 0) === 0 && (
        <Text mb="xl" style={{ display: 'block', color: '#8892A4', fontSize: 12 }}>
          Wszystkie funkcje są w tej chwili dostępne za darmo. Przełączniki: UNDERNET.ONE — Monetyzacja → Undernet Premium.
        </Text>
      )}

      <H4 mb="default" style={{ color: '#5C6B84' }}>Baza wiedzy</H4>
      <Box flex flexWrap="wrap" style={{ gap: 16 }} mb="xl">
        <Karta etykieta="Opublikowane" wartosc={wiedza.opublikowane} pod={`dziś: ${wiedza.opublikowaneDzis}`} kolor={KOLOR.gotowe} />
        <Karta etykieta="Szkice" wartosc={wiedza.szkice} kolor={KOLOR.szkic} />
        <Karta etykieta="Z dyskusji" wartosc={wiedza.zWatkow} pod={`z ${wiedza.materialy} materiałów`} kolor={KOLOR.akcent} />
        <Karta etykieta="Archiwum" wartosc={wiedza.zarchiwizowane} kolor={KOLOR.szkic} />
      </Box>

      <Box flex flexWrap="wrap" style={{ gap: 16 }} mb="xl">
        <Karta etykieta="Wiki" wartosc={wiedza.wiki} kolor={KOLOR.akcent} />
        <Karta etykieta="How To" wartosc={wiedza.howto} kolor={KOLOR.akcent} />
        <Karta etykieta="Artykuły" wartosc={wiedza.artykuly} kolor={KOLOR.akcent} />
        <Karta etykieta="News" wartosc={wiedza.news} kolor={KOLOR.akcent} />
      </Box>

      <Box mb="xl"><Slupki dane={dziennie} /></Box>

      <H4 mb="default" style={{ color: '#5C6B84' }}>Forum</H4>
      <Box flex flexWrap="wrap" style={{ gap: 16 }} mb="xl">
        <Karta etykieta="Wątki" wartosc={forum.wpisy} pod={`dziś: ${forum.wpisyDzis} · tydzień: ${forum.wpisyTydzien}`} kolor={KOLOR.forum} />
        <Karta etykieta="Komentarze" wartosc={forum.komentarze} pod={`dziś: ${forum.komentarzeDzis}`} kolor={KOLOR.forum} />
        <Karta etykieta="Społeczności" wartosc={forum.spolecznosci} kolor={KOLOR.forum} />
      </Box>

      <H4 mb="default" style={{ color: '#5C6B84' }}>Ludzie</H4>
      <Box flex flexWrap="wrap" style={{ gap: 16 }} mb="xl">
        <Karta etykieta="Konta" wartosc={uzytkownicy.total} pod={`dziś: ${uzytkownicy.dzis} · tydzień: ${uzytkownicy.tydzien}`} kolor={KOLOR.ludzie} />
        <Karta etykieta="Autorzy" wartosc={uzytkownicy.autor} pod={`profile autorskie: ${wiedza.autorzy}`} kolor={KOLOR.ludzie} />
        <Karta etykieta="Redaktorzy" wartosc={uzytkownicy.redaktor} kolor={KOLOR.ludzie} />
        <Karta etykieta="Moderatorzy" wartosc={uzytkownicy.moderator} kolor={KOLOR.ludzie} />
      </Box>

      <Box bg="white" p="xl" style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <H4 mb="lg">Ostatnie decyzje redakcyjne</H4>
        {decyzje.length === 0 && <Text style={{ color: '#8892A4' }}>Jeszcze żadnych.</Text>}
        {decyzje.map((d: any, i: number) => (
          <Box
            key={i}
            py="default"
            style={{ borderBottom: i < decyzje.length - 1 ? '1px solid #EEF1F6' : 'none' }}
          >
            <Box flex justifyContent="space-between" style={{ gap: 12 }}>
              <Text style={{ fontWeight: 600 }}>{d.tytul}</Text>
              <Text style={{ color: '#8892A4', fontSize: 12, whiteSpace: 'nowrap' }}>
                {new Date(d.kiedy).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Box>
            <Text style={{ fontSize: 12, color: '#5C6B84' }}>
              {d.kto} · {ETAP[d.z] ?? d.z} → {ETAP[d.na] ?? d.na}
              {d.uwaga ? ` · „${d.uwaga}”` : ''}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default UndernetDashboard;
