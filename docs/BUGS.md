# Fehlerliste – PokéBinder

Hier steht jeder gemeldete Fehler, bis er behoben und von der meldenden Person bestätigt ist. Wünsche und neue Funktionen gehören nicht hierher, sondern in `REQUIREMENTS.md` („Offen“ und „Roadmap“).

## So wird ein Fehler gemeldet

Damit sich ein Fehler nachstellen lässt, hilft bei jeder Meldung:

- **Was** ist passiert, und was hättest du erwartet?
- **Wo:** Gerät (PC, iPad, Handy), Browser, und ob die App installiert ist oder im Browser läuft.
- **Wie:** die Schritte bis zum Fehler, so genau wie möglich. Bei welchem Binder, Deck oder welcher Karte?
- **Wie oft:** immer, manchmal, einmal?
- **Bild:** ein Screenshot, wenn es etwas zu sehen gibt.

## Stände

| Stand | Bedeutung |
|---|---|
| offen | gemeldet, noch nicht untersucht |
| nachgestellt | der Fehler lässt sich gezielt auslösen, die Ursache ist bekannt oder eingegrenzt |
| behoben | Korrektur ist live, Bestätigung der meldenden Person steht aus |
| bestätigt | die meldende Person hat geprüft, dass es jetzt stimmt |
| kein Fehler | verhält sich wie vorgesehen; Grund steht dabei |

## Offene Fehler

| Nr. | Gemeldet | Von | Fehler | Stand |
|---|---|---|---|---|

_Zurzeit keine._

## Behobene Fehler

| Nr. | Gemeldet | Von | Fehler | Behoben mit | Stand |
|---|---|---|---|---|---|
| B-001 | 12.10.2026 | Henrik | Binder-Seiten laden langsam, „man sieht anfangs nur den Namen“ – in Sets, von denen TCGdex keine Bilder hat (gemeldet als „graue Karten laden langsam“) | Einzelheiten unten | behoben, Bestätigung offen |
| B-002 | 12.10.2026 | Henrik | Die Suche fand ein Pokémon nur unter dem Namen in der eingestellten Kartensprache („psyduck“ fand bei Deutsch nichts) | `fba67f8`, Einzelheiten unten | bestätigt |
| – | 12.10.2026 | Henrik | Kartenbilder blieben in Suche, Binder und Info-Anzeige leer oder luden erst nach einem Fensterwechsel | `554a043` (TCGdex schickt eine Kopfzeile teils doppelt; Bilder werden jetzt schlicht angezeigt) | bestätigt |
| – | 12.10.2026 | Henrik | Menüs der Werkzeugleiste schlossen nicht bei einem Klick daneben | `6188e97` | bestätigt |

### B-002 – Suche fand Pokémon nur in der eingestellten Sprache (behoben)

- **Was jetzt gilt:** Findet die Suche unter dem eingetippten Namen nichts, fragt sie die anderen Sprachen, welches Pokémon gemeint ist, und zeigt dessen Karten in der eingestellten Sprache. „psyduck“ zeigt bei Deutsch die Enton-Karten, „glurak“ bei Englisch die Charizard-Karten. Set, Seltenheit, Typ und Nummer wirken wie sonst („mewtwo 150“).
- **Gegen das echte TCGdex geprüft:** psyduck → 32 Enton-Karten, charizard → Glurak, lucario → Lucario, snorlax → Relaxo, „mewtwo 150“ → Mewtu; umgekehrt glurak → Charizard.
- **Grenzen:**
  - Nur Pokémon. Trainer- und Energiekarten haben keine Pokédex-Nummer, über die sich die Sprachen verbinden lassen: „professor's research“ findet bei Deutsch weiterhin nichts.
  - Die andere Sprache wird nur gefragt, wenn der Name so, wie er getippt wurde, gar nichts findet. Findet er zufällig etwas anderes, bleibt es dabei: „Enton“ zeigt bei Englisch „Professor Laventon“, weil der Name darin steckt.

### B-001 – Seiten laden langsam, anfangs steht nur der Name da (behoben)

- **Gemeldet als:** Seiten mit vielen grauen Karten laden langsam. Der Graufilter war es nicht: Zwei Messungen (ohne und mit Grafikkarte) zeigten keinen Unterschied zwischen grau und farbig, und Henriks Vergleich mit `?grau=aus` auch nicht.
- **Der entscheidende Hinweis:** Firefox, ein Master Set der „Galar-Galerie“, anfangs steht nur der Name da. Von diesem Set hat TCGdex keine Kartenbilder; die App holt sie von der zweiten Bildquelle (pokemontcg.io).
- **Ursache, nachgestellt:** Für jede solche Karte lud die App bei jedem Aufschlagen der Seite neu: erst der Versuch beim englischen TCGdex-Bild (gibt es nicht), dann die Prüfung des Ersatzbildes durch vollständiges Herunterladen in voller Größe (440–790 KB je Karte), dann das Bild selbst. Gemessen in Chromium: auch beim zweiten und dritten Aufschlagen 520–550 ms je Doppelseite.
- **Behoben:**
  - Die App merkt sich, welche Bilder es nicht gibt, und nach drei Karten eines Sets, dass das ganze Set bei TCGdex keine hat (eine Woche lang, auch nach dem Schließen).
  - Ersatzbilder werden zuerst klein gezeigt (160–210 KB) und im Hintergrund durch das große ersetzt.
  - Geprüft wird ein Ersatzbild nur noch über den Status der Antwort, nicht mehr durch Herunterladen.
  - Die Nachbarseiten werden auch für solche Karten vorab geholt.
- **Gemessen danach (Chromium, dieselbe Doppelseite):** zweites und drittes Aufschlagen 30–40 ms statt 520–550 ms; eine vorab geholte Seite steht nach 1 ms. Das erste Aufschlagen einer noch nie gesehenen Seite dauert weiterhin rund 1,5 s: Die Bilder müssen einmal aus dem Netz kommen.
- **Nicht gemessen:** Firefox und das Handy, wo Henrik den Fehler sieht. Darum „Bestätigung offen“.
- **Aufgeräumt:** Der Schalter `?grau=aus` zum Vergleichen ist wieder entfernt.
