# CLAUDE.md – PokéBinder

Private Web-App zum Planen von Pokémon-Karten-Bindern: Karten aus TCGdex suchen, per Drag & Drop in Binder-Seiten legen, eigene Bilder über Pockets spannen, Master Sets erzeugen und fehlende Karten als PDF-Checkliste exportieren.

## Quellen der Wahrheit

- `REQUIREMENTS.md` – alle Anforderungen, Datenmodell, Stack und die Phasen mit Definition of Done. Bei Widerspruch gilt REQUIREMENTS.md.
- `docs/mockup.png` – verbindliche Vorlage für Layout und Optik. Vor jeder UI-Arbeit ansehen.
- `docs/BUGS.md` – die Fehlerliste: jeder gemeldete Fehler mit Stand, bis er behoben und bestätigt ist (seit 12.10.2026; neben Henrik nutzen drei Freunde die App).
- `docs/DECISIONS.md` – hier jede Entscheidung festhalten, die REQUIREMENTS.md offen lässt (Datum, Entscheidung, Grund, ein bis zwei Zeilen).

## Arbeitsweise

- Immer genau **eine Phase** aus REQUIREMENTS.md bearbeiten, nie vorgreifen.
- Zu Beginn einer Phase: kurzen Plan zeigen (Dateien, Komponenten, Tests) und auf mein OK warten.
- Am Ende einer Phase: Lint, Tests und Build ausführen; erst bei Grün committen. Dann berichten: was gebaut wurde, wie ich die Definition of Done selbst prüfe (konkrete Klickschritte) und was offen ist. Danach stoppen.
- Unklare Anforderung → nachfragen statt raten. Kleine Detailentscheidungen selbst treffen und in `docs/DECISIONS.md` notieren.
- Vor Phase 2 die offenen Datenfragen aus REQUIREMENTS.md mit echten TCGdex-Abfragen klären und mir das Ergebnis melden.

## Stack (fest)

React + TypeScript + Vite, Tailwind CSS, Zustand, Dexie (IndexedDB), dnd-kit, @tcgdex/sdk, pdf-lib (mit @pdf-lib/fontkit für die japanische Schrift), Vitest, Playwright; html-to-image erst ab v1.
Dazu, von Henrik am 12.10.2026 freigegeben, ein Bildmodell nur für das Auswertungsskript (`scripts/looks/` mit eigener `package.json`: @huggingface/transformers, lädt das Modell einmalig von Hugging Face); die App selbst bekommt davon nur die Ergebnisdateien. Keine weiteren Abhängigkeiten ohne Rückfrage. Kein Tracking, keine externen Dienste außer TCGdex und dessen Bild-URLs sowie den unten genannten Ausnahmen. Die App bleibt ohne Anmeldung und ohne Netz benutzbar; alles liegt zuerst lokal im Browser. Ausnahmen: Kartenbilder von `images.pokemontcg.io` als Ersatz für Karten, von denen TCGdex gar kein Bild hat (nur Bilddateien, keine Kartendaten); und das Hosting der fertigen App als statische Dateien bei Cloudflare (`wrangler.jsonc`), damit sie auch unterwegs erreichbar ist – und – seit dem 12.10.2026, von Henrik gewünscht – ein kleiner Server-Teil dort (`worker/`, Cloudflare Workers mit D1 und R2), über den sich Binder, Bilder und Merklisten zwischen den Geräten eines Sammlers abgleichen. Angemeldet wird per E-Mail-Code über Cloudflare Access, nur für freigeschaltete Adressen (Henrik und wenige Freunde); eigene Passwörter oder eine offene Registrierung gibt es nicht. Seit dem 12.10.2026, ebenfalls von Henrik gewünscht: Ein Sammler kann einen Binder per Link teilen; wer den Link hat, darf genau diesen Binder und dessen Bilder ohne Anmeldung ansehen (`/shared/`), sonst nichts, und nichts ändern. Der Sammler kann den Link jederzeit zurückziehen.

## Befehle

- `npm run dev` – Entwicklungsserver
- `npm run build` – Produktions-Build
- `npm run lint` – ESLint + `tsc --noEmit`
- `npm test` – Vitest
- `npm run test:e2e` – Playwright
- `npm run colours` – neue Kartenbilder auswerten: Farben, Bildmodell, Themen (nach jedem neuen Set)

## Struktur

```
src/
  app/          App-Shell, Layout (Kopfzeile, drei Spalten)
  features/
    search/     Kartensuche, Filter, Set-Liste
    binder/     Doppelseite, Pockets, Drag & Drop, Miniaturen, Zoom
    images/     Upload, Spannweite, Zuschnitt
    masterset/  Assistent, Set-Auswahl, Seitengenerierung
    decks/      Decks zum Spielen: Regal, Deck-Ansicht, Regeln (seit 12.10.2026, von Henrik gewünscht)
    sync/       Anmelden und Abgleich zwischen Geräten
    share/      Binder per Link teilen und geteilte Binder ansehen
    import/     Kartenlisten einlesen (kopierte Cardmarket-Wunschliste)
    landing/    Startseite
    similar/    Ähnliche Karten und Themen (Daten aus `npm run colours` in public/colours/)
    export/     JSON-Backup, PDF-Fehlliste, später PNG
  store/        Zustand-Stores
  db/           Dexie-Schema und Zugriff
  lib/tcgdex/   einziger Zugriffspunkt auf TCGdex inkl. Cache
  types/        Typen laut Datenmodell
  i18n/de.ts    alle UI-Texte
worker/         Server-Teil bei Cloudflare: API unter /api/ für den Abgleich zwischen Geräten
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
