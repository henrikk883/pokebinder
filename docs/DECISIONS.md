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

## 2026-10-12 – Sprachen: Deutsch, Englisch, Japanisch; Koreanisch entfällt
TCGdex hat praktisch keine koreanischen Karten und keine Bilder dazu. `ko` bleibt im Datenmodell gültig, wird aber nirgends angeboten. Henrik hat dem Vorschlag nicht widersprochen und Phase 6 freigegeben.

## 2026-10-12 – `Binder.lang` ergänzt
Die Sprache, in der der Binder sucht und ein Master Set erzeugt. Jede Karte behält ihre eigene Sprache in `CardRef.lang`. Binder und Backups aus der Zeit davor gelten als deutsch.

## 2026-10-12 – Sprachwechsel pro Karte nur bei gleicher Karten-ID
Westliche Sets teilen ihre IDs zwischen Deutsch und Englisch, japanische Sets haben eigene (aus „151“ wird dort `SV2a`). Die rechte Spalte bietet deshalb nur die Sprachen an, in denen es die Karte unter derselben ID gibt; japanische Karten kommen über die japanische Suche in den Binder.

## 2026-10-12 – Die Suche beginnt bei einem Sprachwechsel neu
Namen, Sets, Seltenheiten und Typen sind je Sprache verschieden; Suchtext und Filter werden deshalb zurückgesetzt. Beim Öffnen eines Binders steht die Suche auf dessen Sprache.

## 2026-10-12 – Fehlliste bei mehreren Sprachen
Enthält die Liste Karten in mehr als einer Sprache, bekommt sie die Spalte „Spr.“. Namen und Sets, die die PDF-Schrift nicht darstellen kann (Japanisch), erscheinen als Karten-ID bzw. Set-ID; eine eingebettete japanische Schrift bräuchte ein weiteres Paket und mehrere Megabyte.

## 2026-10-12 – Sortieren über Sprachen hinweg
Sortiert wird nach den Sets der Binder-Sprache, danach nach den Sets der übrigen Sprachen, die im Binder vorkommen.

## 2026-10-12 – Ersatzbild-Fehler behoben: englisches Bild erscheint von Anfang an
Ein Pocket merkte sich, dass ein englisches Ersatzbild nicht ladbar war, und zeigte danach auch für andere Karten nur den Platzhalter (auffällig nach dem Umblättern in Master Sets). Gemerkt wird jetzt die fehlgeschlagene Bildadresse, nicht mehr der Pocket. Von Henrik gemeldet.

## 2026-10-12 – PNG-Export: feste Breite, Doppelseite oder einzelne Seite
„Als PNG“ exportiert die aufgeschlagene Doppelseite mit 3000 px Breite oder eine ihrer Seiten mit 1500 px, unabhängig vom Zoom. Das Bild zeigt Karten, eigene Bilder, Öffnungs-Markierungen und die Seitenbeschriftung; Auswahlrahmen und Knöpfe fehlen, fehlende Karten bleiben schwarz-weiß. Von Henrik freigegeben. Kartenbilder werden dafür mit CORS angefordert, was TCGdex erlaubt.

## 2026-10-12 – PNG-Export nur noch seitenweise, mit Seitenauswahl
Der Doppelseiten-Export ist entfernt; er zeigte laut Henrik nicht alles. „Als PNG“ bietet die aufgeschlagenen Seiten einzeln an und „Mehrere Seiten …“: ein Fenster mit einem Kästchen je Seite des Binders (dazu „Alle“ und „Keine“), aus dem jede angekreuzte Seite ein eigenes Bild mit 1500 px Breite wird, benannt nach Binder und Seitenzahl. Für den Export blättert die App nacheinander zu jeder Seite, wartet, bis Karten und Bilder geladen sind, und kehrt danach zur vorher offenen Stelle zurück. Kartenbilder im Binder werden deshalb sofort geladen statt erst beim Scrollen. Ersetzt die Regel „Doppelseite oder einzelne Seite“ weiter oben. Von Henrik gewünscht.

## 2026-10-12 – „Alles sichern“: Gesamtsicherung in einer Datei
Zusätzlich zum Backup eines Binders gibt es `pokebinder-full-backup` (Version 1): alle Binder und die ganze Bild-Bibliothek, auch Bilder, die kein Binder verwendet. „Aus JSON importieren“ liest beide Formate. Binder mit derselben ID werden ersetzt, alle anderen bleiben unberührt; kommt genau ein Binder zurück, wird er geöffnet, sonst erscheint die Liste. Grund: Die Daten liegen nur im Browser dieses Rechners. Von Henrik gewünscht.

## 2026-10-12 – Erinnerung an die Gesamtsicherung
Gibt es Binder und wurde noch nie oder seit 14 Tagen nicht mehr alles gesichert, zeigt die Kopfzeile einen dezenten Knopf („Noch nie gesichert“ bzw. „Zuletzt gesichert vor N Tagen“), der die Sicherung auslöst. Der Zeitpunkt steht im `localStorage`; er ist eine Einstellung dieses Browsers und kein Teil der Binder-Daten.

## 2026-10-12 – Karten aus der Suche landen in ihrer Grundvariante
Beim Ablegen schlägt die App die Varianten der Karte nach und setzt „normal“, wenn es sie gibt, sonst „holo“. Die Abfrage startet schon beim Aufnehmen der Karte; dauert sie länger als 1,5 Sekunden oder schlägt fehl, landet die Karte als „normal“. Ersetzt die frühere Regel, dass Karten aus der Suche immer „normal“ sind. Von Henrik gewünscht.

## 2026-10-12 – Binder umbenennen
Über „Mehr“ → „Binder umbenennen“ im Editor und über „Umbenennen“ in „Meine Binder“. Der Cover-Titel zieht mit, solange er noch dem Binder-Namen entspricht; ein eigens gesetzter Titel bleibt. Von Henrik gewünscht.

## 2026-10-12 – Werkzeugleiste mit Menü „Mehr“
Sichtbar bleiben Sortieren, Fehlliste, Als PNG, Rückgängig/Wiederholen und „+ Seite“. Unter „Mehr“ liegen „Binder umbenennen“, „Master Set anpassen“ und die Layout-Wahl (das aktuelle Layout ist abgehakt). Grund: Die Leiste brach in zwei Zeilen um und nahm dem Binder Platz. Weicht vom Mockup ab, das die Layout-Auswahl direkt in der Leiste zeigt. Von Henrik gewünscht.

## 2026-10-12 – Eigene Dialoge statt Browser-Rückfragen
Seite löschen, Binder löschen und Layout ändern fragen in einem Fenster im App-Design nach; beim Löschen ist der Bestätigungsknopf rot und „Abbrechen“ vorausgewählt. Ersetzt die Regel „Rückfragen über den Browser-Dialog“ weiter oben.

## 2026-10-12 – Sortieren nach Pokédex-Nummer
Zweite Gruppe im Menü „Sortieren“, für eine Seite oder den ganzen Binder. Die Nummer kommt mit den Kartendaten von TCGdex; bei Karten mit mehreren Pokémon zählt die niedrigste. Karten desselben Pokémon liegen nach Set, Nummer und Variante beieinander; Karten ohne Nummer (Trainer, Energie) kommen ans Ende. Von Henrik gewünscht.

## 2026-10-12 – Zweite Bildquelle: pokemontcg.io
Für Karten, von denen TCGdex weder ein deutsches noch ein englisches Bild hat, lädt die App das englische Bild von `images.pokemontcg.io`. Reihenfolge: Bild in der Kartensprache, englisches Bild von TCGdex, englisches Bild von pokemontcg.io, grauer Platzhalter. Zählung vom 12.10.2026 über alle 144 deutschen Sets: von 18.980 Karten sind 747 bei TCGdex ganz ohne Bild, 538 davon gibt es dort (Glitzer-Tresor, Majestät der Drachen, Galar-Galerie, Trainer-Galerien, SM-Promos); 209 bleiben ohne (vor allem MEP-Promos, „30 Jahre“, EX-Icognito). Die Set-Kennung wird nach fester Regel umgeschrieben (`sv03.5` → `sv3pt5`, Ausnahmen in einer kleinen Tabelle); eine falsche Vermutung führt nur zum Platzhalter. Abgerufen werden ausschließlich Bilddateien. Gilt auch für PNG-Export, Platzhalter-Druck und den Bild-Cache. Japanische Sets werden dort nicht angefragt. Von Henrik freigegeben; die Ausnahme steht in CLAUDE.md.

## 2026-10-12 – Bilder der zweiten Quelle werden vor dem Anzeigen geprüft
pokemontcg.io antwortet bei einer unbekannten Karte mit „404“ und schickt trotzdem ein Bild mit (einen Kartenrücken). Der Browser zeigt so ein Bild an, als wäre es die Karte; der graue Platzhalter mit dem Namen fiel dadurch weg, und der PNG-Export blieb an diesen Bildern hängen. Darum fragt die App jede Adresse dieser Quelle erst ab (`imageExists`) und zeigt das Bild nur bei einer echten „200“-Antwort, sonst den Platzhalter. Bei TCGdex ist das nicht nötig, dort kommt bei „nicht gefunden“ kein Bild. Von Henrik gemeldet.

## 2026-10-12 – Playwright-Tests auf eigenem Port
Die Tests starten ihren Server auf Port 5174. Auf 5173 läuft die App selbst; ein dort laufender älterer Stand war von den Tests versehentlich mitbenutzt worden.

## 2026-10-12 – Undo/Redo: 100 Schritte, nicht gespeichert
„Rückgängig“ und „Wiederholen“ (Strg+Z, Strg+Y oder Strg+Umschalt+Z) gelten für jede Änderung am geöffneten Binder. Der Verlauf beginnt neu, wenn ein Binder geöffnet, geschlossen oder die Seite neu geladen wird; der zurückgenommene Stand wird sofort gespeichert. Abgelehnte Aktionen und solche ohne Wirkung zählen nicht als Schritt. In Textfeldern gilt Strg+Z weiter für den Text. Von Henrik freigegeben.

## 2026-10-12 – Lokal statt gehostet, Start per Doppelklick
Henrik möchte die App vorerst nicht veröffentlichen. `PokeBinder starten.cmd` baut die App, liefert sie mit `npm run start` unter `http://localhost:5173/` aus und öffnet den Browser; läuft sie schon, wird nur der Browser geöffnet. Der Port ist derselbe wie bei `npm run dev`, damit die gespeicherten Binder dieselben bleiben. Eine Desktop-Verknüpfung „PokeBinder“ zeigt auf das Skript; das Symbol erzeugt `node scripts/make-icon.mjs`.

## 2026-10-12 – Service Worker nur für Bilder
`public/sw.js` hält Kartenbilder und Set-Logos von TCGdex dauerhaft auf dem Gerät, damit einmal gesehene Karten ohne Verbindung erscheinen. Die App selbst kommt vom lokalen Server, die Kartendaten liegen in IndexedDB; beides braucht keinen Worker. Er wird nur in der gebauten App angemeldet und ist in den Playwright-Tests gesperrt. Selbst geschrieben, ohne weiteres Paket.

## 2026-10-12 – Fehlliste als CSV statt Excel-Datei
Semikolon-getrennt, mit Dezimalkomma und Byte Order Mark, sodass ein deutsches Excel sie per Doppelklick richtig öffnet; Nummern wie 025/165 stehen als Text. Eine echte `.xlsx`-Datei hätte ein weiteres Paket gebraucht. Von Henrik entschieden.

## 2026-10-12 – Preise von Cardmarket über TCGdex
Angezeigt wird der Preistrend, ersatzweise der Durchschnitt, je Variante: die normale Karte mit den einfachen Werten, jede Folien-Variante mit den Holo-Werten; Sondermuster sind bei Cardmarket eigene Produkte. Der Preis gilt für die Karte über alle Sprachen. Er steht rechts bei der gewählten Karte und als Spalte mit Summe in der Fehlliste (PDF und CSV). Den Wert des ganzen Binders rechnet „Wert berechnen“ auf Wunsch aus, getrennt nach vorhanden und fehlend; nach einer Änderung am Binder muss neu gerechnet werden. Preise brauchen eine Abfrage pro Karte (höchstens acht gleichzeitig) und liegen 24 Stunden im Cache. Von Henrik freigegeben.

## 2026-10-12 – Proxy-Druck
„Platzhalter drucken (PDF)“ im Menü „Fehlliste“: je A4-Blatt 3 × 3 Karten zu exakt 63 × 88 mm, mittig, mit Schnittmarken, in Binder-Reihenfolge, schwarz-weiß. Fehlt das Bild in der Kartensprache, wird das englische genommen; gibt es keines, steht ein Rahmen mit Name und Nummer. Eine Karte und ihre weiteren Varianten teilen sich ein Bild in der Datei. Die Option „ganze Binder-Seite 1:1 drucken“ ist nicht umgesetzt.

## 2026-10-12 – Holo-Effekt
Vorhandene Karten in einer Folien-Variante (alles außer „normal“) kippen im Binder leicht zur Maus und zeigen dort einen Glanz. Fehlende Karten bleiben ruhig. Bei „reduzierte Bewegung“ im System entfällt das Kippen. Im PNG-Export erscheint der Glanz nicht.

## 2026-10-12 – Fehler beim Speichern oder Import ohne Rot
Meldungen erscheinen in neutraler Textfarbe, weil Rot dem Löschen vorbehalten ist.

## 2026-10-12 – „Meine Binder“ als Regal mit Covern
Die Übersicht zeigt die Binder als Kacheln nebeneinander, jede mit ihrem Cover-Bild (Hochformat 3:4, Bild füllt die Fläche wie auf der Cover-Innenseite). Ohne Bild steht der Cover-Titel auf einer dunklen Fläche; mit Bild wird kein Titel darübergelegt, der Name steht ohnehin darunter. „Umbenennen“ und „Löschen“ erscheinen mit der Maus erst beim Überfahren (oder per Tastatur), auf Touch-Geräten sind sie immer sichtbar. Von Henrik gewünscht (Regal statt Liste).

## 2026-10-12 – Sortierung im Regal „Meine Binder“
Drei Sortierungen: „Zuletzt geändert“ (Standard), „Alphabetisch“ (deutsche Sortierung, „Binder 2“ vor „Binder 10“) und „Eigene Reihenfolge“. Nur in der eigenen Reihenfolge lassen sich Binder ziehen (auf einen anderen Binder fallen lassen = dessen Platz einnehmen) oder mit zwei Pfeilknöpfen um einen Platz verschieben; neue Binder stehen dort vorn. Sortierung und Reihenfolge liegen im `localStorage` dieses Browsers (`pokebinder:shelf`) und sind nicht Teil des Backups – so von Henrik entschieden.

## 2026-10-12 – PNG-Export: Bild-Pockets ohne Öffnungsmarke und Pocket-Rand
Liegt in einem Pocket ein eigenes Bild (und keine Karte), werden im PNG der Strich für die Pocket-Öffnung und die Umrandung des Pockets weggelassen: Das Bild erscheint als durchgehende Fläche und lässt sich ausdrucken, ausschneiden und einstecken. Am Bildschirm bleiben beide sichtbar, weil sie beim Planen zeigen, wo die Pockets liegen und wo die Karten eingeschoben werden. Pockets mit Karte oder ohne Bild bleiben im Export unverändert. Von Henrik gewünscht.

## 2026-10-12 – Bilder im Binder verschieben
Ein eingesetztes Bild wird an einem seiner Pockets gegriffen und auf einem anderen Pocket abgelegt; es verschiebt sich um genau diese Strecke, Größe und Zuschnitt bleiben. Das geht auch auf die gegenüberliegende Seite und über die Ringe. Passt es am Ziel nicht (Rand, anderes Bild), bleibt es liegen und der bekannte Hinweis erscheint. Karten bleiben in ihren Pockets; liegt in einem Pocket eine Karte, wird dort wie bisher die Karte gezogen, das Bild greift man an einem leeren Pocket. Im Sammlungsmodus wird nichts verschoben. Von Henrik gewünscht.

## 2026-10-12 – Bedienung per Finger (Tablet)
- Ziehen: mit der Maus sofort (ab 6 px Bewegung), mit dem Finger nach 250 ms Halten (dnd-kit `MouseSensor` + `TouchSensor` statt `PointerSensor`). Ohne die Wartezeit ließen sich die Listen nicht scrollen, ohne eine Karte zu greifen.
- „Tablet“ heißt: das Gerät hat keinen Mauszeiger (`@media (hover: none)`, Tailwind-Variante `touch:`), nicht „kleiner Bildschirm“. Dort erscheint der Knopf „Fehlt / Habe ich“ auf der angetippten Karte, „Löschen“ in der Bildbibliothek und die Knöpfe im Regal sind immer sichtbar, der Holo-Effekt kippt nicht, Eingabefelder haben 16 px Schrift (sonst zoomt Safari beim Antippen in die Seite), und langes Halten markiert keinen Text.
- Unter 1280 px Breite ist die rechte Spalte eingeklappt und schiebt sich über eine Lasche am rechten Rand über den Binder. Hochformat wird nicht eigens unterstützt.
- IDs kommen aus `src/lib/id.ts`: `crypto.randomUUID` gibt es nur auf https/localhost, nicht, wenn die App im Heimnetz über die IP-Adresse geöffnet wird.
- Auf dem iPad von Henrik getestet und freigegeben.

## 2026-10-12 – Suche einklappbar, Zoom passt sich an
- Beide äußeren Spalten lassen sich auf jedem Bildschirm über eine Lasche an ihrem Rand weg- und wieder aufklappen (Henriks iPad ist breit genug für die Desktop-Ansicht, deshalb nicht nur auf schmalen Bildschirmen). Die Suche steht offen immer neben dem Binder, damit man Karten hinüberziehen kann; die Auswahl ebenfalls ab 1280 px Breite, darunter schiebt sie sich über den Binder. Start: alles offen, was passt (unter 1280 px ohne Auswahl). Der Zustand wird in diesem Browser gemerkt (`pokebinder:columns`).
- Beim Öffnen eines Binders wählt die App den größten Zoom, bei dem die Doppelseite ganz zu sehen ist, höchstens die üblichen 80 %. Sie passt ihn neu an, wenn sich der Platz dauerhaft ändert (Spalte geklappt, Fenster verändert, Tablet gedreht), nicht wenn kurz ein Hinweis eingeblendet wird. Sobald man mit „+“/„–“ selbst einen Zoom wählt, bleibt der, bis ein Binder neu geöffnet wird. Auf großen Bildschirmen ändert sich dadurch nichts.
- Zuschnitt-Werte werden auf vier Nachkommastellen gerundet (vorher blieben Reste wie 1e-17 stehen).

## 2026-10-12 – Hosting bei Cloudflare, Repo bleibt privat
Die fertige App wird als statische Dateien bei Cloudflare bereitgestellt (`wrangler.jsonc`, Ordner `dist`), damit Henrik sie unterwegs auf dem iPad nutzen kann; über https funktioniert dort auch der Bilder-Vorrat. Cloudflare baut bei jedem Push auf `main` selbst. Kein Server-Code, keine Konten in der App: Binder und Bilder bleiben im Browser des jeweiligen Geräts und wandern über „Alles sichern“ von Gerät zu Gerät. GitHub Pages schied aus, weil es im Gratis-Tarif ein öffentliches Repo verlangt und Henrik sich eine spätere Vermarktung offenhalten will. `wrangler` läuft nur bei Cloudflare (`npx`), es ist keine Abhängigkeit des Projekts.

## 2026-10-12 – Japanische Schrift in Fehlliste und Proxy-Druck
- Neues Paket `@pdf-lib/fontkit` (von Henrik freigegeben) und die Schrift Noto Sans JP Regular als TrueType-Datei in `public/fonts/` (2,7 MB, SIL Open Font License, Lizenztext liegt daneben). Die Datei stammt aus dem Paket `@fontsource/noto-sans-jp` (Teilmenge „japanese“, 6887 Zeichen inklusive lateinischer Buchstaben) und wurde von WOFF nach TTF entpackt.
- Schrift und fontkit werden nur geladen, wenn eine Liste japanische Zeichen enthält (Name, Set oder Binder-Name); deutsche und englische Listen bleiben klein und unverändert. Ohne Verbindung fällt die Liste auf das alte Verhalten zurück (Karten-ID statt Name).
- Die Schrift wird vollständig eingebettet, ein solches PDF wird dadurch etwa 1,6 MB größer. Ausprobiert und verworfen: die verkleinerte Einbettung von pdf-lib (`subset: true`) lässt bei dieser Schrift die meisten Zeichen weg, und WOFF/WOFF2 direkt einzubetten ergibt leere oder sehr langsam erzeugte Dateien.
- Überschriften mit japanischen Zeichen stehen in normaler statt fetter Schrift, weil nur ein Schnitt beiliegt.

## 2026-10-12 – Kartenvorschau in der Suche
Jede Karte in der Suche hat einen Info-Knopf (unter der Maus beim Überfahren, auf Touch-Geräten immer sichtbar). Er öffnet ein Fenster mit dem großen Kartenbild, Set und Nummer, Seltenheit, den Sprachen, in denen es die Karte gibt, und allen Varianten mit ihrem Cardmarket-Preistrend. Klicken und Ziehen der Karte bleiben wie bisher; einen Knopf „In den Binder legen“ gibt es bewusst nicht. So von Henrik gewünscht.

## 2026-10-12 – „Sammlung“ klappt die Suche ein und erklärt sich
Im Modus „Sammlung“ wird nichts hineingezogen, deshalb ist die Suche dort eingeklappt; über dem Binder steht, was ein Klick auf eine Karte bewirkt. Die Lasche holt die Suche für den Moment zurück. Zurück in „Bearbeiten“ ist sie wieder so, wie man sie zuletzt selbst eingestellt hat – das automatische Einklappen wird nicht als eigene Wahl gespeichert. Anlass: Henrik sah zwischen den beiden Modi keinen Unterschied.

## 2026-10-12 – Eigene Bilder maßstabsgetreu drucken
- Menü „Als PNG“ → „Eigene Bilder drucken (PDF)“ (nur sichtbar, wenn der Binder Bilder hat). Das PDF nutzt dasselbe Raster wie der Proxy-Druck: A4, 3 × 3 Plätze zu 63 × 88 mm, Schnittmarken an jeder Pocket-Kante, bei 100 % zu drucken.
- Jedes Pocket, hinter dem ein Bild liegt, wird ein Stück von 63 × 88 mm. Ein Bild über mehrere Pockets erscheint zusammenhängend und wird entlang der Marken in Pocket-Stücke geschnitten. Bilder über die Ringe werden an der Seitengrenze geteilt, Bilder größer als 3 × 3 (im 4 × 4-Binder) in Teile, die auf ein Blatt passen.
- Reihenfolge wie im Binder; kleine Stücke teilen sich ein Blatt, nichts wandert auf ein früheres Blatt zurück.
- Der Ausschnitt entspricht dem im Binder (Blickpunkt und Vergrößerung). Am Bildschirm liegen zwischen den Pockets schmale Stege, auf dem Papier nicht; bei Bildern über mehrere Pockets kann der Rand deshalb um wenige Prozent abweichen.
- Auflösung höchstens 300 dpi, Bilder mit weniger Pixeln werden nicht hochgerechnet. Die Bilder bleiben farbig; Karten, die auf einem Bild liegen, werden nicht mitgedruckt.

## 2026-10-12 – Seiten umsortieren, duplizieren, einfügen
- In der Miniaturleiste lässt sich eine Seite auf eine andere ziehen: Sie nimmt deren Platz ein, die Seiten dazwischen rücken auf. Ein Klick auf eine Miniatur blättert weiterhin nur.
- In der rechten Spalte gibt es für die Seite des gewählten Pockets vier Knöpfe: „Nach vorn“, „Nach hinten“, „Duplizieren“ (Kopie direkt dahinter, mit Karten, Besitz-Markierungen, Bildern und Öffnung) und „Leere Seite davor“. Die Ansicht folgt der Seite, das Pocket bleibt gewählt.
- Weil Seiten dabei die Seite des Binders wechseln, werden Bilder über zwei Seiten wie beim Löschen einer Seite auf ihre eigene Seite gekürzt.
- Im Modus „Sammlung“ ist das Umordnen gesperrt. Alles lässt sich rückgängig machen.

## 2026-10-12 – Merkliste
- Im Info-Fenster einer Karte gibt es den Knopf „Merken“ / „Gemerkt“. Gemerkte Karten stehen im dritten Reiter „Merkliste“ der linken Spalte (mit Anzahl), die zuletzt gemerkte zuerst, und lassen sich von dort wie Suchergebnisse in den Binder ziehen. In der Suche trägt eine gemerkte Karte einen violetten Punkt vor dem Namen.
- Die Liste gilt für alle Binder. Eine Karte bleibt gemerkt, auch wenn sie in einen Binder gelegt wurde; entfernt wird sie über denselben Knopf.
- Gemerkt wird Karte + Sprache. Gespeichert im `localStorage` dieses Browsers (`pokebinder:watchlist`), nicht im Backup – wie die Reihenfolge des Regals.

## 2026-10-12 – Seite „Karten“ zum Stöbern
- Zweiter Eintrag „Karten“ in der Kopfzeile neben „Meine Binder“. Die Seite zeigt die Kartensuche über die ganze Breite: Filter in einer Zeile, Karten als großes Raster (so viele nebeneinander, wie passen), dazu ein Umschalter „Alle Karten“ / „Merkliste“.
- Dort wird nur gestöbert und gemerkt: Ein Klick auf eine Karte öffnet ihr Info-Fenster, ziehen lässt sich nichts. In den Binder kommen Karten weiter über die Suche neben dem Binder (bzw. deren Reiter „Merkliste“).
- Schnell-Merken: Jede Karte hat oben links einen Stern, unter der Maus beim Überfahren, auf Touch-Geräten immer. Eine gemerkte Karte behält ihren Stern sichtbar; er ersetzt den violetten Punkt vor dem Namen. Der Stern gibt es auch in der schmalen Suche.
- Ein offener Binder bleibt darunter offen: Sein Name in der Kopfzeile führt zurück, „Meine Binder“ ins Regal. Die Suche der Seite und die Suche neben dem Binder merken sich Text und Filter getrennt.
- Mehrere Merklisten sind der nächste Schritt und noch nicht gebaut.

## 2026-10-12 – Mehrere Merklisten
- Es gibt immer die Liste „Schnellmerken“; in sie merkt der Stern auf der Karte. Sie lässt sich weder umbenennen noch löschen. Die bisherige einzelne Merkliste wird beim ersten Start zu dieser Liste.
- Im Info-Fenster einer Karte steht unter „Merken auf“ jede Liste als ankreuzbares Feld; darunter lässt sich eine neue Liste anlegen, auf der die Karte dann gleich steht. Eine Karte kann auf mehreren Listen stehen.
- Im Reiter „Merkliste“ neben dem Binder und auf der Seite „Karten“ wählt man die angezeigte Liste aus (mit Anzahl); daneben „Neue Liste“, „Umbenennen“, „Löschen“ (mit Rückfrage). Beide Stellen zeigen dieselbe gewählte Liste.
- Der Stern ist gefüllt, wenn die Karte auf „Schnellmerken“ steht, und nur farbig umrandet, wenn sie ausschließlich auf einer anderen Liste steht. Die Zahl am Reiter zählt verschiedene gemerkte Karten über alle Listen.
- Gespeichert im `localStorage` (`pokebinder:watchlists`), noch nicht im Backup; das kommt mit „Geräte abgleichen“.

## 2026-10-12 – Summe einer Merkliste
Jede Merkliste hat „Wert berechnen“ wie der Binder: die Summe der Cardmarket-Preistrends ihrer Karten, mit der Zahl der Karten ohne Preis. Neben dem Binder steht sie unten an der Liste, auf der Seite „Karten“ neben der Kartenzahl. Eine Liste merkt Karten, keine Varianten; gerechnet wird deshalb mit der Grundvariante jeder Karte (normal, sonst Holo) – so, wie sie auch im Binder landet. Nach einer Änderung der Liste wird die Summe erst auf Wunsch neu berechnet. Von Henrik gewünscht.

## 2026-10-12 – Geräte abgleichen: Einspielen fragt nach, Merklisten im Backup
- Beim Einspielen einer Backup-Datei vergleicht die App jeden Binder mit dem auf dem Gerät (über `updatedAt`): neu, in der Datei neuer, auf diesem Gerät neuer, unverändert.
- Würde ein Binder des Geräts ersetzt, erscheint vorher ein Fenster mit allen Bindern der Datei, ihrem Stand und beiden Zeitpunkten. Vorangekreuzt ist, was neu oder in der Datei neuer ist; ein Binder, den das Gerät in neuerer Fassung hat, bleibt ohne Haken. Ohne Überschneidung (nur neue oder unveränderte Binder) wird wie bisher ohne Rückfrage eingespielt.
- Verglichen wird der ganze Binder, nicht einzelne Karten: Die gewählte Fassung ersetzt die andere vollständig. Ein Zusammenführen von Änderungen beider Seiten gibt es nicht.
- „Alles sichern“ enthält jetzt auch die Merklisten (Feld `watchlists`, Format-Version bleibt 1; ältere Dateien ohne das Feld bleiben lesbar). Beim Einspielen werden sie zusammengeführt: Listen mit derselben Kennung bekommen die fehlenden Karten dazu, unbekannte Listen kommen hinzu, der Name einer Liste bleibt, wie er auf dem Gerät ist. Es wird nichts entfernt – eine auf einem Gerät gelöschte Karte oder Liste kommt beim Abgleich zurück.
- Regal-Reihenfolge und eingeklappte Spalten bleiben Sache des Geräts und wandern nicht mit.

## 2026-10-12 – Einkaufsliste
- Menü „Fehlliste“ → „Einkaufsliste“ öffnet ein Fenster mit den fehlenden Karten des Binders: Bild, Name, Set, Nummer, Variante, Cardmarket-Preistrend. Reihenfolge „Günstigste zuerst“ (Standard), „Teuerste zuerst“ oder „Wie im Binder“; Karten ohne Preis stehen bei den Preis-Reihenfolgen am Ende. Unten die Summe.
- Budget: ein Betrag in Euro (deutsche Schreibweise, „49,90“). Die App kauft gedanklich die günstigsten Karten zuerst, bis das Geld nicht mehr reicht, nennt Anzahl und Betrag und blendet die übrigen Zeilen ab. Es wird keine Karte übersprungen, um später eine andere unterzubringen.
- Eine Zeile je Pocket wie in der Fehlliste: Eine Karte, die zweimal fehlt, steht zweimal da.
- Dieselbe Ansicht gibt es für jede Merkliste (Knopf „Einkaufsliste“ neben „Wert berechnen“), dort mit der Grundvariante jeder Karte.
- Link zu Cardmarket: TCGdex liefert die Produktnummer (`idProduct`) mit; der Link führt damit zur Karte (`…/Products?idProduct=…`), ohne Nummer zur Suche nach dem Namen. Er öffnet sich nur per Klick in einem neuen Tab. Die App selbst ruft Cardmarket nicht ab – deshalb kein Verstoß gegen „keine externen Dienste“. Dass der Link bei der richtigen Karte landet, hat Henrik im Browser bestätigt (automatisiert ließ es sich wegen der Bot-Sperre von Cardmarket nicht prüfen).

## 2026-10-12 – Lücke einfügen und schließen
- Zwei Knöpfe in der rechten Spalte unter „Pocket leeren“, für das gewählte Pocket.
- „Lücke einfügen“ (nur bei belegtem Pocket): Die Karte dort und alle Karten, die ohne Lücke darauf folgen, rücken um ein Pocket weiter, auch über Seitengrenzen, in das nächste freie Pocket. Reicht die Reihe bis ans Ende des Binders, kommt eine Seite dazu. Das gewählte Pocket ist danach leer und bleibt gewählt.
- „Lücke schließen“ (nur bei leerem Pocket mit Karte direkt dahinter): Die folgenden Karten rücken um ein Pocket zurück, bis zur nächsten Lücke. Karten hinter einer weiteren Lücke bleiben stehen, damit bewusst gelassene Lücken nicht verschwinden.
- Besitz-Markierungen wandern mit den Karten; eigene Bilder bleiben, wo sie sind. Im Modus „Sammlung“ ausgeblendet. Ein Schritt „Rückgängig“ nimmt alles zurück, auch die neue Seite.

## 2026-10-12 – Doppelte Karten: Stückzahl und Tauschliste
- `Slot.count` ergänzt: wie oft die Karte da ist (1 bis 99). Gespeichert wird nur mehr als eins, und nur bei einer vorhandenen Karte; „Fehlt“ vergisst die Zahl. Alte Binder und Backups ohne das Feld gelten als „einmal“.
- Eingestellt wird die Anzahl rechts bei der gewählten Karte (– / Zahl / +). Im Binder trägt die Karte ab zwei Exemplaren ein Schildchen „×3“; im PNG-Export fehlt es.
- Die Zahl bleibt bei der Karte: beim Verschieben, Tauschen, Sortieren, Layout-Wechsel, Lücke einfügen/schließen, Seite duplizieren, Variante oder Sprache ändern, beim Anpassen eines Master Sets und im Backup.
- „Fehlliste“ → „Tauschliste (doppelte Karten)“: jede Karte mit den Exemplaren über das eine im Binder hinaus, Preistrend je Stück und Summe. Dieselbe Ansicht wie die Einkaufsliste, ohne Budget.
- „Wert berechnen“ zählt jedes Exemplar einer vorhandenen Karte.
- Gezählt wird pro Pocket in einem Binder. Dieselbe Karte in zwei Pockets oder zwei Bindern wird nicht zusammengezählt.

## 2026-10-12 – Mehrere Karten auf einmal
- Auswählen: Strg-Klick (am Mac ⌘) nimmt ein Pocket zur Auswahl dazu oder heraus, Umschalt-Klick wählt alles vom zuletzt gewählten bis zum angeklickten Pocket, auch über die Doppelseite. Ohne Tastatur gibt es den Umschalter „Mehrere auswählen“ neben „Bearbeiten / Sammlung“: Solange er an ist, wählt jeder Klick ein Pocket dazu oder ab. Ein normaler Klick wählt wieder ein einzelnes Pocket; Umblättern hebt die Auswahl auf.
- Ab zwei Pockets zeigt die rechte Spalte statt der Karten-Details: „Alle vorhanden“, „Alle fehlen“, „Pockets leeren“, „Auswahl aufheben“. Entf leert alle, Esc hebt die Auswahl auf.
- Verschieben: Zieht man eine der ausgewählten Karten, kommen die anderen mit. Jede rückt in Leserichtung um gleich viele Pockets weiter (oder zurück), auch über Seiten; die Abstände bleiben. Karten, die am Ziel liegen, rücken in die frei werdenden Pockets. Würde eine Karte über den Binder hinausreichen, bleibt alles liegen und ein Hinweis erscheint.
- Besitz-Markierungen und Stückzahlen wandern mit. Im Modus „Sammlung“ gibt es keine Mehrfachauswahl: Dort bedeutet ein Klick „vorhanden / fehlt“.
- Leere Pockets lassen sich mit auswählen, zählen bei den Aktionen aber nicht.

## 2026-10-12 – Fortschritt nach Set
Knopf „Nach Set“ in der Fortschrittsleiste unter dem Binder öffnet ein Fenster mit einer Zeile je Set: Name, vorhanden / gesamt, Zahl der fehlenden und ein Balken. Gezählt werden wie beim Gesamtfortschritt die Pockets des Binders (nicht das ganze Set, eine doppelt eingelegte Karte zählt doppelt). Reihenfolge: wie die Sets im Binder zuerst vorkommen. Bei gemischten Sprachen zählt ein Set je Sprache und trägt deren Kürzel; Karten ohne erkennbares Set stehen am Ende.

## 2026-10-12 – Varianten prüfen
Menü „Mehr“ → „Varianten prüfen“ sucht im offenen Binder Karten, die in einer Variante liegen, die es von ihnen nicht gibt (typisch: „Normal“ bei einer Karte, die nur als Holo existiert, aus der Zeit vor der automatischen Erkennung). Nach einer Rückfrage mit der Anzahl werden sie auf ihre Grundvariante gestellt (Normal, sonst Holo); Besitz-Markierung und Stückzahl bleiben. Ein Schritt „Rückgängig“ nimmt alles zurück. Karten, deren Varianten TCGdex nicht kennt, und Varianten, die es gibt (auch bewusst gewählte wie Reverse), bleiben unberührt. Ohne Fund sagt ein Hinweis, dass alles stimmt.

## 2026-10-12 – Bild mit Pfeilen verschieben
Im Abschnitt „Bild“ der rechten Spalte stehen vier Pfeile, die das Bild hinter dem gewählten Pocket um ein Pocket nach links, oben, unten oder rechts rücken, auch über die Ringe auf die gegenüberliegende Seite. Das geht auch dann, wenn auf jedem Pocket des Bildes eine Karte liegt und es sich deshalb nicht greifen lässt. Die Auswahl wandert mit, sodass mehrere Schritte hintereinander gehen. Passt das Bild am Ziel nicht (Rand, anderes Bild), bleibt es liegen und der bekannte Hinweis erscheint; am Rand des Binders ist der Pfeil ausgegraut. Karten bleiben, wo sie sind.

## 2026-10-12 – Menüs schließen bei Klick daneben
Alle aufklappbaren Menüs (Sortieren, Fehlliste, Als PNG, Mehr, Backup, Set-Auswahl) schließen sich, wenn man irgendwo außerhalb klickt oder tippt; bisher ging das nur mit Esc oder durch die Wahl eines Eintrags. Dadurch ist nie mehr als ein Menü offen. Der Klick wirkt zusätzlich normal weiter (ein Pocket wird z. B. trotzdem gewählt). Von Henrik gemeldet.

## 2026-10-12 – Handy-Ansicht, Schritt 1: Aufbau
- Unter 768 px Breite (`src/lib/phone.ts`) zeigt die App einen der drei Bereiche zur Zeit: „Binder“, „Suche“ oder „Auswahl“, umgeschaltet über eine Leiste am unteren Rand. Die Laschen an den Spalten entfallen dort. Die Elemente bleiben dieselben wie auf dem breiten Bildschirm, nur die Anordnung wechselt, damit beim Drehen nichts seinen Zustand verliert.
- Der Binder liegt mit einer Seite offen statt mit zweien (ohne Cover-Innenseite); geblättert wird seitenweise, die Miniaturleiste zeigt eine Miniatur je Seite. Die Seite füllt die Breite, der Bereich scrollt senkrecht; der Zoom-Regler ist ausgeblendet.
- Menüs klappen als Blatt vom unteren Rand über die ganze Breite auf. Kopfzeile ohne Schriftzug, Speicherstatus nur als Punkt, die Sicherungs-Erinnerung entfällt dort (sie steckt im Menü „Backup“). Der Rechtshinweis bleibt, kleiner gesetzt.
- Regal und Seite „Karten“ stehen in zwei Spalten; in der Suche scrollen die Filter mit den Ergebnissen weg.
- Bilder über zwei Seiten bleiben erhalten, auf dem Handy sieht man je Seite ihren Teil.
- Von Henrik auf dem Handy getestet und freigegeben.

## 2026-10-12 – Handy-Ansicht, Schritt 2: Antippen statt Ziehen
- Auf dem Handy liegen Suche und Binder nicht nebeneinander, also lässt sich nichts hinüberziehen. Stattdessen legt ein Tipp auf eine Karte der Suche (oder der Merkliste) sie in den Binder: in das dort gewählte Pocket – auch wenn schon eine Karte darin liegt, wie beim Ablegen –, ohne Auswahl ins erste freie Pocket ab der offenen Seite.
- Danach springt die Auswahl zum nächsten freien Pocket (auch auf der nächsten Seite), sodass sich eine Seite ohne Hin- und Herwechseln füllen lässt. Eine Zeile unter den Karten sagt, wo die letzte Karte gelandet ist und wohin die nächste geht; ist nichts mehr frei, steht das dort.
- Stern und Info-Knopf bleiben, was sie sind. Am PC und Tablet wird weiter gezogen.
- Von Henrik auf dem Handy getestet und freigegeben.

## 2026-10-12 – „Verschieben“: Ziel antippen statt ziehen
Für eine gewählte Karte gibt es „Verschieben“ (rechte Spalte, auf dem Handy zusätzlich direkt unter den Blätterpfeilen). Die Karte wartet dann mit gestricheltem Rahmen, ein Hinweis steht über dem Binder, und das nächste angeklickte Pocket ist ihr Ziel – auch nach dem Umblättern, also auf einer Seite, die vorher nicht offen lag. Liegt dort eine Karte, tauschen beide. „Abbrechen“ oder Esc beendet es. Mit einer Mehrfachauswahl wandern alle mit: Die zuletzt gewählte Karte landet auf dem Ziel, die anderen behalten ihren Abstand; passt das nicht in den Binder, bleibt alles liegen und man kann ein anderes Ziel wählen. Gilt auf allen Geräten: Vorher ließ sich nirgends eine Karte auf eine nicht aufgeschlagene Seite bringen. Anlass: Henrik wollte auf dem Handy verschieben können.

## 2026-10-12 – Abgleich zwischen Geräten, Schritt 1: Server-Teil
- Regeländerung, von Henrik gewünscht: Statt Backup-Dateien hin- und herzuschicken, gleichen sich die Geräte über einen kleinen Server-Teil bei Cloudflare ab. „Kein Backend, keine Accounts“ gilt damit nicht mehr; CLAUDE.md ist angepasst. Die App bleibt ohne Anmeldung und ohne Netz benutzbar.
- `worker/`: ein Cloudflare Worker, der alles unter `/api/` beantwortet; der Rest sind weiterhin die Dateien der gebauten App. Binder und Merklisten liegen in D1 (Datenbank `pokebinder`), hochgeladene Bilder in R2 (Bucket `pokebinder-images`), jeweils getrennt nach Sammler. Die Tabellen entstehen beim ersten Zugriff.
- Anmeldung über Cloudflare Access (Team `pokebinder.cloudflareaccess.com`): E-Mail-Code, nur freigeschaltete Adressen. Der Worker prüft das von Access signierte Token selbst (Signatur, Anwendung, Aussteller, Ablauf) und verlässt sich nicht auf Header. Solange `ACCESS_AUD` in `wrangler.jsonc` leer ist, weist die API jede Anfrage mit 401 ab – so stand zu keinem Zeitpunkt etwas Ungeschütztes im Netz.
- Der Server speichert, was er bekommt, und prüft nur Form und Größe; was ein gültiger Binder ist, prüft die App beim Herunterladen mit denselben Regeln wie beim Einspielen eines Backups.
- Schreiben nur, wenn das Gerät den Stand kennt, den der Server hat (`base`); sonst 409 und der Sammler entscheidet. Gelöschte Binder bleiben als Löschvermerk stehen, damit andere Geräte davon erfahren.
- Keine neuen Abhängigkeiten: Die wenigen Typen der Cloudflare-Laufzeit stehen in `worker/types.ts`, `wrangler` läuft nur bei Cloudflare bzw. per `npx`. Die Tests des Server-Teils laufen gegen echtes SQLite (`node:sqlite`).
- Die Abgleich-Logik für die App (`src/features/sync/syncPlan.ts`) ist vorbereitet; Anmelde-Knopf und Abgleich selbst folgen in Schritt 2.

## 2026-10-12 – Abgleich zwischen Geräten, Schritt 2: Anmelden und Abgleich in der App
- Access-Anwendung „PokeBinder Sync“ schützt `/api`; ihr AUD-Tag steht in `wrangler.jsonc` (kein Geheimnis: er sagt nur, für welche Anwendung ein Token gilt).
- „Anmelden“ führt den Browser zu `/api/login`, Access fragt den Code ab und schickt ihn zurück. „Abmelden“ führt zu `/cdn-cgi/access/logout`; was auf dem Gerät liegt, bleibt dort.
- Ob jemand angemeldet ist, fragt die App mit `/api/me`. Anfragen folgen der Weiterleitung zur Anmeldeseite bewusst nicht (`redirect: 'manual'`), sonst sähe „nicht angemeldet“ aus wie „keine Verbindung“. Antwortet statt der API die App selbst (Entwicklung, Tests), gibt es keinen Server-Teil und die Kopfzeile zeigt nichts davon.
- Abgleich beim Start, 2,5 s nach dem Speichern, nach Einspielen/Umbenennen/Löschen und beim Zurückkehren zur App (höchstens alle 20 s). Immer nur einer zur Zeit.
- Was das Gerät sich merkt (`pokebinder:sync` im Browser): worauf es sich mit dem Server zuletzt geeinigt hat, gelöschte Binder, und ob die Merklisten seither geändert wurden. Meldet sich ein anderer Sammler auf dem Gerät an, beginnt das von vorn; gelöscht wird dabei nichts.
- Konflikte bekommen einen eigenen kleinen Dialog statt des Import-Dialogs: Hier wählt man zwischen zwei Fassungen, dort kreuzt man an, was eingespielt wird. Vorgewählt ist die spätere Fassung; „Später“ lässt beide Seiten unberührt.
- Merklisten gehen als Ganzes über die Leitung. Auf einer Seite geändert, ersetzen sie die andere; auf beiden geändert, werden sie zusammengeführt (dabei kommt eine dort entfernte Karte zurück – lieber das, als dass Gemerktes verloren geht).
- Ein heruntergeladener Binder läuft durch dieselbe Prüfung wie ein Backup (`readBinder`); was sie nicht besteht, wird nicht übernommen. Liegt der Binder gerade offen und wurde währenddessen nicht angefasst, wird er neu geöffnet bzw. weggelegt.
- `nextBase` aus Schritt 1 entfällt: Der Stand wird Aktion für Aktion fortgeschrieben, damit ein Abgleich, der mittendrin abbricht, das Erledigte behält.
- Tests: die App-Seite des Abgleichs gegen den echten Server-Code mit zwei „Geräten“ (`worker/syncRoundTrip.test.ts`), dazu Playwright mit nachgestellter Schnittstelle (`tests/e2e/sync.spec.ts`).

## 2026-10-12 – Abgleich zwischen Geräten, Schritt 3: eigene Bilder
- Bilder wandern mit den Bindern: Was ein Binder dieses Geräts zeigt (Pockets und Cover), wird hochgeladen, wenn es dem Server fehlt, und geholt, wenn es dem Gerät fehlt. Nach den Bindern und Merklisten, ein Bild nach dem anderen.
- Ein Bild, das in keinem Binder liegt, bleibt auf seinem Gerät. So kommt ein aus der Bibliothek gelöschtes Bild nicht vom Server zurück, und der Abgleich muss nie Bilder löschen. Auf dem Server bleiben nicht mehr benutzte Bilder liegen; bei wenigen Sammlern fällt das nicht ins Gewicht.
- Bilder ändern sich unter ihrer Kennung nie, darum gibt es hier keine Konflikte.
- Was der Server nicht annähme (anderes Format als JPEG/PNG/WebP, über 12 MB), schickt die App gar nicht erst, statt es bei jedem Abgleich erneut zu versuchen; der Binder selbst gleicht sich trotzdem ab.

## 2026-10-12 – Startseite und „Karten stöbern“
- Mit Henrik abgestimmt: Der Reiter „Karten“ heißt „Karten stöbern“ (deutsch wie der Rest; am Handy aus Platzgründen „Stöbern“). Die Startseite erscheint beim Öffnen der Seite, nicht nach Neuladen im selben Tab (Merker in `sessionStorage`, `pokebinder:visited`). Das große Bild ist ein gezeichneter Binder mit echten Karten.
- Die Startseite ist eine dritte Ansicht (`home`) neben Regal/Binder und „Karten stöbern“ und nutzt die bestehende Kopf- und Fußzeile; das Logo führt zu ihr. „Meine Binder“ führt immer ins Regal; lag ein Binder offen, gibt es zusätzlich „Weiter mit …“.
- Aus der Vorlage nicht übernommen: die KI-erfundenen Kartenbilder, die Menüpunkte „Sets entdecken“ und „So funktioniert's“ (dafür gibt es keine Seiten) und „Ohne Account · Lokal gespeichert“ (stimmt seit dem Abgleich nicht mehr ganz; jetzt „Ohne Anmeldung nutzbar · Abgleich zwischen Geräten optional“). Dazugekommen ist eine vierte Kachel zum Abgleich.
- Die Karten im gezeichneten Binder sind 16 feste Karten aus „151“ (deutsch). Ihre Bild-Adressen ergeben sich aus Serie, Set und Nummer (`cardImageAt` in `src/lib/tcgdex/`), es braucht dafür keine Abfrage von Kartendaten. Lädt ein Bild nicht (kein Netz), bleibt das Pocket leer.
- Das Abzeichen über der Überschrift ist grau statt violett wie in der Vorlage: Violett bleibt der Hauptaktion vorbehalten, hier „Meine Binder“.
- Tests beginnen weiterhin in der App (Merker wird vorab gesetzt); die Startseite hat eigene Tests (`tests/e2e/landing.spec.ts`).
- Nachtrag: Henriks Lieblingskarten stehen im gezeichneten Binder vorn – Pikachu-ex (Erhabene Helden 276/217), Mega-Lucario-ex (Mega-Entwicklung 179/132), Riolu (Bund der Gleichgesinnten 116/236), Qurtel V (Schwert & Schild 24/202); der Rest bleibt aus „151“. Auf Henriks Wunsch verteilt (Pikachu zuerst, Lucario in der Mitte von Seite 1, Riolu darunter, Qurtel in der Mitte von Seite 2) und Mewtu durch Plinfa (Fatale Flammen 098/94) ersetzt.

## 2026-10-12 – Kartenbilder, die nicht laden
- Befund (an der Live-Seite nachgemessen): Der Bildserver von TCGdex schickt `Access-Control-Allow-Origin` bei einem Teil der Antworten doppelt. Browser werten das als fehlende Erlaubnis, das Bild schlägt fehl – bei uns traf das jedes Kartenbild, weil alle „lesbar“ (`crossOrigin`) angefordert wurden. Pro Doppelseite blieben so 2 bis 6 von 18 Pockets leer; der Browser merkt sich die unbrauchbare Antwort, darum half auch erneutes Hinblättern nicht.
- Kartenbilder werden jetzt schlicht angezeigt (ohne `crossOrigin`); dafür gilt die Kopfzeile nicht. Was ein Bild lesen muss – PNG-Export, Proxy-PDF –, holt es selbst über `readPicture` (`src/lib/tcgdex/`): bis zu sechs Versuche, ab dem zweiten am Browser-Cache vorbei. Der PNG-Export hält die Bilder der Seite für die Dauer des Zeichnens als Daten in der Seite.
- Service Worker: Ein Bild, das nur angezeigt wird, wartet auf höchstens einen Versuch einer aufbewahrbaren Antwort und wird sonst so gezeigt, wie der Browser es ohnehin zeigen würde; die aufbewahrbare Fassung (für den Betrieb ohne Netz) wird im Hintergrund nachgeholt. Das Aufbewahren hält die Antwort nicht mehr auf.
- Dazu: Die Bilder der Doppelseite davor und danach werden 150 ms nach dem Blättern vorab geholt (`preloadSpreads.ts`), damit die nächste Seite sofort vollständig da ist.

## 2026-10-12 – Werkzeugleiste: „Was fehlt?“ und „Kaufliste“
- Mit Henrik abgestimmt: „Fehlliste“ heißt „Was fehlt?“ und enthält nur noch, was fehlende Karten ausgibt (Als PDF, Als CSV, Platzhalter drucken). Die Einkaufsliste heißt „Kaufliste“ und ist ein eigener Knopf daneben; am Handy steht dafür ein Preisschild. Die Tauschliste (doppelte Karten) liegt jetzt unter „Mehr“.
- In den Dateien steht „Fehlende Karten – <Binder>“ als Titel, der Dateiname beginnt mit `fehlende-karten-`: Als Überschrift eines Dokuments liest sich das besser als die Frage.
- „Kaufliste“ heißt die Liste überall, auch bei den Merklisten.

## 2026-10-12 – Neue To-do-Liste und Roadmap
- Elf Ideen in REQUIREMENTS.md aufgenommen („Offen“) und in fünf Etappen geordnet („Roadmap“): Alltag, Preise, Gestalten, Mit Freunden, Groß. Bewusst ohne Zeitangaben, nur mit relativem Umfang.
- Drei Punkte verlangen Regeländerungen (Teilen: andere dürfen lesen; englische Oberfläche: Texte je Sprache; Kamera: externer Dienst). Sie sind in der Roadmap benannt und werden erst entschieden, wenn der Punkt dran ist.

## 2026-10-12 – Installierbar als App
- Henrik: Das Symbol bleibt das bestehende Logo. Englische Oberfläche und Karten per Kamera sind zurückgestellt (Roadmap, Etappe E).
- `public/manifest.webmanifest` (Name, Farben, „standalone“) und Symbole unter `public/icons/`: das Logo auf dem dunklen Hintergrund der App in 192 und 512 px, eine „maskable“-Fassung mit mehr Rand (manche Startbildschirme schneiden rund aus) und 180 px für iPhone/iPad. Erzeugt aus `favicon.svg`, keine neue Abhängigkeit.
- Der Service Worker hält jetzt auch die App selbst vor. Die Seite kommt vom Netz, wann immer sie binnen 4 s da ist, sonst die zuletzt gehaltene – so ist nach einem Update sofort die neue Fassung da und ohne Netz die alte. Skripte und Styles tragen ihren Inhalt im Namen und werden gehalten, wie sie sind; eine neue Fassung räumt die der alten weg.
- `/api/` und `/cdn-cgi/` fasst der Service Worker nicht an: Anmeldung und Abgleich gehen immer direkt zum Server.
- Grenze: Was erst bei Bedarf nachgeladen wird (PDF- und PNG-Export, japanische Schrift), steht ohne Netz nur bereit, wenn es vorher schon einmal benutzt wurde.

## 2026-10-12 – Deck Builder in der Roadmap
- Von Henrik gewünscht: ein Deck Builder als neuer Punkt 12 (eigene Etappe E, vor den zurückgestellten Punkten), dazu als Fernziel Punkt 13 „gegen Freunde spielen“. Beides nur aufgenommen, nichts gebaut.
- Meine Annahmen zum Deck Builder (60 Karten, höchstens 4 gleichnamige, Gruppen Pokémon/Trainer/Energie, Abgleich mit den eigenen Bindern) stehen als Vorschlag in REQUIREMENTS.md und werden geklärt, wenn der Punkt dran ist.
- Nachtrag, mit Henrik geklärt: Decks bekommen ein zweites Regal unter den Bindern; „Meine Binder“ wird dann zu „Meine Karten“. Die App prüft auch, ob die Karten im Format erlaubt sind – TCGdex liefert je Karte `legal.standard` und `legal.expanded`. Welche Formate zur Wahl stehen, ist noch offen.
- Nachtrag: Das Format ist je Deck wählbar (Standard voreingestellt, Expanded, frei) und später änderbar.

## 2026-10-12 – Sammlungswert im Regal
- Jeder Binder zeigt im Regal „vorhanden / gesamt“ und den Wert der vorhandenen Karten (Cardmarket-Preistrend, Stückzahlen zählen mit); über dem Regal steht die Summe. Leere Binder zeigen nichts davon.
- Der Wert wird je Binder im Browser gemerkt (`pokebinder:shelf-values`) und steht beim nächsten Öffnen sofort da. Neu berechnet wird, wenn der Binder sich geändert hat oder der Wert älter als ein Tag ist – ein Binder nach dem anderen, im Hintergrund. Das erste Mal am Tag kostet eine Abfrage je Karte, danach kommen die Preise aus dem Vorrat der App.
- Kommt für keine einzige Karte ein Preis zurück (kein Netz), bleibt der gemerkte Wert stehen, statt auf 0 zu fallen.
- Karten ohne Preis zählen im Wert nicht mit; wie viele das sind, sagt weiterhin „Wert berechnen“ im Binder. Im Regal steht es nicht, um die Zeile kurz zu halten.
- Die gemerkten Werte sind die Grundlage für Punkt 4 (Preisverlauf).

## 2026-10-12 – Weitere Sammelkartenspiele in der Roadmap
- Von Henrik gewünscht: Punkt 14 „Weitere Sammelkartenspiele“ als Etappe G. Nur aufgenommen, nichts gebaut; welche Spiele und welche Datenquellen, ist offen und je Spiel zu prüfen.

## 2026-10-12 – Deck Builder, Schritt 1: Decks anlegen und bauen
- Von Henrik vorgezogen. Seine Vorgaben: zweites Regal unter den Bindern, der Bereich heißt „Meine Karten“; das Deck steht als flache Deckbox im Regal und kann wie ein Binder ein eigenes Bild tragen; die Deck-Ansicht ist ein Kartenraster wie „Karten stöbern“. Sein Bild einer Deckbox ist nicht angekommen – die Box ist vorerst selbst gezeichnet (Deckel mit Griffmulde, Bild oder Name auf der Front, Füllstand unten rechts).
- Ein Deck ist eine Liste (Karte, Sprache, Stückzahl), kein Raster aus Pockets; Varianten spielen keine Rolle. Es speichert wie ein Binder nur Verweise. Eigene Tabelle `decks` in der Datenbank des Browsers (Version 3), eigener Typ `Deck` (`src/types/deck.ts`), Logik in `src/features/decks/deckModel.ts`. Das Feld `format` gibt es schon (Standard), gewählt wird es erst in Schritt 2.
- Ansicht: zwei Reiter, „Deck“ (Karten nach Pokémon, Trainer, Energie, jede Karte einmal mit „×n“ und −/+) und „Karten hinzufügen“ (die Suche von „Karten stöbern“; ein Klick legt eine Kopie ins Deck, das Bild zeigt, wie oft sie schon drin ist). Jede Karte einmal mit Zahl statt jede Kopie einzeln: 20 Energien wären sonst 20 gleiche Bilder.
- Regeln in Schritt 1: 60 Karten; höchstens 4 mit gleichem Namen, über Drucke hinweg; Basis-Energie beliebig oft. Die App weist darauf hin, verbietet aber nichts – ein Deck im Bau ist meist ungültig.
- Art der Karte und Basis-Energie kommen aus der Einzelkarten-Antwort von TCGdex (`getPlayInfo`, dieselbe Antwort wie für den Preis). Solange sie fehlt, steht die Karte unter „Weitere Karten“. Für japanische und koreanische Karten kennt die App die Wörter für die Kartenart nicht; sie bleiben dort stehen.
- Noch nicht: Formatwahl und Erlaubtheit, Wert, Backup und Abgleich. Ein Bild auf der Deckbox liegt in der Bilder-Bibliothek; „Bild löschen“ dort weiß noch nichts von Decks.
- Die Tests der Decks nutzen Karten, deren Antworten schon aufgezeichnet sind; zusätzliche Aufzeichnungen hätten die Preis-Tests verändert, die auf genau drei Preisen beruhen.

## 2026-10-12 – Deck Builder, Schritt 2: Format, Wert, „schon im Binder“
- Format je Deck wählbar und jederzeit änderbar: Standard (voreingestellt), Expanded, Frei. Ob eine Karte erlaubt ist, sagt TCGdex je Karte (`legal.standard`, `legal.expanded`). Beanstandet wird nur, was sicher nicht erlaubt ist; fehlt die Angabe, gilt die Karte nicht als verboten. Die Rotation pflegt damit TCGdex, nicht die App.
- Ein Deck ist „gültig“, wenn es 60 Karten hat, keinen Namen öfter als viermal und keine nicht erlaubte Karte. Verboten wird weiterhin nichts, nur angezeigt.
- Wert: Cardmarket-Preistrend der üblichen Ausführung jeder Karte (ein Deck kennt keine Varianten) mal Stückzahl. Er steht ohne Knopfdruck da: Der Preis kommt aus derselben Einzelkarten-Antwort wie die Kartenart.
- „Im Binder“: gezählt wird, was in irgendeinem Binder als vorhanden markiert ist, mit Stückzahl und unabhängig von der Variante – aber genau diese Karte in dieser Sprache. Ein anderer Druck desselben Pokémon zählt nicht, obwohl er im Spiel gleichwertig wäre; das wäre eine eigene Erweiterung.
- Nicht erlaubte Karten tragen ein neutrales Schildchen, kein rotes: Rot bleibt dem Löschen vorbehalten.

## 2026-10-12 – Deck Builder, Schritt 3: Backup und Abgleich
- Backup: „Alles sichern“ enthält die Decks (`decks` in der Gesamtsicherung, fehlt in älteren Dateien). Beim Einspielen wird ein Deck übernommen, wenn es das Gerät nicht kennt oder die Fassung der Datei neuer ist – ohne Ankreuzen wie bei Bindern, weil ein Deck klein und schnell wieder geändert ist. Die Einzelsicherung eines Binders enthält keine Decks.
- Abgleich: Decks gehen denselben Weg wie Binder, in einer eigenen Liste auf dem Server (`/api/decks`, Tabelle `decks`, entsteht beim ersten Zugriff). Die Abgleich-Logik ist dafür verallgemeinert (`syncRecords` in `syncRun.ts`) statt kopiert; das Gerät merkt sich für Decks einen eigenen Stand und eigene Löschvermerke.
- Konflikte: Der Dialog nennt jetzt, ob es um einen Binder oder ein Deck geht; die Kopfzeile sagt „1 Konflikt klären“.
- Das Bild einer Deckbox wandert beim Abgleich mit, und die Bilder-Bibliothek weigert sich, ein Bild zu löschen, das noch auf einer Deckbox liegt.
- Heruntergeladene Decks laufen durch `readDeck` (Format, Karten, Stückzahlen); was die Prüfung nicht besteht, wird nicht übernommen.

## 2026-10-12 – Karte finden, im Binder und im Deck
- Binder: Lupe neben den Blätter-Pfeilen. Gesucht wird nach einem Teil des Namens (ohne Rücksicht auf Groß-/Kleinschreibung und Akzente) oder nach der Nummer – allein („25“, „025“) oder wie aufgedruckt („025/165“). Die Treffer nennen Seite und Pocket in der Reihenfolge des Binders; ein Klick (oder Enter für den ersten) blättert hin und wählt das Pocket aus.
- Die Namen stehen nicht im Binder (er speichert nur Verweise); sie werden beim Öffnen der Suche nachgeschlagen, eine Abfrage je Set, aus dem Vorrat der App.
- Deck: Henrik wollte die Suche auch in den „Deck Boxen“. Dort ist es ein Feld über den Karten, das die gezeigten Karten eingrenzt – ein Deck hat keine Seiten, zu denen man springen könnte.
- Die reine Logik liegt in `cardFinder.ts` (nicht `binderFind.ts`: der Name hätte sich unter Windows mit `BinderFind.tsx` nur in der Schreibweise unterschieden).

## 2026-10-12 – Etappe B: Wertverlauf und Wunschpreis
- Wertverlauf: Wenn das Regal die Werte der Binder kennt, hält es den Tag fest (`pokebinder:value-history`: je Tag der Wert jedes Binders). Nur vollständige Tage – fehlte ein Binder, sähe das wie ein Verlust aus. Täglich für 90 Tage, davor der letzte festgehaltene Tag jeder Woche. Im Regal steht die Veränderung seit dem ersten Tag, „Wertverlauf“ zeigt eine Linie (SVG, keine Bibliothek) für die Sammlung oder einen Binder.
- Der Verlauf beginnt mit dem ersten Öffnen des Regals nach dieser Änderung und liegt je Gerät; ein Abgleich zwischen Geräten ist offen.
- Wunschpreis: Henrik will ihn nur für ausgewählte Karten und in den Merklisten. Er gehört zur Karte auf der jeweiligen Liste (`wishPrice`), wandert darum mit Backup und Abgleich der Merklisten mit. Nur für Karten mit Wunschpreis fragt die App den aktuellen Preis ab. Erreicht der Preistrend den Wunsch, steht „Jetzt … €“ violett umrandet unter der Karte (ein aktiver Zustand), und der Reiter „Merkliste“ nennt die Zahl.
- Henriks „nur aufs Handy“ verstehe ich als Benachrichtigung auf dem Handy. Das geht nicht nebenbei: Geprüft wird bisher nur, während die App offen ist. Als eigener Punkt 5b in der Roadmap, mit der nötigen Regeländerung; die Entscheidung liegt bei Henrik.
- Dateinamen: `WishPriceLine.tsx` und `cardFinder.ts` heißen so, weil sich `WishPrice.tsx`/`wishPrice.ts` bzw. `BinderFind.tsx`/`binderFind.ts` unter Windows nur in der Schreibweise unterschieden hätten.
- Nachtrag: Henrik hat entschieden, dass der Preisalarm vorerst nur in der offenen App erscheint. Punkt 5b (Benachrichtigung aufs Handy) bleibt in der Roadmap, ist aber zurückgestellt.

## 2026-10-12 – Layouts 3 × 4 und 5 × 4
- Von Henrik gewählt. Ein Layout liest sich als Spalten × Zeilen: 3 × 4 sind drei Pockets nebeneinander und vier untereinander (12, hochkant), 5 × 4 fünf nebeneinander (20). Bei den bisherigen quadratischen Layouts war das gleichgültig.
- Alles, was vom Layout abhängt (Öffnungsseiten, Bilder über mehrere Pockets, Miniaturen, Bilddruck, Layoutwechsel), rechnet schon mit Spalten und Zeilen; neu sind nur die beiden Einträge.
- Die Doppelseite bleibt gleich breit: Bei 5 × 4 sind die Pockets bei gleichem Zoom kleiner, wie schon bei 4 × 4. Wer sie größer will, zoomt.
- Eine ältere Fassung der App auf einem anderen Gerät kennt die neuen Layouts nicht und lässt solche Binder beim Abgleich liegen, bis sie aktualisiert ist.
- Nachtrag: Punkt 7 (Seiten-Vorlagen) ist gestrichen. Henrik sieht den Anwendungsfall nicht; Seiten sind schnell neu gebaut. Etappe C ist damit abgeschlossen.

## 2026-10-12 – Binder per Link teilen
- Regeländerung, von Henrik entschieden: Wer den Link hat, darf den Binder ansehen, ohne Anmeldung („theoretisch kann ja auch jeder auf die Seite, der die URL hat“). CLAUDE.md ist ergänzt. Bisher gehörte alles auf dem Server genau einem Sammler.
- Der Link ist `…/?share=<Token>`. Das Token macht der Server: 18 Zufallsbytes, nicht zu erraten. Je Binder gibt es einen Link; wer ihn erneut anfordert, bekommt denselben. „Link ungültig machen“ löscht ihn, ein neuer Link ist ein anderer.
- Was offen ist, steht in `worker/shared.ts` und sonst nirgends: `/shared/<Token>` gibt genau den einen Binder heraus, `/shared/<Token>/assets/<Bild>` nur Bilder, die dieser Binder zeigt. Kein Name, keine E-Mail-Adresse, keine anderen Binder, Decks, Merklisten oder Bilder; nur Lesen. Zurückgezogene Links und gelöschte Binder antworten wie Links, die es nie gab. Die Cloudflare-Access-Anwendung schützt weiterhin `/api`; `/shared` liegt bewusst daneben.
- Geteilt wird der Binder, wie er auf dem Server liegt, darum braucht Teilen die Anmeldung und gleicht vorher ab. Der Link zeigt immer den aktuellen Stand.
- Ansehen: eine eigene Ansicht (`SharedBinderPage`) statt des Editors mit abgeschalteten Knöpfen – so kann nichts versehentlich änderbar sein, und der geteilte Binder landet nicht in der Datenbank des Besuchers. Seine Bilder werden nur für die Dauer der Ansicht gehalten.
- Beim Bauen gefunden und behoben: Beim Start setzte die App die Ansicht aufs Regal zurück; ein geteilter Link hätte so das eigene Regal gezeigt.
- Decks lassen sich noch nicht teilen.

## 2026-10-12 – Kartenlisten importieren in der Roadmap
- Von Henrik gewünscht, als Punkt 15 vor dem Tauschabgleich einsortiert. Nur aufgenommen; welche Dateiformate und wohin die Karten zuerst sollen, ist vor dem Bauen zu klären.
- Nachtrag: Henrik will Punkt 15 (Kartenlisten importieren) vorerst nur in den Anforderungen, nicht gebaut. Dazu neu Punkt 16, erweiterte Kartensuche (Illustrator, Farbe), ebenfalls nur aufgenommen. TCGdex kann nach Illustrator und Kartenart filtern (abgefragt); eine Bildfarbe gibt es dort nicht.
- Nachtrag: Henriks Idee einer Tauschbörse im Umkreis (Punkt 17) ist als Idee für später aufgenommen, ausdrücklich ohne Plan. In der Roadmap steht, was sie voraussetzen würde (offene Registrierung, Standortdaten, Moderation, Rechtliches).

## 2026-10-12 – Fehlerliste
- Von Henrik gewünscht, weil jetzt drei Freunde die App nutzen: `docs/BUGS.md` sammelt gemeldete Fehler mit Nummer, Stand und dem, was zum Nachstellen nötig ist. Erster Eintrag B-001 (Seiten mit vielen grauen Karten laden langsam), aufgenommen, noch nicht untersucht.
- Nachtrag zu Punkt 15: Die CSV von Cardmarket ist Pflicht (Henrik). Gebaut wird weiterhin nicht; vorher braucht es eine echte Beispieldatei, weil ich die Spalten der Cardmarket-Exporte nicht verlässlich kenne.

## 2026-10-12 – Set-Logo als Cover von Master-Set-Bindern
- Von Henrik gewünscht: Ein Master-Set-Binder ohne eigenes Cover-Bild zeigt das Logo seines Sets – im Regal, auf der Cover-Innenseite und in der geteilten Ansicht. Ein eigenes Cover-Bild geht vor; entfernt man es, kommt das Logo zurück.
- Gespeichert wird dafür nichts: Der Binder kennt sein Set, das Logo wird beim Anzeigen von TCGdex geholt (8–33 KB, vorgehalten wie die Kartenbilder) – wo es keines in der Sprache des Binders gibt, das englische. Kein Eintrag in der Bilder-Bibliothek, nichts im Backup, nichts beim Abgleich.
- Das Logo ist ein querformatiger Schriftzug: Es steht auf dem Cover, es füllt es nicht. Lädt es nicht (kein Netz), steht dort wie bisher der Titel.
- Im PNG-Export einer Seite spielt die Cover-Innenseite keine Rolle; das Logo ist dort vorsorglich ausgenommen.

## 2026-10-12 – Der gewählte Zoom bleibt
- Henrik stellt auf seinem großen Bildschirm jedes Mal von 80 % auf 140 %. Der selbst gewählte Zoom wird jetzt je Gerät gemerkt (`pokebinder:zoom`) und gilt für jeden Binder, der danach geöffnet wird – auch nach dem Schließen der App. Je Gerät, nicht im Abgleich: Bildschirm und Handy brauchen verschiedene Werte.
- Wer nie einen Zoom gewählt hat, bekommt wie bisher den, der zum Platz passt. Ein Klick auf die Prozentzahl zwischen − und + führt dorthin zurück.
- Am Handy gibt es die Zoom-Knöpfe nicht; dort bleibt es beim automatischen Zoom.

## 2026-10-12 – B-002: Namen in einer anderen Sprache
- Findet eine Namenssuche nichts, wird der Name in den anderen angebotenen Sprachen nachgeschlagen: Eine GraphQL-Abfrage liefert die Pokédex-Nummern der Karten, die so heißen (`dexIdsOfName`); die Karten kommen dann über `dexId=eq:<Nummer>` in der eingestellten Sprache. Mehrdeutige Namen („char“) stehen für bis zu sechs Pokémon.
- Nur wenn der Name gar nichts findet – sonst würde jede Suche doppelt fragen, und Treffer aus zwei Wegen müssten gemischt und geblättert werden.
- Trainer und Energie bleiben außen vor (keine Pokédex-Nummer). Ein Weg über gemeinsame Kartenkennungen wäre möglich, aber eine eigene Erweiterung.
- Für den Browser-Test sind drei Antworten zusätzlich aufgezeichnet; der Test-Doppelgänger erkennt die neue GraphQL-Abfrage am Namen.

## 2026-10-12 – B-001: Karten ohne Bild bei TCGdex
- Ursache und Korrektur stehen in `docs/BUGS.md`. Kern: Was die App über fehlende Bilder herausfindet, merkt sie sich jetzt (`scanMemory`), statt bei jedem Aufschlagen neu zu fragen; Ersatzbilder der zweiten Quelle kommen erst klein, dann groß; ihre Prüfung fragt nur noch den Status ab (`HEAD`), ohne Netz das Bild selbst.
- „Drei Karten ohne Bild und keine mit Bild“ gilt als „das Set hat keine“: genug, um nicht jede Karte einzeln zu probieren, und ein einziges gefundenes Bild nimmt die Annahme zurück. Gemerkt für eine Woche, weil TCGdex Bilder nachliefert.
- Im PNG-Export kann eine Karte aus der zweiten Quelle in der kleinen Fassung landen, wenn die große noch nicht da ist. In Kauf genommen: Der Export wartet nicht auf Megabytes.
- Lehre aus der Fehlersuche: Die erste Meldung nannte die grauen Karten, weil die betroffenen Sets zufällig die fast leeren waren. Erst Browser, Binder und „man sieht nur den Namen“ führten zur Ursache; darum steht in der Fehlerliste, was eine Meldung enthalten soll.

## 2026-10-12 – Fehlende Karten für Cardmarkets Wunschliste
- Nachgesehen (Hilfeseiten von Cardmarket): Hinein geht es offiziell über „Wants → Deckliste hinzufügen“, und zwar als eingefügter Text, eine Karte je Zeile; ein Pokémon braucht den englischen Namen plus Fähigkeiten und Attacken („Mew ex Restart Genome Hacking“), der Name allein wird abgelehnt. Einen offiziellen CSV-Export aus Cardmarket heraus habe ich nicht gefunden, nur inoffizielle Browser-Erweiterungen.
- Henrik wollte die CSV von „Was fehlt?“ dafür umbauen. Die CSV bleibt, wie sie ist (sie ist für Excel); daneben gibt es „Für Cardmarket-Wunschliste …“: ein Fenster mit dem Text zum Kopieren und den drei Schritten bei Cardmarket.
- Die englischen Namen und Attacken kommen aus der englischen Einzelkarte von TCGdex – dieselbe Antwort wie für den Preis. Karten, die es nicht auf Englisch gibt, stehen nicht in der Liste; das Fenster sagt, wie viele.
- Cardmarket unterscheidet in diesem Format nach Name und Attacken, nicht nach Druck. Mehrere Drucke einer Karte (normal, Illustration Rare) werden darum zu einer Zeile mit Stückzahl; welchen Druck man kauft, wählt man bei Cardmarket. Für „151“: 207 fehlende Karten ergeben 167 Zeilen.
- Nicht geprüft: ob Cardmarket jede dieser Zeilen erkennt – dafür braucht es ein Konto dort. Das Format folgt Cardmarkets eigenem Beispiel.
- Nachtrag, mit Henrik bei Cardmarket ausprobiert: Name plus Attacken trifft „irgendeine Version“; der genaue Druck wird über Erweiterung und Version in Klammern festgelegt (`1x Mew ex Restart Genome Hacking (V.2) (151)`). Die Versionen zählen in der Reihenfolge der Kartennummern (Mew ex: V.1 = 151/165, V.2 = 193/165, V.3 = 205/165), Sonderprodukte wie die Metallkarte kommen danach. Set-Kürzel und Nummer (`(MEW 205)`) kennt der Importer nicht. Meine erste Vermutung – Reihenfolge der Produktnummern – war falsch; Cardmarkets Produktliste wird nicht gebraucht.
- Die Liste nennt jetzt je Druck eine Zeile mit Erweiterung und, wo ein Set mehrere Drucke einer Karte hat, Version; derselbe Druck mehrfach (mehrere Varianten) wird addiert. Die Version ergibt sich aus den englischen Set-Daten von TCGdex.
- Bekannte Grenze: Manche Karten erkennt Cardmarket trotz Erweiterung und Version nur als „n versions“ (bei Henrik: Bulbasaur aus „151“); woran das liegt, lässt sich von hier nicht sehen. Zustand und Sprache gehören nicht in die Textzeile, sie werden bei Cardmarket an der Wunschliste eingestellt.

## 2026-10-12 – Wunschliste von Cardmarket importieren
- Einen Export hat Cardmarket nicht; Henrik hat die Tabelle einer Wunschliste markiert und kopiert (`docs/cardmarket-wants-beispiel.txt`). Der kopierte Text nennt je Eintrag Anzahl, Karte mit Set-Kürzel und Nummer („Mew ex (MEW 151)“) und darunter Erweiterung und Version. Das reicht, um jede Karte eindeutig zu finden – ohne Erweiterung im Browser und ohne Cardmarkets Produktliste.
- Zuordnung: Erweiterung über ihren Namen (in jeder Sprache, die die App anbietet; Cardmarket zeigt ihn in der Sprache der Oberfläche), Karte über ihre Nummer im Set. Das Set-Kürzel wird nicht gebraucht.
- Nicht übernommen wird: ein Eintrag ohne Erweiterung („egal welche“), eine unbekannte Erweiterung, eine Nummer, die es im Set nicht gibt, und ein Eintrag, dessen Version höher ist, als das Set Drucke dieses Namens hat – das ist ein Sonderprodukt wie die Metallkarte.
- Ergebnis ist ein neuer Binder (3 × 3, umstellbar), eine Karte je Pocket in der Reihenfolge der Liste, als fehlend; die gewünschte Anzahl spielt keine Rolle, ein Binder hat einen Platz je Karte. Vor dem Anlegen zeigt die App, was sie erkannt hat.
- Der Einstieg liegt im Regal neben „Neuer Binder“. Das Format hängt an Cardmarkets Seite: Ändert Cardmarket seine Tabelle, muss der Leser nachziehen; die Beispieldatei ist dafür als Test eingebunden.

## 2026-10-12 – Zwei weitere Punkte in der Roadmap
- Von Henrik gewünscht, nur aufgenommen: Punkt 19 „Nach Illustrator sortieren“ (klein, passt zu Punkt 16) und Punkt 20 „Ähnliche Karten finden“ nach Farben oder Komposition, aus der Karten-Info heraus.
- Punkt 20 steht als Idee mit vorgeschalteter Machbarkeitsprüfung: Die Ähnlichkeit lässt sich nur aus den Bildern errechnen, vorab und außerhalb der App.

## 2026-10-12 – Tauschabgleich mit Freunden
- In der Ansicht eines geteilten Binders gibt es „Tauschabgleich“: Der geteilte Binder wird mit allen eigenen Bindern des Geräts verglichen, in beide Richtungen – „Das kannst du bekommen“ (seine doppelten, die dir fehlen) und „Das kannst du geben“ (deine doppelten, die ihm fehlen), mit Preistrend und Summe je Richtung.
- Doppelt heißt wie in der Tauschliste: was über das eine Exemplar im Pocket hinaus da ist. Fehlend heißt: Die Karte hat ein Pocket und ist nicht da. Es zählt dieselbe Karte in derselben Sprache und Variante; getauscht werden höchstens so viele, wie doppelt sind und wie fehlen.
- Der Vergleich läuft im Browser dessen, der den Link öffnet; der Server erfährt davon nichts, und der Freund sieht ihn nicht. Verglichen wird der eine geteilte Binder, nicht die ganze Sammlung des Freundes – mehr gibt der Link nicht her.
- Anmeldung ist dafür nicht nötig: Es zählen die Binder, die auf dem Gerät liegen.
- Für den Browser-Test spielt ein zweites „Gerät“ mit denselben aufgezeichneten TCGdex-Antworten mit (`mockTcgdex` ist dafür exportiert).

## 2026-10-12 – Suche nach Illustrator und Kartenart, Sortieren nach Illustrator
- Zwei neue Filter in jeder Kartensuche (neben dem Binder, „Karten stöbern“, Deck): „Kartenart“ als Liste und „Illustrator“ als Textfeld mit Vorschlägen. Beide Listen kommen von TCGdex (`categories`, `illustrators`) und werden wie alles andere gecacht.
- Beim Illustrator genügt ein Teil des Namens, ab zwei Zeichen; kürzere Eingaben zählen nicht. Illustrator und Kartenart reichen wie Seltenheit und Typ auch allein als Suche; die Treffer kommen wie sonst seitenweise.
- Sortieren: „Nach Illustrator“ für Seite oder ganzen Binder, alphabetisch nach Künstler, innerhalb eines Künstlers nach Set und Nummer; Karten ohne bekannten Illustrator ans Ende.
- Den Illustrator liefert die Set-Abfrage jetzt mit. Der Cache-Schlüssel der Set-Details heißt deshalb `v2`: Jedes Set wird einmal neu geholt, alte Einträge bleiben ungenutzt liegen.
- „Farbe“ meint laut Henrik die Farbe des Bildes. Das kann TCGdex nicht und bleibt Punkt 20 (ähnliche Karten) mit eigener Machbarkeitsprüfung.

## 2026-10-12 – Ähnliche Farben (erster Schritt von Punkt 20)
- Machbarkeit an 367 Karten geprüft: Bei Bildern mit klaren Farben (feurig-orange, Wiese, Wasser) passen die Treffer gut, bei bunt gemischten Bildern nur teilweise. Henrik hat danach das Bauen freigegeben.
- Je Karte wird eine Farbkennung aus 52 Zahlen berechnet: wie viel des Bildfensters (nicht des Rahmens) auf zwölf Farbtöne in je vier Stufen und auf vier Graustufen entfällt. Ähnlich sind zwei Karten, wenn sich diese Verteilungen stark überdecken.
- Die Auswertung läuft vorab mit `npm run colours` auf dem eigenen Rechner, im Browser, den Playwright mitbringt – keine neue Abhängigkeit, kein neuer Dienst. Der erste Lauf lädt einmalig die kleinen Bilder aller englischen Karten von TCGdex (gebremst, vier gleichzeitig), spätere Läufe nur die neuer Karten. Das Ergebnis liegt im Repo (`public/colours/`) und geht mit jedem Push live; die App lädt es erst, wenn jemand „Ähnliche Farben“ drückt.
- Von Henrik entschieden: gesucht wird immer über die englischen Karten, ohne Eingrenzung auf ein Set. Von mir ergänzt: Die Treffer erscheinen in der Sprache der Karte, von der aus gesucht wird, und auf Englisch, wo es eine Karte in dieser Sprache nicht gibt.
- Die Treffer stehen in der Karten-Info unter der Karte. Von dort lässt sich nicht in den Binder ziehen (die Info liegt über allem); gemerkt wird mit dem Stern, von der Merkliste aus kommt die Karte in den Binder.
- Wird die Berechnung der Kennung geändert, müssen alle Karten neu ausgewertet werden (`public/colours/` löschen, Skript neu starten).

## 2026-10-12 – Ähnliche Farben nur unter den hohen Seltenheiten
- Rückmeldung von Henrik nach dem ersten Stand: Zu einer Special Illustration Rare kamen lauter gewöhnliche Karten mit rosa Hintergrund – farblich richtig, als Vorschlag unbrauchbar. Sein Vorschlag: nur Illustration Rares und höher.
- Angeboten werden deshalb nur noch Karten dieser Seltenheiten, wie TCGdex sie auf Englisch nennt: Illustration rare, Special illustration rare, Ultra Rare, Hyper rare, Mega Hyper Rare, Mega Attack Rare, Secret Rare, Shiny Ultra Rare, Black White Rare, Amazing Rare (2.824 Karten). Die Liste steht in `scripts/colours.mjs`. Promos zählen nicht dazu, auch wenn manche Full-Arts sind: TCGdex führt sie nur als „Promo“.
- Bei diesen Karten zählt die ganze Karte ohne Rand statt nur des Bildfensters, weil das Bild die Karte füllt. Ausgehen kann man weiter von jeder Karte; bei gewöhnlichen zählt das Bildfenster.
- `public/colours/cards.json` nennt dafür, wie viele Karten am Anfang zu den hohen Seltenheiten gehören.
- Nebenbei behoben: Hat eine Karte in der eigenen Sprache kein Bild, wird der Treffer auf Englisch gezeigt.

## 2026-10-12 – Bildmodell für ähnliche Karten, Themen unter „Karten stöbern“
- Henrik hat eine Herbstseite als Ziel abgelegt (`docs/KartenSucheVorlage*.png`). Gemessen an neun ihrer Karten: Wie viele der acht anderen stehen unter den 24 Vorschlägen? Nur Farben 19 von 72, nur Bildmodell 15, beides zusammen 24–25. Andere Farbvergleiche (Nachbarfarbtöne, Lab-Farbraum, Lage der Farben) brachten nichts.
- Viel besser passt die Suche nach einem Thema in Worten: „goldener Herbst“ findet zwei Karten der Vorlage auf Platz 1 und 2 und sechs von neun unter den ersten 60. Deshalb gibt es Themen.
- Bildmodell: CLIP (Xenova/clip-vit-base-patch32) über @huggingface/transformers, von Henrik freigegeben. Es läuft nur im Auswertungsskript auf dem eigenen Rechner. Weil die Bibliothek über 1 GB groß ist, hat `scripts/looks/` eine eigene `package.json`; der Build der App bei Cloudflare installiert sie nicht.
- `npm run colours` macht jetzt beides nacheinander. Ergebnis: `public/colours/looks.bin` (512 Zahlen je Karte als ganze Zahlen, 1,4 MB) und `looks.json` (Karten und je Thema die 60 passendsten). Die App lädt sie erst bei Bedarf.
- „Ähnliche Karten“ (vorher „Ähnliche Farben“): drei Viertel Bildmodell, ein Viertel Farben. Geht man von einer gewöhnlichen Karte aus, die das Modell nicht angesehen hat, zählen die Farben allein.
- Themen stehen als fester Satz im Skript (englische Beschreibung für das Modell) und mit deutschem Namen in `de.ts`. Von mir gewählt, da Henrik keine Liste genannt hat: 14 Themen. Ausprobiert und weggelassen, weil die Treffer nicht passten: Himmel, Höhle, Gewitter, Regen, Weltraum.
- Themen nur unter „Karten stöbern“ als eigener Reiter (Entscheidung Henrik), gezeigt werden 48 Karten je Thema.

## 2026-10-12 – Mehr Karten und Reihenfolge nach Farbe
- Auf Henriks Nachfrage: „Ähnliche Karten“ zeigt 24 und mit „Mehr anzeigen“ je 24 weitere, höchstens 96. Themen zeigen 48 und je 48 weitere, höchstens 144 (so viele hält das Skript je Thema fest). Weiter hinten passen die Karten weniger gut.
- Themen lassen sich „Nach Farbe“ ordnen: dieselben Karten in der Reihenfolge des Farbkreises (Rot, Orange, Gelb, Grün, Blau, Violett), danach die überwiegend grauen von dunkel nach hell. Maßgeblich ist die mittlere Farbe des Bildes aus der Farbkennung. Es wird nur umsortiert, nicht anders ausgewählt.

## 2026-10-12 – Themen: Suche nach der Farbe des Bildes
- Von Henrik gewünscht: unter „Themen“ auch einfach nach einer Farbe suchen, etwa Orange, allein oder zusammen mit einem Thema. Der Reiter hat dafür drei Auswahlfelder statt der Themen-Knöpfe: Thema, Farbe, Reihenfolge.
- Zehn Farben: Rot, Orange, Gelb, Grün, Türkis, Blau, Violett, Pink, Schwarz, Weiß. Eine Karte hat eine Farbe, wenn mindestens ein Viertel ihres Bildes diese Farbe hat (aus der Farbkennung); eine Karte kann so zu zwei Farben gehören.
- Nur Farbe: die Karten der hohen Seltenheiten mit dem größten Anteil dieser Farbe zuerst, höchstens 144. Thema und Farbe: die Karten des Themas, die diese Farbe haben, in der Reihenfolge des Themas.
- Braun und Gold gibt es nicht als eigene Farbe: Die Farbkennung trennt sie nicht sauber von dunklem Orange und Gelb.

## 2026-10-12 – Größere Bildmodelle verglichen; „Passend“ neben dem Binder
- Henrik fand die Treffer „okay, aber eher mittel“ und wollte aufwändigere Auswertungen ausprobieren. Verglichen an seiner Herbstseite (neun Karten; wie viele der acht anderen stehen unter den ersten 24, von 72): jetziges Modell mit Farben 25; CLIP Large mit Farben 22–26; CLIP Base/16 17–20; SigLIP 21; DINOv2 8; alle Modelle zusammen 26; Vergleich über ein „Stimmungsprofil“ aus 72 Beschreibungen 16–21. Größere Modelle bringen also nichts; das Modell bleibt.
- Geholfen hat nur, mit mehreren Karten gleichzeitig zu fragen: von 35 % der übrigen Karten unter den ersten 24 (eine Karte) auf 42 % (drei) und 47 % (fünf).
- Daraus gebaut: Reiter „Passend“ in der Spalte neben dem Binder. Gefragt wird mit allen Karten der aufgeschlagenen Seiten; die Ähnlichkeiten werden addiert. Karten, die schon irgendwo im Binder liegen, werden nicht vorgeschlagen. Die Vorschläge lassen sich wie Suchtreffer in den Binder ziehen und passen sich an, sobald eine Karte dazukommt.
- Damit vier Reiter in die schmale Spalte passen, heißt „Eigene Bilder“ dort nur noch „Bilder“.
- Vorgemerkt, nicht gebaut (Henrik, 12.10.2026): jede Karte von einem großen Sprachmodell beschreiben lassen (Stichworte zu Jahreszeit, Ort, Stimmung) für eine freie Textsuche. Braucht einen bezahlten Dienst und einen API-Schlüssel; erst an etwa 50 Karten Kosten und Nutzen testen.
- Nebenbei: Ein Test zum Teilen-Link schlug zufällig fehl, wenn der zufällige Link auf „x“ endete (der Test tauschte das letzte Zeichen gegen „x“). Der Test ist korrigiert; am Server war nichts falsch.

## 2026-10-13 – Karten-Info zeigt die eigene Sammlung
- Von Henrik vorgeschlagen: Die Karten-Info nennt unter „In deiner Sammlung“, wie viele Exemplare der Karte vorhanden sind und in welchen Bindern sie liegt (Binder, Seiten, vorhanden oder fehlt).
- Gezählt wird wie überall: ein abgehaktes Pocket mit seiner Anzahl. Pockets, in denen die Karte liegt, aber noch fehlt, erscheinen als „fehlt“.
- Die Karte zählt in jeder Sprache und Variante. Jede Binder-Zeile trägt die Flagge der Sprache (Henrik, 13.10.2026: manche Karten hat er mehrfach in verschiedenen Sprachen); gibt es die Karte in mehr als einer Sprache, steht neben der Gesamtzahl die Anzahl je Sprache. Decks zählen nicht mit: Sie sind eine Liste zum Spielen, kein Bestand.
- Gelesen werden die Binder dieses Geräts.

## 2026-10-13 – Die Suche behält ihre Eingaben beim Sprachwechsel
- Von Henrik gewünscht: Wechselt man in einer Suche die Sprache der Karten, bleiben Suchbegriff, Set und Filter stehen. Bisher begann die Suche leer, weil Sets, Typen und Seltenheiten in jeder Sprache anders heißen.
- Suchtext, Set und Illustrator werden unverändert übernommen. Typ, Kartenart und Seltenheit werden in den Namen der neuen Sprache übersetzt (feste Tabelle Deutsch ↔ Englisch in `src/lib/tcgdex/filterNames.ts`; Japanisch nutzt bei TCGdex die englischen Namen).
- Was es in der neuen Sprache nicht gibt, fällt weg: ein Set, das dort nie erschienen ist (japanische Sets haben eigene Kennungen), oder eine Seltenheit, die die Sprache nicht kennt.
- Gilt für alle drei Suchen: neben dem Binder, „Karten stöbern“ und im Deck.

## 2026-10-13 – Ablage im Binder; Karten-Info mit „Zu Binder hinzufügen“
- Die Ablage ist Teil des Binders (`tray` im Datenmodell, weggelassen, solange sie leer ist): Sie wird mit ihm gespeichert, abgeglichen und gesichert. Jede abgelegte Karte behält Sprache, Variante, „vorhanden“ und Anzahl.
- „Ablage“ ist kein eigener Modus neben Bearbeiten und Sammlung, sondern Bearbeiten mit der Ablage in der linken Spalte: Pockets lassen sich weiter ziehen, markieren und verschieben. Die Suche bleibt dahinter erhalten.
- Abgelegte Karten zählen mit (Entscheidung Henrik): Fortschritt, Wert, „Was fehlt?“, Tauschliste, Tauschabgleich, „In deiner Sammlung“ und Deck-Abdeckung gehen über die Ablage wie über eine weitere Seite. In Listen mit Seitenangabe steht dort „Ablage“.
- Eine Karte auf ein belegtes Pocket ziehen tauscht: Die Karte dort kommt an dieselbe Stelle der Ablage. So geht nichts verloren.
- Das kleine rote Kreuz an einer abgelegten Karte nimmt sie ganz aus dem Binder.
- Der Teilen-Link gibt die Ablage nicht heraus: Der Server entfernt sie aus der Antwort. Die geteilte Ansicht zählt deshalb nur, was auf den Seiten liegt.
- Master Set neu aufbauen: Karten des Sets aus der Ablage zählen als vorhanden und stehen danach wieder in ihrem Pocket; fremde Karten bleiben in der Ablage.
- „Zu Binder hinzufügen“ in der Karten-Info legt die Karte als vorhanden in die Ablage des gewählten Binders, in der Sprache, in der sie angesehen wird, und in ihrer Grundvariante. Ein Auswahlmenü, das nach dem Wählen wieder auf dem ersten Eintrag steht: Das Wählen ist die Handlung.
- Merklisten in der Karten-Info: eine eingeklappte Zeile statt eines Kästchens je Liste (Henrik: bei vielen Listen zu viele Anklickpunkte). Aufgeklappt wie bisher Ankreuzen und „Neue Liste“.

## 2026-10-13 – Rechtsklick legt die Karte in die Ablage
- Von Henrik gewünscht: Ein Rechtsklick auf eine Karte im Binder legt sie in die Ablage, statt sie aus dem Binder zu nehmen. Ganz entfernen geht weiter mit Entf, „Pocket leeren“ oder dem roten Kreuz in der Ablage. Wie bisher nur im Modus „Bearbeiten“.

## 2026-10-13 – Merklisten und Ablage: suchen, ordnen, übernehmen
- Punkte 22, 23, 28, 29 und 32 zusammen gebaut. Wo Henrik Fragen offen gelassen hatte, habe ich so entschieden:
- **22 – andere Sprache:** Die Merkliste hält weiter die Sprache fest (für Preis und Kauf nötig); nur die Anzeige ist sprachübergreifend. Der Stern ist dann farbig umrandet, aber nicht gefüllt, und nennt die Sprache.
- **23 – Reihenfolge:** zuletzt gemerkt (wie bisher), Name, Set und Nummer, Farbe. Nach Preis nicht: Dafür müssten erst alle Preise der Liste geladen sein. Die Suche meint Name, Nummer, Set und Kennung; alle Wörter müssen vorkommen.
- **28 – Merkliste in Binder:** in die Ablage, als „vorhanden“, die Karten bleiben auf der Liste – so, als hätte man jede einzeln hineingezogen. Übernommen wird, was gerade gezeigt wird; mit Rückfrage, weil es viele Karten auf einmal sind.
- **29 – Binder auf Merkliste:** über die Auswahl rechts, für eine oder alle markierten Karten. Was schon auf der Liste steht, bleibt unverändert. Eine ganze Seite geht über „Mehrere auswählen“.
- **32:** dieselbe Suche wie in den Merklisten.

## 2026-10-13 – Cardmarket-Link, Deck-Warnung, Ablege-Knopf, Spaltenbreite
- **26:** Der Link nutzt die Cardmarket-Produktnummer, die TCGdex mit dem Preis liefert (`…/Products?idProduct=…`), sonst eine Suche nach dem Namen. Er ist ein gewöhnlicher Link in einen neuen Tab; die App fragt Cardmarket nicht ab. Ob die Adresse bei Cardmarket wirklich ankommt, ließ sich von hier nicht prüfen (Cardmarket weist automatische Abrufe ab) – dieselbe Adresse verwendet die Kaufliste schon.
- **27:** Rot bekommt eine zweite Bedeutung: Regelverstoß in einem Deck (CLAUDE.md entsprechend ergänzt). Nur echte Verstöße sind rot – zu viele Karten gleichen Namens, im Format nicht erlaubte Karten. Ein Deck, das noch nicht voll ist, wäre sonst beim Bauen dauerhaft rot.
- **30:** Der Knopf sitzt unten rechts (oben links steht die Anzahl, oben rechts „fehlt“/„vorhanden“). Als Zeichen ein Pfeil in eine Ablage statt eines Plus, das nach Hinzufügen aussähe. Nicht im Modus „Sammlung“.
- **31:** Beide Spalten getrennt verstellbar, auch mit den Pfeiltasten. Die Kartenraster in den Spalten füllen jetzt die Breite (vorher immer zwei nebeneinander); bei der üblichen Breite bleiben es zwei.
