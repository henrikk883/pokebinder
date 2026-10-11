import { de } from '../../i18n/de'
import { useBinderStore } from '../../store/binderStore'

export function BinderWorkspace() {
  const binder = useBinderStore((state) => state.binder)

  return (
    <section className="flex h-full flex-col p-5">
      <h2 className="text-2xl font-semibold">{binder ? binder.name : de.binder.title}</h2>
      <div className="mt-5 flex min-h-64 flex-1 items-center justify-center rounded-panel border border-dashed border-line bg-panel">
        <p className="text-sm text-muted">
          {binder ? de.binder.summary(binder.layout, binder.pages.length) : de.binder.empty}
        </p>
      </div>
    </section>
  )
}
