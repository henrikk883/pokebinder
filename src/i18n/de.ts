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
    empty: 'Noch keine Karten geladen.',
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
