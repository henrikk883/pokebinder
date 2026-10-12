import { useSyncExternalStore } from 'react'

/**
 * Screens too narrow for a binder with its columns beside it: phones. There the app shows
 * one thing at a time (binder, search or selection) and one page instead of two. Tablets
 * and upright ones too are wide enough for the columns.
 */
const PHONE_QUERY = '(max-width: 47.99rem)'

function query(): MediaQueryList | undefined {
  // not there where tests run without a browser
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(PHONE_QUERY)
    : undefined
}

/** Whether the app runs on a phone-sized screen right now; for code outside of components. */
export function isPhone(): boolean {
  return query()?.matches ?? false
}

function subscribe(onChange: () => void): () => void {
  const list = query()
  list?.addEventListener('change', onChange)
  return () => list?.removeEventListener('change', onChange)
}

/** The same for components; follows the screen when it is turned or the window resized. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, isPhone, () => false)
}
