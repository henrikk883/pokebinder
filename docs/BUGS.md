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
| B-001 | 12.10.2026 | Henrik | Binder-Seiten mit vielen fehlenden (grauen) Karten laden langsam | offen – lässt sich an Henriks PC im Testbrowser nicht nachstellen; Vergleich mit `?grau=aus` durch Henrik steht aus |

### B-001 – Seiten mit vielen grauen Karten laden langsam

- **Beobachtung (Henrik):** Das lange Laden von Binder-Seiten hängt damit zusammen, dass das Graustellen der fehlenden Karten lange dauert, wenn es viele sind.
- **Wo:** noch nicht eingegrenzt (Gerät, Browser, welcher Binder).
- **Vermutung, nicht geprüft:** Fehlende Karten werden im Browser per Filter grau gezeichnet, und zwar auf den großen Kartenbildern. Bei einem frisch angelegten Master Set sind alle 18 Karten einer Doppelseite grau; dazu kommen die vorab geladenen Nachbarseiten. Ob wirklich der Filter bremst oder das Laden der großen Bilder, muss eine Messung zeigen.
- **Messung am 12.10.2026 (Chrome, PC, echte Bilder von TCGdex, Master Set „151“, je 12-mal blättern, Bilder schon geladen):**
  - Bis alle 18 Karten einer Doppelseite geladen und dekodiert sind: grau im Schnitt 96 ms, dieselben Karten ohne Filter 97 ms. Auch mit vier- und sechsfach gedrosseltem Prozessor kein Unterschied (rund 250 bzw. 400 ms in beiden Fällen).
  - Zeichnen abseits des Hauptfadens, aus einer Browser-Aufzeichnung: grau 53 ms, farbig 40 ms – für alle zwölf Blättervorgänge zusammen. Der Filter kostet also messbar, aber rund 1 ms je Blättern.
  - **Ergebnis:** In Chrome am PC ist der Graufilter nicht die Ursache. Nicht gemessen: Safari auf iPhone und iPad, wo solche Filter erfahrungsgemäß teurer sind, und das erstmalige Laden der Bilder über das Netz.
- **Wahrscheinlicher:** Graue Seiten sind die Seiten großer Master Sets, die man zum ersten Mal durchblättert; dort lädt jede Karte ein großes Bild (60–125 KB), und TCGdex braucht für ein selten abgerufenes Bild bis zu 0,7 s.
- **Vorschlag:** Jede Karte zuerst mit dem kleinen Bild zeigen (16–30 KB, oft schon von der Suche her da) und das große nachladen. Das hilft, wo immer die Ursache liegt.
- **Henrik dazu (12.10.2026):** am Handy und am PC, auch beim zweiten Aufschlagen; nur wenn fast alles grau ist, bei wenigen grauen Karten und ganz ohne Graufilter nicht.
- **Zweite Messung, mit Grafikkarte:** an Henriks PC (Chromium mit eingeschalteter Grafikbeschleunigung), gemessen wurde, wann sich das Bild auf dem Schirm nach dem Blättern nicht mehr ändert. Grau 54 ms, farbig 55 ms; auch bei 140 % Zoom auf einem hochauflösenden Schirm und in den Sets „Erhabene Helden“ und „Weiße Flammen“ kein Unterschied. **Der Fehler lässt sich hier nicht nachstellen.**
- **Was sich zwischen der Messung und Henriks Alltag unterscheidet:** sein Browser, die Fassung im Netz mit dem Bilder-Vorrat, seine echten, sehr großen Binder (bis 613 Karten) und Seiten weiter hinten im Binder.
- **Nächster Schritt:** Henrik vergleicht denselben Binder mit und ohne Graufilter – mit `?grau=aus` hinter der Adresse zeigt die App fehlende Karten farbig – und nennt Browser und Binder. Erst danach wird etwas geändert.

## Behobene Fehler

| Nr. | Gemeldet | Von | Fehler | Behoben mit | Stand |
|---|---|---|---|---|---|
| B-002 | 12.10.2026 | Henrik | Die Suche fand ein Pokémon nur unter dem Namen in der eingestellten Kartensprache („psyduck“ fand bei Deutsch nichts) | `fba67f8`, Einzelheiten unten | bestätigt |
| – | 12.10.2026 | Henrik | Kartenbilder blieben in Suche, Binder und Info-Anzeige leer oder luden erst nach einem Fensterwechsel | `554a043` (TCGdex schickt eine Kopfzeile teils doppelt; Bilder werden jetzt schlicht angezeigt) | bestätigt |
| – | 12.10.2026 | Henrik | Menüs der Werkzeugleiste schlossen nicht bei einem Klick daneben | `6188e97` | bestätigt |

### B-002 – Suche fand Pokémon nur in der eingestellten Sprache (behoben)

- **Was jetzt gilt:** Findet die Suche unter dem eingetippten Namen nichts, fragt sie die anderen Sprachen, welches Pokémon gemeint ist, und zeigt dessen Karten in der eingestellten Sprache. „psyduck“ zeigt bei Deutsch die Enton-Karten, „glurak“ bei Englisch die Charizard-Karten. Set, Seltenheit, Typ und Nummer wirken wie sonst („mewtwo 150“).
- **Gegen das echte TCGdex geprüft:** psyduck → 32 Enton-Karten, charizard → Glurak, lucario → Lucario, snorlax → Relaxo, „mewtwo 150“ → Mewtu; umgekehrt glurak → Charizard.
- **Grenzen:**
  - Nur Pokémon. Trainer- und Energiekarten haben keine Pokédex-Nummer, über die sich die Sprachen verbinden lassen: „professor's research“ findet bei Deutsch weiterhin nichts.
  - Die andere Sprache wird nur gefragt, wenn der Name so, wie er getippt wurde, gar nichts findet. Findet er zufällig etwas anderes, bleibt es dabei: „Enton“ zeigt bei Englisch „Professor Laventon“, weil der Name darin steckt.
