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
| B-004 | 13.10.2026 | Henrik | Der Import einer Cardmarket-Wunschliste geht mit echten, größeren Listen aus mehreren Sets nicht | offen – es fehlt eine Liste, mit der es schiefgeht, und was dabei passiert (Fehlermeldung, nichts erkannt, falsche Karten) |

## Behobene Fehler

| Nr. | Gemeldet | Von | Fehler | Behoben mit | Stand |
|---|---|---|---|---|---|
| B-001 | 12.10.2026 | Henrik | Binder-Seiten laden langsam, „man sieht anfangs nur den Namen“ – in Sets, von denen TCGdex keine Bilder hat (gemeldet als „graue Karten laden langsam“) | `1ae913b`, Einzelheiten unten | bestätigt |
| B-003 | 13.10.2026 | Henrik | Japanische Karten lassen sich mit deutschem oder englischem Namen nicht (immer) finden | 589b17c, Einzelheiten unten | bestätigt (16.10.2026): Die Suche funktioniert; was fehlt, sind Karten, die TCGdex nicht hat – weiter als Punkt 40 in REQUIREMENTS.md |
| B-006 | 13.10.2026 | Henrik | Im Fenster „Cover bearbeiten“ lassen sich schon hochgeladene Bilder nicht wählen; ein hochgeladenes Bild ließ sich „nicht mehr löschen“ | siehe unten | bestätigt (16.10.2026) |
| B-005 | 13.10.2026 | Henrik | „Enton“ bei englischen Karten findet keine Psyduck-Karten | siehe unten | bestätigt (16.10.2026) |
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
- **Nicht gemessen:** Firefox und das Handy, wo Henrik den Fehler sah. Von Henrik am 12.10.2026 bestätigt: „viel besser“.
- **Aufgeräumt:** Der Schalter `?grau=aus` zum Vergleichen ist wieder entfernt.

### B-003 – Japanische Karten unter deutschem oder englischem Namen

- **Gemeldet:** „östliche Karten mit deutschen oder englischen Namen finden klappt nicht“, ohne Beispiel.
- **Nachgestellt (13.10.2026, Live-Seite, Sprache Japanisch):** „Glurak“, „Charizard“, „Pikachu“, „Evoli“, „Mewtu“ finden die japanischen Karten (40–60 Stück). **„Eevee“ fand nur 5 Karten:** TCGdex führt ein paar alte japanische Karten unter englischem Namen. Weil der Name damit „etwas fand“, wurde nicht mehr nachgesehen, welches Pokémon gemeint ist.
- **Behoben:** Bei Sprachen mit eigener Schrift (Japanisch, Koreanisch) wird ein Name in lateinischen Buchstaben immer auch als deutscher oder englischer Pokémon-Name verstanden; die Karten dieses Pokémon kommen zu den direkten Treffern dazu.
- **Bleibt, weil TCGdex es nicht hergibt:** Trainer- und Energiekarten haben keine Pokédex-Nummer und lassen sich nur unter ihrem japanischen Namen finden („Professor Eich“ findet nichts). Einige japanische Karten haben bei TCGdex keine Pokédex-Nummer (für Glurak 45 von 50) und fehlen deshalb. Von vielen japanischen Karten hat TCGdex kein Bild (rund 3.900 von 13.000 haben eines).
- **Geklärt (16.10.2026):** Henrik: „Die Karten sind nicht hinterlegt, tendenziell funktioniert es.“ Die Suche arbeitet richtig; es fehlen Karten und Bilder in den Daten von TCGdex. Das ist kein Fehler der App, sondern Punkt 40 (zweite Datenquelle).

### B-005 – „Enton“ findet bei englischen Karten kein Psyduck

- **Gemeldet:** Suche nach „Enton“, Sprache der Karten Englisch: keine Psyduck-Karten, „weil es eine Karte auf Englisch gibt, die enton mit im Namen hat“.
- **Nachgestellt (13.10.2026, TCGdex):** Die englische Suche nach „Enton“ findet genau eine Karte, „Professor Laventon“. Weil der Name damit etwas fand, wurde nicht mehr nachgesehen, ob er in einer anderen Sprache ein Pokémon ist. Über die Pokédex-Nummer gibt es 43 englische Psyduck-Karten. Derselbe Fehler wie B-003, dort nur für Japanisch behoben.
- **Behoben:** Findet ein Name in der eingestellten Sprache etwas, wird zusätzlich gefragt, ob er in einer anderen Sprache **genau** der Name eines Pokémon ist. Dann kommen dessen Karten zuerst, die Zufallstreffer dahinter. Ein Namensteil („Ento“) gilt nicht als Name, damit beim Tippen keine fremden Pokémon dazwischengeraten.
- **Nebenwirkung:** Je Suchbegriff eine zusätzliche Anfrage je anderer Sprache an TCGdex; die Antwort wird wie alle einen Tag aufbewahrt.
- **Offen:** Henriks Bestätigung.

### B-006 – Cover-Bild aus den eigenen Bildern; Löschen ohne erkennbaren Grund verweigert

- **Gemeldet:** Bei „Cover bearbeiten“ kann man kein Bild nehmen, das schon hochgeladen ist; und das Löschen hochgeladener Bilder gehe nicht mehr. Nachtrag von Henrik: Er hatte versucht, das Bild eines Covers zu löschen.
- **Nachgestellt (13.10.2026):** (1) Das Cover-Fenster kannte nur „Bild wählen“ als Datei-Upload, nie eine Auswahl aus den vorhandenen Bildern – das fehlte von Anfang an. (2) Das Löschen ging: Ein Bild, das noch gezeigt wird (hier als Cover), wird absichtlich nicht gelöscht. Der Hinweis dazu erschien aber oben in der Spalte, außer Sicht, und nannte nicht, wo das Bild steckt. So sah es aus, als passiere nichts.
- **Behoben:** (1) Das Cover-Fenster zeigt unter dem Upload die eigenen Bilder zum Anklicken. (2) Der Hinweis steht jetzt direkt am Bild und nennt jede Stelle: Cover oder Seite welches Binders, Box welches Decks.
- **Offen:** Henriks Bestätigung.
