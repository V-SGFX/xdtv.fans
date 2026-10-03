import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Polityka Prywatności',
  description: 'Polityka prywatności serwisu XDTV.fans — informacje o przetwarzaniu danych osobowych.',
};

export default function PolitykaPrywatnosciPage() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <h1>Polityka Prywatności serwisu XDTV.fans</h1>
        <p className="legal-updated">Ostatnia aktualizacja: 12 lipca 2025 r.</p>

        <section>
          <h2>§ 1. Administrator danych</h2>
          <ol>
            <li>Administratorem danych osobowych Użytkowników serwisu <strong>xdtv.fans</strong> (dalej: „Serwis") jest XDTV.fans (dalej: „Administrator").</li>
            <li>Kontakt z Administratorem: <strong>kontakt@xdtv.fans</strong>.</li>
            <li>Dane osobowe przetwarzane są zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. w sprawie ochrony osób fizycznych w związku z przetwarzaniem danych osobowych (RODO) oraz ustawą z dnia 10 maja 2018 r. o ochronie danych osobowych.</li>
          </ol>
        </section>

        <section>
          <h2>§ 2. Zakres zbieranych danych</h2>
          <ol>
            <li>Administrator zbiera następujące dane:
              <ul>
                <li><strong>Przy rejestracji:</strong> nazwa użytkownika, adres e-mail, hasło (przechowywane w formie zaszyfrowanej).</li>
                <li><strong>Przy logowaniu przez Twitch:</strong> identyfikator Twitch, nazwa użytkownika, avatar — na podstawie autoryzacji OAuth2.</li>
                <li><strong>Automatycznie:</strong> adres IP, typ przeglądarki, system operacyjny, dane o aktywności w Serwisie (odwiedzone strony, czas sesji).</li>
                <li><strong>System zaangażowania:</strong> punkty XP, historia zakładów w predykcjach, głosy w bitwach streamerów, posiadane kosmetyki, serie aktywności (streaki).</li>
              </ul>
            </li>
          </ol>
        </section>

        <section>
          <h2>§ 3. Cele i podstawy prawne przetwarzania</h2>
          <ol>
            <li>Dane osobowe przetwarzane są w następujących celach:
              <table className="legal-table">
                <thead>
                  <tr>
                    <th>Cel</th>
                    <th>Podstawa prawna</th>
                    <th>Okres przechowywania</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Świadczenie usług (konto, forum, funkcje serwisu)</td>
                    <td>Art. 6 ust. 1 lit. b RODO — wykonanie umowy</td>
                    <td>Do usunięcia konta</td>
                  </tr>
                  <tr>
                    <td>Analityka i poprawa jakości usług</td>
                    <td>Art. 6 ust. 1 lit. f RODO — prawnie uzasadniony interes</td>
                    <td>Do 26 miesięcy</td>
                  </tr>
                  <tr>
                    <td>Bezpieczeństwo serwisu (logi, zapobieganie nadużyciom)</td>
                    <td>Art. 6 ust. 1 lit. f RODO — prawnie uzasadniony interes</td>
                    <td>Do 12 miesięcy</td>
                  </tr>
                  <tr>
                    <td>System zaangażowania (XP, predykcje, bitwy, ranking)</td>
                    <td>Art. 6 ust. 1 lit. b RODO — wykonanie umowy</td>
                    <td>Do usunięcia konta</td>
                  </tr>
                </tbody>
              </table>
            </li>
          </ol>
        </section>

        <section>
          <h2>§ 4. Odbiorcy danych</h2>
          <ol>
            <li>Dane osobowe mogą być przekazywane następującym podmiotom:
              <ul>
                <li><strong>Cloudflare, Inc.</strong> — usługa CDN i ochrony DDoS (adresy IP, dane o ruchu sieciowym).</li>
                <li><strong>Twitch Interactive, Inc.</strong> — w przypadku logowania przez Twitch (identyfikator użytkownika, avatar).</li>
              </ul>
            </li>
            <li>Dane mogą być przekazywane do państw trzecich (USA) w ramach standardowych klauzul umownych (SCC) zgodnie z decyzją Komisji Europejskiej lub na podstawie programu EU-US Data Privacy Framework.</li>
            <li>Administrator nie sprzedaje danych osobowych Użytkowników podmiotom trzecim.</li>
          </ol>
        </section>

        <section>
          <h2>§ 5. Prawa Użytkownika</h2>
          <ol>
            <li>Zgodnie z RODO, Użytkownikowi przysługują następujące prawa:
              <ul>
                <li><strong>Prawo dostępu</strong> (art. 15 RODO) — uzyskanie informacji o przetwarzanych danych.</li>
                <li><strong>Prawo do sprostowania</strong> (art. 16 RODO) — poprawienie nieprawidłowych danych.</li>
                <li><strong>Prawo do usunięcia</strong> (art. 17 RODO) — żądanie usunięcia danych („prawo do bycia zapomnianym").</li>
                <li><strong>Prawo do ograniczenia przetwarzania</strong> (art. 18 RODO).</li>
                <li><strong>Prawo do przenoszenia danych</strong> (art. 20 RODO).</li>
                <li><strong>Prawo do sprzeciwu</strong> (art. 21 RODO) — wobec przetwarzania opartego na prawnie uzasadnionym interesie.</li>
              </ul>
            </li>
            <li>W celu realizacji powyższych praw należy skontaktować się z Administratorem: <strong>kontakt@xdtv.fans</strong>.</li>
            <li>Administrator rozpatruje żądania bez zbędnej zwłoki, nie dłużej niż w ciągu 30 dni od otrzymania żądania.</li>
            <li>Użytkownik ma prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (PUODO), ul. Stawki 2, 00-193 Warszawa, jeśli uzna, że przetwarzanie narusza RODO.</li>
          </ol>
        </section>

        <section>
          <h2>§ 6. Pliki cookies</h2>
          <ol>
            <li>Serwis wykorzystuje pliki cookies (ciasteczka) w następujących celach:
              <ul>
                <li><strong>Niezbędne</strong> — utrzymanie sesji logowania, zabezpieczenia CSRF, preferencje Użytkownika.</li>
                <li><strong>Analityczne</strong> — analiza ruchu na stronie w celu poprawy jakości usług.</li>
                <li><strong>Funkcjonalne</strong> — zapamiętywanie ustawień (np. motywy, preferencje widoku).</li>
              </ul>
            </li>
            <li>Użytkownik może zarządzać plikami cookies w ustawieniach przeglądarki. Wyłączenie cookies niezbędnych może uniemożliwić korzystanie z niektórych funkcji Serwisu.</li>
            <li>Szczegółowe informacje o cookies używanych w Serwisie:
              <table className="legal-table">
                <thead>
                  <tr>
                    <th>Nazwa</th>
                    <th>Cel</th>
                    <th>Ważność</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>session</code></td>
                    <td>Utrzymanie sesji logowania</td>
                    <td>Do zamknięcia sesji</td>
                  </tr>
                  <tr>
                    <td><code>csrf_token</code></td>
                    <td>Ochrona przed atakami CSRF</td>
                    <td>Sesja</td>
                  </tr>
                </tbody>
              </table>
            </li>
          </ol>
        </section>

        <section>
          <h2>§ 7. Bezpieczeństwo danych</h2>
          <ol>
            <li>Administrator stosuje odpowiednie środki techniczne i organizacyjne w celu ochrony danych osobowych, w tym:
              <ul>
                <li>szyfrowanie połączeń SSL/TLS,</li>
                <li>hashowanie haseł algorytmem bcrypt,</li>
                <li>ochronę przed atakami DDoS (Cloudflare),</li>
                <li>regularne kopie zapasowe danych,</li>
                <li>ograniczony dostęp do danych tylko dla uprawnionych osób.</li>
              </ul>
            </li>
          </ol>
        </section>

        <section>
          <h2>§ 8. Dane dzieci</h2>
          <ol>
            <li>Serwis nie jest przeznaczony dla osób poniżej 16. roku życia.</li>
            <li>Administrator nie zbiera świadomie danych osobowych osób poniżej 16 lat. W przypadku powzięcia informacji o zebraniu takich danych, zostaną one niezwłocznie usunięte.</li>
          </ol>
        </section>

        <section>
          <h2>§ 9. Zmiany Polityki Prywatności</h2>
          <ol>
            <li>Administrator zastrzega sobie prawo do zmiany niniejszej Polityki Prywatności.</li>
            <li>O istotnych zmianach Użytkownicy zostaną poinformowani poprzez komunikat w Serwisie.</li>
            <li>Aktualna wersja Polityki Prywatności jest zawsze dostępna pod adresem <Link href="/polityka-prywatnosci">xdtv.fans/polityka-prywatnosci</Link>.</li>
          </ol>
        </section>

        <section>
          <h2>§ 10. Podstawy prawne</h2>
          <ol>
            <li>Niniejsza Polityka Prywatności została przygotowana w oparciu o:
              <ul>
                <li>Rozporządzenie Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO),</li>
                <li>Ustawę z dnia 10 maja 2018 r. o ochronie danych osobowych (Dz.U. 2018 poz. 1000),</li>
                <li>Ustawę z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną (Dz.U. 2002 nr 144 poz. 1204),</li>
                <li>Ustawę z dnia 16 lipca 2004 r. Prawo telekomunikacyjne (Dz.U. 2004 nr 171 poz. 1800) — w zakresie plików cookies,</li>
                <li>Ustawę z dnia 23 kwietnia 1964 r. Kodeks cywilny (Dz.U. 1964 nr 16 poz. 93).</li>
                <li>Ustawę z dnia 5 lipca 2018 r. o krajowym systemie cyberbezpieczeństwa (Dz.U. 2018 poz. 1560 z późn. zm.).</li>
              </ul>
            </li>
          </ol>
        </section>

        <div className="legal-contact">
          <h3>Kontakt</h3>
          <p>W razie pytań dotyczących przetwarzania danych osobowych prosimy o kontakt: <strong>kontakt@xdtv.fans</strong></p>
        </div>
      </div>
    </main>
  );
}
