import { useEffect, useRef, type RefObject } from 'react'

/**
 * Closes a menu when the collector clicks or taps anywhere outside of it. Returns the ref
 * for the element that holds the menu and the button that opens it: a press inside is the
 * menu's own business.
 */
export function useDismiss<T extends HTMLElement>(open: boolean, onDismiss: () => void): RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!open) return
    function handlePress(event: PointerEvent) {
      const inside = event.target instanceof Node && ref.current?.contains(event.target)
      if (!inside) onDismiss()
    }
    // while it goes down the page, before anything there can stop it
    document.addEventListener('pointerdown', handlePress, true)
    return () => document.removeEventListener('pointerdown', handlePress, true)
  }, [open, onDismiss])

  return ref
}
