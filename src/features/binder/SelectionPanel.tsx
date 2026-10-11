import { de } from '../../i18n/de'

export function SelectionPanel() {
  return (
    <section className="p-4">
      <h2 className="text-lg font-semibold">{de.selection.title}</h2>
      <p className="mt-4 text-sm text-muted">{de.selection.empty}</p>
    </section>
  )
}
