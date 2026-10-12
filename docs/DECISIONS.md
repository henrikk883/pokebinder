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

## 2026-10-12 – Karten ohne deutsches Bild zeigen das englische
Viele deutsche Promo- und Untersets haben bei TCGdex keine Scans. Dann lädt die App das englische Bild derselben Karte (in einer Stichprobe für 401 von 927 Karten vorhanden), in Farbe. Gibt es auch das nicht, erscheint ein grauer Platzhalter mit Pokéball und Name. Karten werden nie ausgeblendet, damit sie im Master Set nicht fehlen. Von Henrik entschieden.

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

## 2026-10-12 – Schwarz-Weiß heißt „fehlt“, englische Ersatzbilder sind farbig
Henrik hat klargestellt: Schwarz-Weiß ist den Karten vorbehalten, die im Binder als fehlend markiert sind. Englische Ersatzbilder erscheinen deshalb in Farbe; zuerst hatte ich sie in Graustufen gezeigt.

## 2026-10-12 – „Fehlt“ per Knopf auf der Karte, schon in Phase 3
Beim Überfahren einer Karte im Binder erscheint ein kleiner Knopf, der sie als fehlend markiert; dasselbe geht über „Vorhanden / Fehlt“ in der rechten Spalte. Von Henrik gewünscht und deshalb aus Phase 5 vorgezogen. Modus „Sammlung“, Fortschritt und Fehlliste bleiben in Phase 5.

## 2026-10-12 – Einfacher Dialog „Neuer Binder“ und Liste „Meine Binder“
Name, Layout und Öffnungsseite; der Assistent mit „Master Set“ folgt in Phase 5. Ohne offenen Binder zeigt die Mitte die Liste aller Binder (öffnen, löschen). Grund: Ohne beides wäre der Editor nicht benutzbar.

## 2026-10-12 – Seitenzählung nach dem Text, nicht nach dem Mockup
Seite 1 steht allein rechts neben der Cover-Innenseite, danach 2–3, 4–5 usw. Von Henrik bestätigt.

## 2026-10-12 – Layout-Wechsel verteilt die Karten neu
Die Karten behalten ihre Reihenfolge und fließen auf so viele Seiten wie nötig; vorhandene Seiten bleiben. Platzierte Bilder gehen dabei verloren, weil ihre Spannweite zum alten Raster gehört. Bei gefülltem Binder fragt die App vorher nach. Von Henrik bestätigt.

## 2026-10-12 – Öffnungs-Markierung: helle Kante am offenen Rand
Jeder Pocket zeigt am offenen Rand eine dünne, helle Linie. Von Henrik bestätigt.

## 2026-10-12 – Dritte Öffnungsart „gemischt“
Zusätzlich zu links und rechts: wie bei vielen gekauften Bindern öffnet die äußere Spalte zur Mitte, alle anderen nach außen. Auf ungeraden (rechten) Seiten ergibt das bei 3 × 3 je Reihe rechts, rechts, links; auf geraden (linken) Seiten rechts, links, links. Bei 2 × 2 und 4 × 4 gilt dieselbe Regel. Die Richtung jedes Pockets wird aus Seitennummer und Spalte berechnet, nicht gespeichert; rückt eine Seite durch Löschen auf die andere Buchseite, dreht sich das Muster mit. Von Henrik gewünscht.

## 2026-10-12 – Karten aus der Suche kommen als Variante „normal“ in den Binder
Die Wahl der Variante (Reverse, Holo usw.) folgt mit dem Master Set in Phase 5.

## 2026-10-12 – Sortieren schiebt die Karten nach vorn
Sortiert wird nach Erscheinungsreihenfolge der Sets, dann Nummer, dann Variante. Die Karten rücken in die ersten Pockets der Seite bzw. des Binders, Lücken wandern ans Ende.

## 2026-10-12 – Kartendaten im Binder kommen über die Set-Liste
Für eine Karte im Pocket lädt die App die Kartenliste ihres Sets (eine Abfrage für alle Karten des Sets) statt jede Karte einzeln. Grund: ein Master Set braucht so eine Abfrage statt hunderter.

## 2026-10-12 – Zoom-Standard 80 %, Schritte von 5 %
Bei 80 % passt die Doppelseite auf einem 1440 px breiten Bildschirm ohne Scrollen zwischen die Seitenleisten.

## 2026-10-12 – Drag & Drop vorerst nur mit der Maus
Ein Ziehen beginnt nach 6 px Bewegung, damit ein Klick die Karte auswählt. Touch- und Tastaturbedienung für das Ziehen sind noch offen.

## 2026-10-12 – Rückfragen über den Browser-Dialog
Seite löschen, Binder löschen und Layout ändern fragen per `window.confirm` nach. Grund: einfach und zuverlässig; ein eigener Dialog im App-Design kann später folgen.

## 2026-10-12 – Bildgröße frei in Pockets statt dreier fester Knöpfe
„Breite“ und „Höhe“ sind Auswahlfelder in Pockets, dazu „Ganze Seite“. Das Mockup zeigt nur 1 × 1, 1 × 3 und 3 × 3; so sind auch 2 × 1 und die Layouts 2 × 2 und 4 × 4 abgedeckt. Von Henrik bestätigt.

## 2026-10-12 – Bilder dürfen auf einer Doppelseite über beide Seiten reichen
Ein Bild, das auf einer linken Seite (gerade Seitenzahl) beginnt, kann über die Ringe auf die rechte Seite reichen, z. B. 6 breit und 1 hoch. Auf Seite 1 geht das nicht, weil sie allein neben dem Cover liegt; von einer rechten Seite aus ebenfalls nicht. Gespeichert wird das Bild auf der linken Seite mit einer Breite, die größer ist als die verbleibenden Spalten. Von Henrik gewünscht.

## 2026-10-12 – Löschen einer Seite kürzt Bilder über zwei Seiten
Rutscht eine Seite durch das Löschen auf die andere Buchseite, verliert ihr Gegenüber oder träfe ihr Bild dort ein anderes, wird das Bild auf die eigene Seite gekürzt statt gelöscht.

## 2026-10-12 – Bilder überlappen sich nicht
Ein Bild, das ein anderes überdecken würde, wird mit Hinweis abgelehnt. Karten liegen dagegen immer über Bildern und lassen sich in jeden Pocket legen. Von Henrik bestätigt.

## 2026-10-12 – Hochgeladene Bilder: höchstens 2000 px Kantenlänge, JPG/PNG/WebP
Größere Bilder werden beim Hochladen verkleinert, damit Speicher und Backup klein bleiben. Von Henrik bestätigt.

## 2026-10-12 – Bild-Bibliothek gilt für alle Binder
Der Tab „Eigene Bilder“ zeigt alle hochgeladenen Bilder, unabhängig vom Binder. Ein Bild lässt sich dort erst löschen, wenn kein Binder es mehr verwendet. Das Backup eines Binders enthält nur die Bilder, die er verwendet.

## 2026-10-12 – Ausschnitt als Blickpunkt und Vergrößerung
`crop.x` und `crop.y` (0 bis 1, 0,5 = Mitte) legen fest, welcher Teil des Bildes zu sehen ist, `crop.zoom` (1 bis 4) die Vergrößerung. Das Bild füllt seine Fläche immer vollständig.

## 2026-10-12 – `Asset.createdAt` ergänzt
Optionales Feld, nach dem die Bibliothek sortiert wird. Grund: ohne es stünden neue Bilder an zufälliger Stelle.

## 2026-10-12 – Cover-Titel getrennt vom Binder-Namen
„Cover bearbeiten“ ändert Titel und Bild des Covers; der Name des Binders in Liste und Kopfzeile bleibt. Das Cover-Bild füllt die Cover-Innenseite mittig, ohne eigenen Ausschnitt.

## 2026-10-12 – Varianten sind eine offene Liste, nicht fünf feste Werte
`CardRef.variant` ist `normal`, `holo`, `reverse` oder der Name eines Sonder-Reverse-Musters, wie TCGdex ihn auf Englisch führt (`pokeball`, `masterball`, `energy`, `friendball` …). Grund: „Erhabene Helden“ hat sieben solche Muster, das Datenmodell sah nur Pokéball und Meisterball vor; die Anforderung verlangt aber jedes Muster, das es im Set gibt. Bekannte Muster haben deutsche Namen, unbekannte zeigen ihren TCGdex-Namen.

## 2026-10-12 – Was als Variante einer Karte zählt
Normal, Holo (auch Gold und Regenbogen), Reverse Holo und jedes Sonder-Reverse-Muster. Nicht gezählt werden Stempel-Varianten, Jumbo-Karten und Folien aus Sonderprodukten (Kosmos, Galaxie, Cracked Ice). Von Henrik bestätigt. Die Grundvariante einer Karte ist „normal“, wenn es sie gibt, sonst „holo“.

## 2026-10-12 – Seltenheit und Varianten kommen über die GraphQL-Schnittstelle von TCGdex
Eine Abfrage liefert beides für alle Karten eines Sets; über das SDK wären es hunderte Einzelabfragen. Die Varianten werden aus den englischen Daten gelesen, weil ihre Namen dort einheitlich sind. Der Zugriff liegt wie alle anderen in `src/lib/tcgdex/` und wird gecacht.

## 2026-10-12 – Secret Rares nach Seltenheit wählbar
Als Secret Rare zählt jede Karte mit einer Nummer über der offiziellen Setgröße (oder mit eigener Nummernart wie TG01). Der Assistent zeigt sie nach Seltenheit gruppiert (Illustration Rare, Special Illustration Rare, Hyper Rare usw.), jede Gruppe einzeln abwählbar, alle standardmäßig an. Von Henrik angeregt.

## 2026-10-12 – Promos als einfacher Schalter, standardmäßig aus
„Promos“ hängt alle bei TCGdex gelisteten Promos der Serie ans Ende des Binders, jede einmal. TCGdex ordnet Promos nur der Serie zu, nicht einem Set; einzelne lassen sich danach im Binder entfernen. Abweichend von REQUIREMENTS.md (dort „standardmäßig an“ und „einzeln abwählbar“), weil es je Serie um die 200 Karten sind. Von Henrik so gewünscht.

## 2026-10-12 – Assistent in einem Dialog
„Leerer Binder“ oder „Master Set“ oben, darunter die jeweiligen Angaben. Ein Master Set heißt wie sein Set, wenn kein Name eingegeben wird. Alle Karten eines Master Sets starten als „fehlt“.

## 2026-10-12 – Master Sets lassen sich nachträglich anpassen
„Master Set anpassen“ (nur bei Master-Set-Bindern) stellt Holo-Varianten, Secret Rares und Promos neu ein. Karten, die nicht mehr dazugehören, werden gelöscht, neue kommen als „fehlt“ dazu, danach liegt alles wieder in Set-Reihenfolge. Vorhanden-Markierungen bleiben an ihrer Karte. Von Hand eingefügte Karten aus anderen Sets wandern ans Ende statt gelöscht zu werden; Seiten behalten Öffnung und Bilder, leere Seiten am Ende entfallen. Welche Secret-Rare-Gruppen abgewählt sind, liest die App aus dem Inhalt des Binders. Von Henrik gewünscht.

## 2026-10-12 – Modus „Sammlung“ sperrt das Umordnen
Im Modus „Sammlung“ schaltet ein Klick auf eine Karte Vorhanden/Fehlt; Ziehen, Rechtsklick-Leeren und das Hineinziehen aus der Suche sind dort abgeschaltet. Beim Öffnen eines Binders gilt „Bearbeiten“.

## 2026-10-12 – Variante im Binder sichtbar und änderbar
Die rechte Spalte zeigt Variante und Seltenheit der gewählten Karte; die Variante lässt sich auf jede Ausführung umstellen, die es von der Karte gibt. Karten in einer anderen Variante als Normal oder Holo tragen im Pocket ein kleines Schild (z. B. „Reverse Holo“, „Pokéball“), damit gleiche Bilder unterscheidbar sind.

## 2026-10-12 – Fehlliste: eine Zeile je Pocket, Kästchen als Formularfelder
Die PDF-Liste (A4) führt jede fehlende Karte in Binder-Reihenfolge mit Set, Nummer, Name, Variante und Seltenheit. Die Kästchen heißen `fehlt_<Nr>_<Karten-ID>_<Variante>`. Schriftzeichen, die die Standardschrift nicht kennt (z. B. ♀), werden ersetzt; eingebettete Schriften für Japanisch und Koreanisch wären ein Thema für v1.

## 2026-10-12 – Fehler beim Speichern oder Import ohne Rot
Meldungen erscheinen in neutraler Textfarbe, weil Rot dem Löschen vorbehalten ist.
