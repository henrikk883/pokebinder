import { de } from '../i18n/de'

export function AppFooter() {
  return (
    <footer className="shrink-0 border-t border-line bg-panel px-5 py-2 text-xs text-muted">
      {de.footer.disclaimer}
    </footer>
  )
}
