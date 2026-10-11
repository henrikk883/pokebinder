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
