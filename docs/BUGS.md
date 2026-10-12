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
| B-001 | 12.10.2026 | Henrik | Binder-Seiten mit vielen fehlenden (grauen) Karten laden langsam | offen |

### B-001 – Seiten mit vielen grauen Karten laden langsam

- **Beobachtung (Henrik):** Das lange Laden von Binder-Seiten hängt damit zusammen, dass das Graustellen der fehlenden Karten lange dauert, wenn es viele sind.
- **Wo:** noch nicht eingegrenzt (Gerät, Browser, welcher Binder).
- **Vermutung, nicht geprüft:** Fehlende Karten werden im Browser per Filter grau gezeichnet, und zwar auf den großen Kartenbildern. Bei einem frisch angelegten Master Set sind alle 18 Karten einer Doppelseite grau; dazu kommen die vorab geladenen Nachbarseiten. Ob wirklich der Filter bremst oder das Laden der großen Bilder, muss eine Messung zeigen.
- **Nächster Schritt:** nachmessen (Seite mit 18 grauen gegen 18 farbige Karten, am PC und am Handy), dann entscheiden.

## Behobene Fehler

| Nr. | Gemeldet | Von | Fehler | Behoben mit | Stand |
|---|---|---|---|---|---|
| – | 12.10.2026 | Henrik | Kartenbilder blieben in Suche, Binder und Info-Anzeige leer oder luden erst nach einem Fensterwechsel | `554a043` (TCGdex schickt eine Kopfzeile teils doppelt; Bilder werden jetzt schlicht angezeigt) | bestätigt |
| – | 12.10.2026 | Henrik | Menüs der Werkzeugleiste schlossen nicht bei einem Klick daneben | `6188e97` | bestätigt |
