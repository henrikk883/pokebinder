import { useState } from 'react'
import { de } from '../../i18n/de'
import type { Binder } from '../../types/binder'
import { ShoppingDialog } from './ShoppingDialog'

/**
 * "Kaufliste": what is still missing in the binder and what it costs, one press away. On
 * a phone, where the toolbar is short of room, a price tag stands for the word.
 */
export function ShoppingButton({ binder, buttonClass }: { binder: Binder; buttonClass: string }) {
  // the list is of the binder as it was when asked for; later changes do not move it
  const [shown, setShown] = useState<Binder | null>(null)

  return (
    <>
      <button type="button" onClick={() => setShown(binder)} className={buttonClass}>
        <svg
          viewBox="0 0 24 24"
          className="size-5 md:hidden"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 4h8l10 10-7 7L4 11z" />
          <circle cx="8" cy="8" r="1.5" />
        </svg>
        <span className="max-md:sr-only">{de.shopping.menu}</span>
      </button>
      {shown && (
        <ShoppingDialog
          title={de.shopping.title(shown.name)}
          load={async (onProgress) => (await import('./missingListTransfer')).loadShoppingRows(shown, onProgress)}
          onClose={() => setShown(null)}
        />
      )}
    </>
  )
}
