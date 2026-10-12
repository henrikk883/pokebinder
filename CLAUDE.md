# CLAUDE.md – PokéBinder

Private Web-App zum Planen von Pokémon-Karten-Bindern: Karten aus TCGdex suchen, per Drag & Drop in Binder-Seiten legen, eigene Bilder über Pockets spannen, Master Sets erzeugen und fehlende Karten als PDF-Checkliste exportieren.

## Quellen der Wahrheit

- `REQUIREMENTS.md` – alle Anforderungen, Datenmodell, Stack und die Phasen mit Definition of Done. Bei Widerspruch gilt REQUIREMENTS.md.
- `docs/mockup.png` – verbindliche Vorlage für Layout und Optik. Vor jeder UI-Arbeit ansehen.
- `docs/DECISIONS.md` – hier jede Entscheidung festhalten, die REQUIREMENTS.md offen lässt (Datum, Entscheidung, Grund, ein bis zwei Zeilen).

## Arbeitsweise

- Immer genau **eine Phase** aus REQUIREMENTS.md bearbeiten, nie vorgreifen.
- Zu Beginn einer Phase: kurzen Plan zeigen (Dateien, Komponenten, Tests) und auf mein OK warten.
- Am Ende einer Phase: Lint, Tests und Build ausführen; erst bei Grün committen. Dann berichten: was gebaut wurde, wie ich die Definition of Done selbst prüfe (konkrete Klickschritte) und was offen ist. Danach stoppen.
- Unklare Anforderung → nachfragen statt raten. Kleine Detailentscheidungen selbst treffen und in `docs/DECISIONS.md` notieren.
- Vor Phase 2 die offenen Datenfragen aus REQUIREMENTS.md mit echten TCGdex-Abfragen klären und mir das Ergebnis melden.

## Stack (fest)

React + TypeScript + Vite, Tailwind CSS, Zustand, Dexie (IndexedDB), dnd-kit, @tcgdex/sdk, pdf-lib, Vitest, Playwright; html-to-image erst ab v1.
Keine weiteren Abhängigkeiten ohne Rückfrage. Kein Backend, keine Accounts, kein Tracking, keine externen Dienste außer TCGdex und dessen Bild-URLs. Ausnahmen: Kartenbilder von `images.pokemontcg.io` als Ersatz für Karten, von denen TCGdex gar kein Bild hat (nur Bilddateien, keine Kartendaten); und das Hosting der fertigen App als statische Dateien bei Cloudflare (`wrangler.jsonc`), damit sie auch unterwegs erreichbar ist – weiterhin ohne Server-Code, die Daten bleiben im Browser des Geräts.

## Befehle

- `npm run dev` – Entwicklungsserver
- `npm run build` – Produktions-Build
- `npm run lint` – ESLint + `tsc --noEmit`
- `npm test` – Vitest
- `npm run test:e2e` – Playwright

## Struktur

```
src/
  app/          App-Shell, Layout (Kopfzeile, drei Spalten)
  features/
    search/     Kartensuche, Filter, Set-Liste
    binder/     Doppelseite, Pockets, Drag & Drop, Miniaturen, Zoom
    images/     Upload, Spannweite, Zuschnitt
    masterset/  Assistent, Set-Auswahl, Seitengenerierung
    export/     JSON-Backup, PDF-Fehlliste, später PNG
  store/        Zustand-Stores
  db/           Dexie-Schema und Zugriff
  lib/tcgdex/   einziger Zugriffspunkt auf TCGdex inkl. Cache
  types/        Typen laut Datenmodell
  i18n/de.ts    alle UI-Texte
tests/e2e/      Playwright-Tests
```

## Regeln für den Code

- TypeScript strikt, kein `any`. Bezeichner im Code auf Englisch, UI-Texte auf Deutsch und nur in `src/i18n/de.ts`.
- Binder speichern nur `CardRef` (cardId, lang, variant), nie Kartendaten aus TCGdex.
- Jeder TCGdex-Aufruf läuft über `src/lib/tcgdex/`; Antworten und Bilder werden gecacht.
- Reine Logik (Seiten erzeugen, sortieren, Spannweiten prüfen, Fehlliste bauen) in Funktionen ohne React, mit Unit-Tests.
- Farben, Radien und Abstände als Tailwind-Theme-Tokens: dunkler Hintergrund mit Blaustich, Violett nur für Hauptaktion und aktive Zustände, Rot nur für Löschen, Grün nur für „gespeichert“.
- Footer-Hinweis: inoffizielles Fanprojekt, Kartenbilder © The Pokémon Company.
- Commits pro Phase oder Teilschritt, Format `feat(phase-N): kurze Beschreibung`.
