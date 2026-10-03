# Bloki reklamowe

Kod reklam wkleja się w panelu administracyjnym:
**`https://xdtv.fans/admin` → Monetyzacja → Ad Slots**.

Nie ma potrzeby wdrożenia ani restartu. Zmiana wchodzi w ciągu 5 minut
(cache w Redisie), a po restarcie backendu natychmiast.

## Jak to działa

```
panel admina  →  tabela ad_slots  →  GET /api/ads  →  <AdSlot slotKey="…" />
```

`key` jest **kontraktem między bazą a kodem strony**. Komponent szuka bloku
po tym kluczu, dlatego pole jest w panelu tylko do odczytu: literówka dałaby
blok, którego nic nigdy nie wyrenderuje — bez błędu, bez śladu, po prostu
puste miejsce.

Blok bez kodu albo wyłączony **nie renderuje niczego**: ani ramki, ani
odstępu, ani pustego kontenera. Wyłączenie w panelu usuwa reklamę ze strony,
a nie tylko ją ukrywa.

## Bloki

| Klucz | Gdzie | Zalecany format |
|---|---|---|
| `home-top` | Strona główna, pas nad zakładkami kanału | poziomy 728×90 lub responsywny |
| `feed-inline` | W kanale, co ósma karta — na każdej liście treści | kwadrat 300×250 lub responsywny |
| `sidebar-right` | Prawa kolumna, od 1024 px. Na telefonie nie istnieje | pionowy 300×600 |
| `post-detail` | Między treścią posta a komentarzami | poziomy lub responsywny |
| `discover-top` | Odkrywaj, pas nad zakładkami | poziomy lub responsywny |

`feed-inline` pojawia się wszędzie, gdzie jest siatka treści: strona główna,
Odkrywaj, klipy, społeczności, wyniki wyszukiwania, profile. Jeden blok
obsługuje je wszystkie.

## Co wkleić

Cały snippet od dostawcy, ze znacznikiem `<script>` włącznie. Dla AdSense
jest to zwykle:

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXX" crossorigin="anonymous"></script>
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-XXXXXXXX"
     data-ad-slot="1234567890"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
```

Skrypty są odtwarzane tak, żeby przeglądarka je wykonała. Wklejenie kodu
przez zwykłe `innerHTML` nie uruchomiłoby `<script>` — blok wyglądałby na
wstawiony i nie pokazywał nic.

## Czego tu nie ma i dlaczego

**Kod jest wykonywany w przeglądarce odwiedzającego.** Inaczej się nie da —
snippet AdSense to `<script>`. Konsekwencja: kto ma dostęp do panelu, ten
może wstrzyknąć na stronę dowolny kod. Dlatego zapis do tej tabeli jest
możliwy wyłącznie z panelu administracyjnego i nie ma go w publicznym API.

**Nie ma dodawania i usuwania bloków z panelu.** Nowy blok wymaga wstawienia
komponentu `<AdSlot>` w konkretnym miejscu w kodzie — sam wiersz w bazie nie
zrobi nic. Dodawanie z panelu tworzyłoby wpisy, które wyglądają na działające
i nie są.

## Dodanie nowego miejsca

1. Wiersz w `ad_slots` (migracja albo `INSERT`) z opisem, gdzie ląduje.
2. Klucz w typie `AdSlotKey` w `src/components/ads/ad-slot.tsx`.
3. `<AdSlot slotKey="nowy-klucz" />` w docelowym widoku.
