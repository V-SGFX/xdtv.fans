import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Regulamin',
  description: 'Regulamin serwisu XDTV.fans — zasady korzystania z platformy i usług.',
};

export default function RegulaminPage() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <h1>Regulamin serwisu XDTV.fans</h1>
        <p className="legal-updated">Ostatnia aktualizacja: 12 lipca 2025 r.</p>

        <section>
          <h2>§ 1. Postanowienia ogólne</h2>
          <ol>
            <li>Niniejszy Regulamin określa zasady korzystania z serwisu internetowego dostępnego pod adresem <strong>xdtv.fans</strong> (dalej: „Serwis").</li>
            <li>Właścicielem i administratorem Serwisu jest XDTV.fans (dalej: „Usługodawca").</li>
            <li>Serwis świadczy usługi drogą elektroniczną w rozumieniu ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną (Dz.U. 2002 nr 144 poz. 1204 z późn. zm.).</li>
            <li>Korzystanie z Serwisu oznacza akceptację niniejszego Regulaminu oraz <Link href="/polityka-prywatnosci">Polityki Prywatności</Link>.</li>
            <li>Regulamin jest udostępniany nieodpłatnie za pośrednictwem Serwisu w formie umożliwiającej jego pobranie, utrwalenie i wydrukowanie.</li>
          </ol>
        </section>

        <section>
          <h2>§ 2. Definicje</h2>
          <ol>
            <li><strong>Użytkownik</strong> — osoba fizyczna korzystająca z Serwisu, która ukończyła 16 lat.</li>
            <li><strong>Konto</strong> — indywidualne konto Użytkownika w Serwisie, utworzone poprzez rejestrację.</li>
            <li><strong>Treść</strong> — wszelkie materiały (teksty, obrazy, klipy) publikowane przez Użytkowników w Serwisie.</li>
            <li><strong>Społeczność</strong> — tematyczna grupa w Serwisie, do której Użytkownicy mogą dołączać i publikować treści.</li>
          </ol>
        </section>

        <section>
          <h2>§ 3. Warunki techniczne</h2>
          <ol>
            <li>Do korzystania z Serwisu wymagane jest:
              <ul>
                <li>urządzenie z dostępem do internetu,</li>
                <li>aktualna przeglądarka internetowa (Chrome, Firefox, Safari, Edge),</li>
                <li>włączona obsługa JavaScript i plików cookies.</li>
              </ul>
            </li>
            <li>Usługodawca nie ponosi odpowiedzialności za problemy techniczne wynikające z niespełnienia powyższych wymagań.</li>
          </ol>
        </section>

        <section>
          <h2>§ 4. Rejestracja i konto</h2>
          <ol>
            <li>Rejestracja w Serwisie jest bezpłatna i wymaga podania nazwy użytkownika, adresu e-mail i hasła lub logowania przez platformy zewnętrzne (Twitch).</li>
            <li>Użytkownik zobowiązuje się do podania prawdziwych danych i ich bieżącej aktualizacji.</li>
            <li>Użytkownik odpowiada za zachowanie poufności danych logowania do Konta.</li>
            <li>Usługodawca zastrzega sobie prawo do zawieszenia lub usunięcia Konta w przypadku naruszenia Regulaminu.</li>
            <li>Użytkownik może w każdym czasie usunąć swoje Konto kontaktując się z administracją Serwisu.</li>
          </ol>
        </section>

        <section>
          <h2>§ 5. Zasady korzystania z Serwisu</h2>
          <ol>
            <li>Użytkownik zobowiązuje się do korzystania z Serwisu zgodnie z obowiązującym prawem, dobrymi obyczajami i niniejszym Regulaminem.</li>
            <li>Zabrania się:
              <ul>
                <li>publikowania treści niezgodnych z prawem, obraźliwych, wulgarnych lub naruszających prawa osób trzecich,</li>
                <li>spamowania, trollowania i publikowania treści reklamowych bez zgody administracji,</li>
                <li>podszywania się pod inne osoby,</li>
                <li>działań mających na celu zakłócenie funkcjonowania Serwisu,</li>
                <li>obchodzenia zabezpieczeń technicznych Serwisu,</li>
                <li>wykorzystywania botów lub automatycznych narzędzi bez zgody Usługodawcy.</li>
              </ul>
            </li>
            <li>Treści publikowane przez Użytkowników są ich własnością. Użytkownik udziela Usługodawcy niewyłącznej licencji na ich wyświetlanie w Serwisie.</li>
            <li>Usługodawca zastrzega sobie prawo do moderacji i usuwania treści naruszających Regulamin bez uprzedniego powiadomienia.</li>
          </ol>
        </section>

        <section>
          <h2>§ 6. System zaangażowania (XP)</h2>
          <ol>
            <li>Serwis udostępnia system punktów doświadczenia (XP) — wirtualnej waluty niemającej wartości pieniężnej i niewymieniany na środki pieniężne.</li>
            <li>XP można zdobywać m.in. za: codzienną aktywność (streak), pisanie na czacie, głosowanie w bitwach streamerów, udział w predykcjach.</li>
            <li>XP można wydawać na kosmetyki (np. kolory czatu, odznaki) w Sklepie XP lub obstawianie predykcji.</li>
            <li>Usługodawca zastrzega sobie prawo do zmiany zasad przyznawania i wydawania XP bez uprzedniego powiadomienia.</li>
            <li>Zabronione jest używanie botów, skryptów lub automatycznych narzędzi w celu sztucznego zdobywania XP.</li>
          </ol>
        </section>

        <section>
          <h2>§ 7. Predykcje</h2>
          <ol>
            <li>Predykcje to mechanika rozrywkowa, w której Użytkownicy obstawiają wynik pytania za pomocą XP.</li>
            <li>Predykcje <strong>nie stanowią gier hazardowych</strong> w rozumieniu ustawy z dnia 19 listopada 2009 r. o grach hazardowych (Dz.U. 2009 nr 201 poz. 1540 z późn. zm.), ponieważ XP nie ma wartości pieniężnej i nie można go wypłacić.</li>
            <li>Użytkownik może postawić od 10 do 500 XP na jedną opcję w danej predykcji.</li>
            <li>Po rozstrzygnięciu predykcji XP z puli jest rozdzielane proporcjonalnie między Użytkowników, którzy postawili na zwycięską opcję.</li>
            <li>Usługodawca zastrzega sobie prawo do anulowania predykcji i zwrotu postawionych XP.</li>
          </ol>
        </section>

        <section>
          <h2>§ 8. Bitwy Streamerów</h2>
          <ol>
            <li>Bitwy Streamerów to mechanika rozrywkowa, w której Użytkownicy głosują na jednego z dwóch streamerów.</li>
            <li>Każdy Użytkownik może oddać jeden głos w danej bitwie i zmienić go w dowolnym momencie przed jej zakończeniem.</li>
            <li>Wyniki bitew są publikowane w rankingu ogólnym.</li>
            <li>Głosowanie nie wiąże się z żadnymi zobowiązaniami finansowymi.</li>
          </ol>
        </section>

        <section>
          <h2>§ 9. Reklamacje</h2>
          <ol>
            <li>Użytkownik ma prawo złożyć reklamację dotyczącą świadczonych usług.</li>
            <li>Reklamacje należy składać drogą elektroniczną na adres: <strong>kontakt@xdtv.fans</strong>.</li>
            <li>Reklamacja powinna zawierać: nazwę użytkownika, opis problemu oraz datę wystąpienia zdarzenia.</li>
            <li>Reklamacje rozpatrywane są w terminie 14 dni roboczych od daty ich otrzymania. O wyniku rozpatrzenia Użytkownik zostanie poinformowany drogą elektroniczną.</li>
          </ol>
        </section>

        <section>
          <h2>§ 10. Odpowiedzialność</h2>
          <ol>
            <li>Usługodawca dokłada starań, aby Serwis działał nieprzerwanie i bez błędów, ale nie gwarantuje ciągłej dostępności.</li>
            <li>Usługodawca nie ponosi odpowiedzialności za:
              <ul>
                <li>treści publikowane przez Użytkowników,</li>
                <li>przerwy w działaniu Serwisu wynikające z przyczyn technicznych lub działania siły wyższej,</li>
                <li>skutki korzystania z Serwisu niezgodnie z Regulaminem,</li>
                <li>utratę danych spowodowaną działaniem osób trzecich.</li>
              </ul>
            </li>
            <li>Serwis może zawierać linki do zewnętrznych stron internetowych, za których treść Usługodawca nie odpowiada.</li>
          </ol>
        </section>

        <section>
          <h2>§ 11. Własność intelektualna</h2>
          <ol>
            <li>Projekt graficzny Serwisu, logo, nazwa „XDTV.fans" oraz kod źródłowy stanowią własność intelektualną Usługodawcy i podlegają ochronie prawnej.</li>
            <li>Kopiowanie, rozpowszechnianie lub modyfikowanie elementów Serwisu bez zgody Usługodawcy jest zabronione.</li>
          </ol>
        </section>

        <section>
          <h2>§ 12. Ochrona danych osobowych</h2>
          <ol>
            <li>Administratorem danych osobowych Użytkowników jest Usługodawca.</li>
            <li>Dane osobowe przetwarzane są zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. (RODO) oraz ustawą z dnia 10 maja 2018 r. o ochronie danych osobowych.</li>
            <li>Szczegółowe zasady przetwarzania danych osobowych określa <Link href="/polityka-prywatnosci">Polityka Prywatności</Link>.</li>
          </ol>
        </section>

        <section>
          <h2>§ 13. Zmiana Regulaminu</h2>
          <ol>
            <li>Usługodawca zastrzega sobie prawo do zmiany Regulaminu.</li>
            <li>O zmianach Użytkownicy zostaną poinformowani poprzez komunikat w Serwisie z co najmniej 14-dniowym wyprzedzeniem.</li>
            <li>Dalsze korzystanie z Serwisu po wejściu zmian w życie oznacza akceptację nowego Regulaminu.</li>
            <li>Użytkownik, który nie akceptuje zmian, ma prawo usunąć Konto przed ich wejściem w życie.</li>
          </ol>
        </section>

        <section>
          <h2>§ 14. Rozwiązywanie sporów</h2>
          <ol>
            <li>Wszelkie spory wynikające z korzystania z Serwisu strony będą starały się rozwiązać polubownie.</li>
            <li>Konsument ma możliwość skorzystania z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń, w tym:
              <ul>
                <li>za pośrednictwem platformy ODR Unii Europejskiej: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr</a>,</li>
                <li>u właściwego Wojewódzkiego Inspektora Inspekcji Handlowej,</li>
                <li>u powiatowego (miejskiego) rzecznika konsumentów.</li>
              </ul>
            </li>
            <li>W przypadku braku polubownego rozwiązania, spory będą rozstrzygane przez sąd właściwy zgodnie z przepisami Kodeksu postępowania cywilnego.</li>
          </ol>
        </section>

        <section>
          <h2>§ 15. Bezpieczeństwo teleinformatyczne (KSC)</h2>
          <ol>
            <li>Usługodawca stosuje środki bezpieczeństwa teleinformatycznego zgodnie z ustawą z dnia 5 lipca 2018 r. o krajowym systemie cyberbezpieczeństwa (Dz.U. 2018 poz. 1560 z późn. zm.), w tym:
              <ul>
                <li>szyfrowane połączenia (SSL/TLS),</li>
                <li>ochronę przed atakami DDoS,</li>
                <li>regularne aktualizacje oprogramowania,</li>
                <li>monitorowanie bezpieczeństwa systemów,</li>
                <li>procedury reagowania na incydenty bezpieczeństwa.</li>
              </ul>
            </li>
            <li>Użytkownik zobowiązany jest do:
              <ul>
                <li>stosowania silnych haseł i ich regularnej zmiany,</li>
                <li>niezwłocznego informowania Usługodawcy o podejrzeniu naruszenia bezpieczeństwa konta,</li>
                <li>nieudostępniania danych logowania osobom trzecim.</li>
              </ul>
            </li>
          </ol>
        </section>

        <section>
          <h2>§ 16. Postanowienia końcowe</h2>
          <ol>
            <li>W sprawach nieuregulowanych niniejszym Regulaminem zastosowanie mają przepisy prawa polskiego, w szczególności Kodeksu cywilnego, ustawy o świadczeniu usług drogą elektroniczną oraz ustawy o krajowym systemie cyberbezpieczeństwa.</li>
            <li>Regulamin wchodzi w życie z dniem 12 lipca 2025 r.</li>
          </ol>
        </section>

        <div className="legal-contact">
          <h3>Kontakt</h3>
          <p>W razie pytań dotyczących Regulaminu prosimy o kontakt: <strong>kontakt@xdtv.fans</strong></p>
        </div>
      </div>
    </main>
  );
}
