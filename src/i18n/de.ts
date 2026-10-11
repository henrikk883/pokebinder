export const de = {
  app: {
    name: 'PokéBinder',
  },
  header: {
    myBinders: 'Meine Binder',
  },
  saveStatus: {
    saving: 'Speichert …',
    saved: 'Lokal gespeichert',
    error: 'Speichern fehlgeschlagen',
  },
  backup: {
    button: 'Backup',
    export: 'Als JSON exportieren',
    import: 'Aus JSON importieren',
    fileInput: 'Backup-Datei auswählen',
    exportFailed: 'Das Backup konnte nicht erstellt werden.',
    importFailed: 'Das Backup konnte nicht importiert werden.',
    errors: {
      invalidJson: 'Die Datei ist kein gültiges JSON.',
      wrongFormat: 'Die Datei ist kein PokéBinder-Backup.',
      unsupportedVersion: 'Dieses Backup stammt aus einer neueren Version der App.',
      invalidData: 'Das Backup ist beschädigt oder unvollständig.',
    },
  },
  search: {
    title: 'Karten suchen',
    tabs: {
      cards: 'Karten',
      images: 'Eigene Bilder',
    },
    placeholder: 'Name, Set oder Nummer',
    setFilter: 'Set',
    allSets: 'Alle Sets',
    findSet: 'Set suchen',
    noSets: 'Kein Set gefunden.',
    setsLoading: 'Sets werden geladen …',
    setsError: 'Die Sets konnten nicht geladen werden.',
    rarity: 'Seltenheit',
    type: 'Typ',
    language: 'Deutsch',
    languageHint: 'Weitere Sprachen folgen in einer späteren Version.',
    idle: 'Namen eingeben oder ein Set wählen.',
    needsContext: 'Für die Suche nach einer Nummer bitte ein Set wählen oder einen Namen ergänzen.',
    loading: 'Lädt …',
    error: 'Die Karten konnten nicht geladen werden. Besteht eine Internetverbindung?',
    noResults: 'Keine Karten gefunden.',
    resultCount: (count: number, hasMore: boolean, setName: string | undefined) => {
      const cards = `${count}${hasMore ? '+' : ''} ${count === 1 && !hasMore ? 'Karte' : 'Karten'}`
      return setName ? `${setName} · ${cards}` : cards
    },
    more: 'Mehr laden',
    noImage: (name: string) => `${name} (kein Bild vorhanden)`,
  },
  binder: {
    title: 'Binder',
    empty: 'Noch kein Binder angelegt.',
    summary: (layout: string, pageCount: number) =>
      `Layout ${layout.replace('x', ' × ')} · ${pageCount} ${pageCount === 1 ? 'Seite' : 'Seiten'}`,
  },
  selection: {
    title: 'Auswahl',
    empty: 'Kein Pocket ausgewählt.',
  },
  footer: {
    disclaimer:
      'Inoffizielles Fanprojekt, nicht mit The Pokémon Company verbunden. Kartenbilder © The Pokémon Company.',
  },
} as const
