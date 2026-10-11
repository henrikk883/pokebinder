import { de } from '../../i18n/de'

export function SearchPanel() {
  return (
    <section className="p-4">
      <h2 className="text-lg font-semibold">{de.search.title}</h2>
      <p className="mt-4 text-sm text-muted">{de.search.empty}</p>
    </section>
  )
}
