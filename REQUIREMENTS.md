# PokéBinder – Requirements

Stand: 12.10.2026

## Ziel & Vision

Eine Web-App, in der ich die Seiten meines Pokémon-Karten-Binders digital plane: Karten aus einer vollständigen Datenbank suchen, frei in ein Seiten-Grid (z. B. 3×3) legen und leere Pockets mit eigenen Bildern gestalten. Vorbild ist [pkmnbindr.com](https://www.pkmnbindr.com) – ein kostenloser digitaler Binder für Michi-Method-Binder, Master Sets und eigene Layouts.

Das Ergebnis soll so nah wie möglich am echten Binder sein: Doppelseiten, echte Pocket-Anzahl, und am Ende ein Export, den ich drucken oder teilen kann.

Die App ist nur für mich. Diese Liste ist die Grundlage, aus der Claude Code die App Schritt für Schritt baut. Jede Anforderung muss deshalb ohne Rückfrage prüfbar sein.

## Was die Referenz kann

pkmnbindr bewirbt Michi-Method-Binder, Master Sets, eigene Layouts, englische und japanische Karten, Cloud-Sync und Kartensuche. Details unten sind aus der Beschreibung und vergleichbaren Tools abgeleitet.

| Feature | pkmnbindr | Ähnliche Tools | Für uns |
| --- | --- | --- | --- |
| Kartensuche in Datenbank | ja | ja | MVP |
| Grid-Layouts | eigene Layouts | ja ([dextcg](https://dextcg.com/help/collection/binder-display-mode)) | MVP (2×2, 3×3, 4×4) |
| Drag & Drop in Pockets | wahrscheinlich | ja ([AuraBinder](https://hunted.space/product/aurabinder)) | MVP |
| Eigene Bilder, auch über mehrere Pockets (Michi Method) | ja | ja ([Pokébinder](https://www.productcool.com/product/pokebinder)) | MVP |
| Master-Set-Binder automatisch aus einem Set | ja | – | MVP, mit Holo-Option |
| Mehrere Sprachen | EN + JP | ja | v1 (DE, EN, JP, KO) |
| PNG-Export | unklar | ja (AuraBinder) | v1 |
| Druckbare Platzhalter und Bildzuschnitte | unklar | ja (Pokébinder) | später (Proxy-Druck A4) |
| Holo-Effekt | unklar | ja (AuraBinder) | später |
| Preise | unklar | ja (AuraBinder) | später |
| Accounts + Cloud-Sync | ja | teils | nicht geplant |

Die Michi Method ist der Kern: Statt jede Tasche gleich zu füllen, mischt sie Einzelkarten, Bilder über mehrere Pockets und bewusst freie Fläche.

## Funktionale Anforderungen

Das MVP ist erreicht, wenn ich einen Binder leer oder als Master Set anlege, ihn mit Karten und eigenen Bildern gestalte, fehlende Karten markiere und die Fehlliste exportiere.

### MVP

1. **Binder anlegen (Assistent).** Beim Erstellen fragt die App: „Leerer Binder“ oder „Master Set“?
   - Immer: Name, Pocket-Layout (2×2, 3×3, 4×4; Standard 3×3) und Standard-Öffnungsseite der Pockets (links/rechts).
   - Master Set: Ich klicke ein Set aus einer Liste an, gruppiert nach Serie, mit Set-Logo und Kartenanzahl.
   - Checkbox „Mit Holo-Varianten“: an = jede Reverse-Holo- und Sonder-Reverse-Variante (z. B. Pokéball- oder Meisterball-Muster), die es im Set gibt, bekommt einen eigenen Pocket direkt hinter der Normalkarte.
   - Weitere Checkboxen: „Secret Rares“ und „Promos“, beide standardmäßig an. Promos kommen aus dem passenden Promo-Set und sind einzeln abwählbar.
   - Danach erzeugt die App so viele Seiten wie nötig in Set-Nummernreihenfolge, Promos am Ende.
2. **Nach Sets sortieren.** Suche und Kartenauswahl lassen sich nach Set filtern; jedes Set ist als komplette Liste in Nummernreihenfolge durchblätterbar.
   - Im Binder sortiert ein Befehl die Karten einer Seite oder des ganzen Binders nach Set und Nummer.
3. **Doppelseiten-Ansicht mit Cover.** Ich sehe immer eine linke und rechte Seite wie im aufgeschlagenen Binder und blättere per Pfeiltasten oder Buttons.
   - Der Binder hat ein Cover mit eigenem Bild und Titel.
   - Seite 1 steht allein rechts neben der Cover-Innenseite.
4. **Einschub-Richtung (Belegung).** Alle Pockets sind seitlich offen; pro Seite stelle ich ein, ob die Öffnung links oder rechts liegt.
   - Jeder Pocket zeigt seine Öffnung als dezente Markierung, auch im Export.
5. **Karten suchen.** Suche nach Name, Set und Nummer, Ergebnisse als Bild-Kacheln.
   - Filter: Set, Seltenheit, Typ, Sprache.
   - Ergebnisse erscheinen nach spätestens 300 ms Tipp-Pause.
6. **Karten platzieren.** Karte per Drag & Drop in einen Pocket ziehen.
   - Karten zwischen Pockets und Seiten verschieben; belegte Pockets tauschen beim Drop.
   - Pocket leeren per Rechtsklick, Entf-Taste oder Button „Pocket leeren“.
7. **Eigene Bilder.** Bild hochladen und in einen oder mehrere zusammenhängende Pockets legen.
   - Spannweite: 1 Pocket, horizontal oder vertikal über mehrere Pockets, ganze Seite.
   - Bildausschnitt per Verschieben und Zoom anpassbar.
   - Karten dürfen über einem Hintergrundbild liegen.
8. **Fehlende Karten markieren.** Ein Klick auf eine Karte (im Modus „Sammlung“) oder der Umschalter „Vorhanden / Fehlt“ markiert sie; fehlende Karten werden ausgegraut.
   - Fortschritt pro Binder sichtbar, z. B. 142 / 191 Karten.
9. **Fehlliste exportieren.** Checkliste aller fehlenden Karten mit Set, Nummer, Name, Variante und Seltenheit.
   - Als PDF mit anklickbaren Kästchen: am PC digital abhakbar und druckbar.
10. **Speichern.** Alles wird automatisch lokal gespeichert und ist nach Neuladen unverändert da.
11. **Backup.** Binder als JSON exportieren und wieder importieren.

### v1

- **Mehrsprachig:** Englisch, Japanisch, Koreanisch zusätzlich zu Deutsch; Sprache pro Binder voreinstellbar, pro Karte änderbar. Das MVP arbeitet nur mit deutschen Karten.
- **PNG-Export** einer Seite oder Doppelseite in hoher Auflösung; das ist der einzige Weg zum Teilen.
- **Undo/Redo** für alle Platzierungen.

### Später

- **Proxy-Karten drucken:** Schwarz-Weiß-Bild jeder fehlenden Karte als Platzhalter für den Binder.
  - Druck auf DIN A4 (210 × 297 mm) bei 100 % Skalierung; jede Karte exakt 63 × 88 mm.
  - 3×3 Karten pro Blatt (189 × 264 mm) mit Schnittmarken, Reihenfolge wie im Binder.
  - Optional: ganze Binder-Seite 1:1 drucken, inklusive Bildzuschnitte.
- Holo-Effekt beim Überfahren der Karte.
- Kartenpreise (Cardmarket).
- Fehlliste zusätzlich als Excel-Datei.

Nicht geplant: Accounts, Cloud-Sync und Teilen per Link, weil die App nur für mich ist.

## Design-Referenz

Das Mockup ist die verbindliche Vorlage für den Binder-Editor auf dem Desktop: dunkles Theme, violetter Akzent, drei Spalten. Die Kartenbilder darin sind Platzhalter; in der App kommen sie von TCGdex.

![Mockup des Binder-Editors: Suche links, Doppelseite in der Mitte, Auswahl rechts](docs/mockup.png)

| Bereich | Inhalt |
| --- | --- |
| Kopfzeile | Logo „PokéBinder“, Pfad Meine Binder / Binder-Name, rechts Speicherstatus und „Backup“ |
| Linke Spalte (Suche) | Tabs „Karten“ / „Eigene Bilder“, Suchfeld, Filter Set, Seltenheit, Typ, Sprache mit Flagge; Ergebnisse als 2-spaltiges Raster mit Name und Set · Nummer; Hinweis „Karten in einen Pocket ziehen“ |
| Mitte, Werkzeugleiste | Binder-Name, Layout-Auswahl (3 × 3), „Sortieren“, „Fehlliste als PDF“, „+ Seite“ als Hauptbutton |
| Mitte, Steuerung | Umschalter „Bearbeiten“ / „Sammlung“, Blätterpfeile mit „Seiten 4 – 5“, Zoom mit − / Prozent / + |
| Mitte, Binder | Doppelseite im dunklen Binder-Rahmen mit Ringen in der Mitte; leere Pockets zeigen Pokéball-Symbol und „Fehlt“; unter jeder Seite „Seite 4 · Öffnung rechts“ |
| Mitte, unten | Miniaturen aller Doppelseiten (aktuelle hervorgehoben), Fortschrittsbalken „142 / 191 Karten gesammelt · 49 fehlen“ |
| Rechte Spalte (Auswahl) | Vorschau der gewählten Karte mit Name und Nummer; Umschalter „Vorhanden“ / „Fehlt“; Seite und Position des Pockets; „Pocket leeren“ in Rot |
| Rechte Spalte (Seitengestaltung) | Öffnung links/rechts, „Bild hinzufügen“, „Bild über Pockets“ (1 × 1, 1 × 3, 3 × 3), „Ausschnitt anpassen“, „Cover bearbeiten“ |

**Gestaltungsregeln**

- Hintergrund fast schwarz mit leichtem Blaustich, Panels eine Stufe heller, dünne Trennlinien.
- Violett nur für Hauptaktion und aktive Zustände (gewählter Tab, Pocket, Miniatur, Umschalter); Rot nur für Löschen; Grün nur für „gespeichert“.
- Abgerundete Ecken an Buttons, Feldern und Pockets; serifenlose Schrift, Deutsch als UI-Sprache.
- Der Binder steht im Zentrum und nimmt den größten Platz ein; Seitenleisten sind fest, die Mitte skaliert mit dem Zoom.

**Zusätzliche Anforderungen aus dem Mockup**

- Modus „Sammlung“: ein Klick auf eine Karte schaltet Vorhanden/Fehlt, ohne Drag & Drop; „Bearbeiten“ ist der Gestaltungsmodus.
- Zoom für die Doppelseite (50–150 %).
- Miniatur-Leiste zum Springen zwischen Doppelseiten.
- Speicherstatus nur einmal anzeigen, oben rechts (im Mockup steht er zusätzlich unten links).

## Nicht-funktionale Anforderungen

- **Plattform:** läuft im Browser auf Desktop und Tablet; Smartphone nur Ansicht und einfaches Platzieren.
- **Performance:** Seitenwechsel unter 100 ms; Kartenbilder lazy laden, kleine Bilder in der Suche, große nur im Binder.
- **Offline:** bereits gesehene Kartendaten und Bilder werden gecacht; die App startet ohne Netz.
- **Datenhaltung:** lokal im Browser (IndexedDB), kein eigener Server.
- **Hosting:** statisch (z. B. Vercel oder GitHub Pages).
- **Rechtliches:** privates, nicht-kommerzielles Projekt. Kartenbilder stammen von The Pokémon Company; Hinweis im Footer, dass die App nicht offiziell ist.
- **Qualität:** TypeScript strikt, automatisierte Tests für Datenmodell und Drag-&-Drop-Logik, Linting.

## Datenquelle & Datenmodell

Kartendaten kommen von [TCGdex](https://github.com/tcgdex), weil es Deutsch, Japanisch und weitere Sprachen abdeckt. Fürs Frontend gibt es das JS-SDK [@tcgdex/sdk](https://www.npmjs.com/package/@tcgdex/sdk). Kartenbilder werden per URL geladen, nicht mitgeliefert. Englisch-only-Alternative: [pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data).

Die App speichert nur Verweise auf Karten (Karten-ID + Sprache + Variante), nie die Kartendaten selbst.

| Entität | Felder | Hinweis |
| --- | --- | --- |
| Binder | id, name, mode (`empty` \| `masterSet`), setId?, withReverseHolo, withSecretRares, withPromos, layout (`2x2` \| `3x3` \| `4x4`), cover (title, assetId?), pages[], createdAt, updatedAt | Wurzel, als JSON exportierbar |
| Page | id, index, openingSide (`left` \| `right`), slots[], images[] | slots.length = rows × cols |
| Slot | index, cardRef?, owned | owned = false heißt „fehlt“ |
| CardRef | cardId (z. B. `swsh3-136`), lang, variant (`normal` \| `reverse` \| `holo` \| `pokeball` \| `masterball`) | löst über TCGdex auf |
| PlacedImage | id, assetId, fromSlot, spanCols, spanRows, crop (x, y, zoom) | liegt hinter den Karten |
| Asset | id, blob, mimeType, width, height | hochgeladene Bilder und Cover, in IndexedDB |

Welche Varianten eine Karte hat, liest die App aus den TCGdex-Kartendaten; daraus entstehen beim Master Set die Holo-Pockets.

## Tech-Stack

Ein reines Frontend ohne eigenen Server reicht für MVP und v1.

| Bereich | Wahl | Warum |
| --- | --- | --- |
| Framework | React + TypeScript + Vite | verbreitet, gut dokumentiert |
| Drag & Drop | dnd-kit | unterstützt Maus, Touch und Tastatur |
| State | Zustand | wenig Boilerplate, einfaches Undo/Redo |
| Speicherung | IndexedDB über Dexie | große Bilder lokal speicherbar |
| Kartendaten | @tcgdex/sdk | mehrsprachig, mit TypeScript-Typen |
| Styling | Tailwind CSS | schnelle, konsistente UI |
| PDF | pdf-lib | Fehlliste mit anklickbaren Checkboxen (Formularfelder) |
| Export | html-to-image | PNG der Doppelseite (v1) |
| Tests | Vitest + Playwright | Logik und echte Klickpfade |

## Umsetzung mit Claude Code

Claude Code baut die App in sieben Phasen nacheinander; jede endet mit einer Definition of Done, die ich prüfe, bevor die nächste startet. Nach Phase 5 ist das MVP fertig.

| Phase | Arbeitspaket | Definition of Done |
| --- | --- | --- |
| 0 Setup | Vite-Projekt, TypeScript strikt, Tailwind, Linting, Vitest, Playwright, Grundlayout mit drei Spalten laut Mockup | Build, Lint und Tests laufen grün; leere App zeigt das Drei-Spalten-Layout im dunklen Theme |
| 1 Datenmodell | Typen laut Datenmodell, Zustand-Store, Dexie-Speicherung, JSON-Backup | Unit-Tests: Binder anlegen, Seite hinzufügen, Karte setzen; Export und Re-Import ergeben denselben Binder |
| 2 Kartensuche & Sets | TCGdex-Anbindung, Set-Liste nach Serie, Set-Ansicht in Nummernreihenfolge, Suche mit Filtern, Cache | Suche nach „Glurak“ liefert deutsche Karten mit Bild; ein Set zeigt alle Karten in Nummernreihenfolge |
| 3 Binder-Editor | Doppelseite, Cover, Layouts 2×2/3×3/4×4, Einschub-Markierung, Blättern, Zoom, Miniatur-Leiste, Drag & Drop, Sortieren nach Set | Playwright-Test: Karte aus Suche in Pocket ziehen, neu laden, Karte ist noch da |
| 4 Eigene Bilder | Upload, Spannweite, Zuschnitt, Ebene hinter Karten, Cover-Bild | Bild über 3 Pockets legen, Karte darüber setzen; Backup erhält beides |
| 5 Master Set & Fehlliste | Assistent „Leer / Master Set“, Optionen Holo/Sonder-Reverse, Secret Rares, Promos, Modus „Sammlung“, Fehlt-Markierung, Fortschritt, PDF-Export mit abhakbaren Kästchen | Master Set eines Sets mit und ohne Holo erzeugen; Kartenzahl stimmt mit TCGdex überein; Fehlliste enthält genau die als fehlend markierten Karten |
| 6 v1 | Sprachen, PNG-Export, Undo/Redo | je Feature ein Playwright-Test |

## Offene Datenfragen (vor Phase 2 prüfen und mir melden)

- [ ] Deckt TCGdex koreanische Karten vollständig ab?
- [ ] Unterscheidet TCGdex Sonder-Reverse wie Pokéball- und Meisterball-Muster? Falls nicht: Varianten pro Set manuell ergänzbar machen.
- [ ] Wie lassen sich Promos zuverlässig einem Set zuordnen (z. B. über Erscheinungszeitraum oder Set-Kennung)?
