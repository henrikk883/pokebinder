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

## 2026-10-12 – Fehler beim Speichern oder Import ohne Rot
Meldungen erscheinen in neutraler Textfarbe, weil Rot dem Löschen vorbehalten ist.
