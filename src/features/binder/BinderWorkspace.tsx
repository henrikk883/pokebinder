import { de } from '../../i18n/de'

export function BinderWorkspace() {
  return (
    <section className="flex h-full flex-col p-5">
      <h2 className="text-2xl font-semibold">{de.binder.title}</h2>
      <div className="mt-5 flex min-h-64 flex-1 items-center justify-center rounded-panel border border-dashed border-line bg-panel">
        <p className="text-sm text-muted">{de.binder.empty}</p>
      </div>
    </section>
  )
}
