# Entscheidungen

Entscheidungen, die REQUIREMENTS.md offen lässt. Neueste unten.

## 2026-10-12 – Fußleiste zeigt den Rechtshinweis, nicht den Speicherstatus
Die untere Leiste aus dem Mockup trägt den Footer-Hinweis (inoffizielles Fanprojekt, © The Pokémon Company). Der Speicherstatus steht nur oben rechts, wie in REQUIREMENTS.md verlangt.

## 2026-10-12 – Sprachfilter bis v1 sichtbar, aber fest auf „Deutsch“
Das Mockup zeigt den Filter, das MVP kennt nur deutsche Karten. Er wird ab Phase 2 deaktiviert angezeigt und in v1 freigeschaltet.

## 2026-10-12 – Tailwind 4 mit Theme-Tokens in CSS
Farben, Radien und Abstände stehen als `@theme`-Tokens in `src/index.css`; eine `tailwind.config.js` gibt es nicht. Grund: Standardweg von Tailwind 4 über `@tailwindcss/vite`.

## 2026-10-12 – Systemschrift statt Webfont
Serifenlose Systemschrift, kein nachgeladener Font. Grund: keine externen Dienste außer TCGdex, und die App soll offline starten.

## 2026-10-12 – Zusätzliche Dev-Pakete für Tests und Lint
`@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@types/node` sowie die ESLint-Plugins für React Hooks und React Refresh. Grund: Komponententests in Vitest und Typen für die Konfigurationsdateien; von Henrik am 12.10.2026 freigegeben.

## 2026-10-12 – Phase 0 baut nur das Desktop-Layout
Feste Seitenleisten (300 px), Mitte flexibel. Das Verhalten auf Tablet und Smartphone folgt, sobald die Spalten Inhalt haben.

## 2026-10-12 – Playwright nur mit Chromium
Grund: private App für einen Nutzer; weitere Browser bei Bedarf.

## 2026-10-12 – `Binder.defaultOpeningSide` ergänzt
Der Assistent fragt eine Standard-Öffnungsseite ab, das Datenmodell hatte dafür kein Feld. Neue Seiten übernehmen diesen Wert. Von Henrik bestätigt.

## 2026-10-12 – Leere Pockets zählen nicht zum Fortschritt
Nur Pockets mit Karte sind „vorhanden“ oder „fehlt“; leere Pockets tauchen weder im Fortschritt noch in der Fehlliste auf (Beispiel: 4 / 6 statt 4 / 9). Von Henrik entschieden.

## 2026-10-12 – Von Hand platzierte Karten starten als „vorhanden“
Beim automatisch erzeugten Master Set starten dagegen alle Karten als „fehlt“. Von Henrik entschieden.

## 2026-10-12 – Seiten lassen sich löschen
Als Gegenstück zu „+ Seite“; die übrigen Seiten werden neu durchnummeriert. Von Henrik bestätigt.

## 2026-10-12 – Ein neuer Binder beginnt mit einer Seite
Grund: Seite 1 steht laut Anforderung allein neben der Cover-Innenseite, ein Binder ohne Seite hätte nichts anzuzeigen.

## 2026-10-12 – Zeitstempel als ISO-8601-Text
`createdAt` und `updatedAt` sind Strings wie `2026-10-12T10:00:00.000Z`. Grund: im JSON-Backup lesbar und ohne Umwandlung sortierbar.

## 2026-10-12 – Backup-Format: eine JSON-Datei mit Bildern als Base64
Aufbau `{ format: "pokebinder-backup", version: 1, exportedAt, binder, assets[] }`. Die Datei wird beim Import vollständig geprüft; unbekannte Felder fallen weg. Grund: ein Binder samt eigenen Bildern soll in einer einzigen Datei liegen.

## 2026-10-12 – Import ersetzt einen Binder mit derselben ID
Ein Backup stellt den gesicherten Stand wieder her, statt eine Kopie anzulegen. Grund: Export und Re-Import sollen denselben Binder ergeben.

## 2026-10-12 – Speichern sofort statt verzögert
Jede Änderung wird direkt geschrieben; laufen Änderungen während eines Schreibvorgangs ein, folgt genau ein weiterer. Grund: kein Datenverlust beim Neuladen kurz nach einer Änderung.

## 2026-10-12 – Beim Start öffnet die App den zuletzt geänderten Binder
Gilt, bis es die Übersicht „Meine Binder“ gibt.

## 2026-10-12 – Dev-Paket `fake-indexeddb`
Simuliert IndexedDB in den Unit-Tests der Dexie-Speicherung. Von Henrik freigegeben.

## 2026-10-12 – Ergebnis der offenen Datenfragen (TCGdex, abgefragt am 12.10.2026)
- Koreanisch: 95 Sets gelistet, aber nur 239 Karten abrufbar und keine mit Bild. Für v1 praktisch nicht nutzbar; Japanisch ist vollständig.
- Sonder-Reverse: `variants_detailed` nennt Typ und Muster (Pokéball, Meisterball, Kosmos) sowie Stempel-Varianten. Keine manuelle Ergänzung nötig; welche Muster ins Master Set gehören, wird in Phase 5 entschieden.
- Promos: hängen nur am Promo-Set der Serie (z. B. `svp`), eine Zuordnung zu einem Hauptset gibt es nicht. Der Assistent bietet in Phase 5 die Promos der Serie zur Einzelauswahl an.

## 2026-10-12 – Karten ohne deutsches Bild zeigen das englische in Schwarz-Weiß
Viele deutsche Promo- und Untersets haben bei TCGdex keine Scans. Dann lädt die App das englische Bild derselben Karte und legt einen Graustufen-Filter darüber, damit erkennbar bleibt, dass es nicht die deutsche Karte ist (in einer Stichprobe für 401 von 927 Karten vorhanden). Gibt es auch das nicht, erscheint ein grauer Platzhalter mit Pokéball und Name. Karten werden nie ausgeblendet, damit sie im Master Set nicht fehlen. Von Henrik entschieden.

## 2026-10-12 – Set-Logo: deutsch, sonst englisch, sonst keines
Nur 38 von 155 deutschen Sets haben ein Logo. Von Henrik bestätigt.

## 2026-10-12 – Karten aus „Pokémon TCG Pocket“ sind ausgeblendet
Serie `tcgp`, ihre Sets und ihre Seltenheitsstufen tauchen nirgends auf, weil es die Karten nur im Handyspiel gibt. Von Henrik bestätigt.

## 2026-10-12 – TCGdex-Antworten liegen 24 Stunden in IndexedDB
Danach wird neu geladen; schlägt das fehl, gilt der alte Stand weiter. Der eigene Cache des SDK (localStorage, 1 Stunde) ist abgeschaltet. Bilder cacht vorerst nur der Browser; ein Service Worker für den Start ohne Netz folgt als eigener Schritt am Ende des MVP.

## 2026-10-12 – Suchfeld deutet Zahlen als Kartennummer
„Pikachu 25“ sucht Name und Nummer. Eine Nummer wie auf der Karte („188/125“) sucht in allen Sets mit dieser offiziellen Kartenanzahl und findet so die eine Karte. Eine Nummer ganz allein („25“) braucht ein gewähltes Set oder einen Namen, sonst träfe sie Karten in jedem Set. Nach Sets wird über die Set-Auswahl gefiltert, nicht über das Textfeld. Von Henrik so gewünscht.

## 2026-10-12 – Suche über alle Sets ab zwei Buchstaben, 60 Karten pro Seite
Weitere Treffer über „Mehr laden“. Karten mit Bild stehen vor Karten ohne Bild; innerhalb eines Sets gilt die Nummernreihenfolge.

## 2026-10-12 – Seltenheiten mit Komma werden über die Seltenheitsliste gefiltert
TCGdex wertet ein Komma im Filter als „oder“. Für Stufen wie „Selten, Illustration“ holt die App deshalb die Kartenliste dieser Seltenheit und gleicht ab.

## 2026-10-12 – Playwright-Tests spielen aufgezeichnete TCGdex-Antworten ab
Aufzeichnung mit `node tests/fixtures/tcgdex/record.mjs`. Grund: Tests sollen nicht vom Netz oder von Datenänderungen bei TCGdex abhängen.

## 2026-10-12 – Fehler beim Speichern oder Import ohne Rot
Meldungen erscheinen in neutraler Textfarbe, weil Rot dem Löschen vorbehalten ist.
