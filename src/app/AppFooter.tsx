import { de } from '../i18n/de'

export function AppFooter() {
  return (
    <footer className="shrink-0 border-t border-line bg-panel px-5 py-2 text-xs text-muted max-md:px-3 max-md:py-1 max-md:text-[0.625rem] max-md:leading-tight">
      {de.footer.disclaimer}
    </footer>
  )
}
