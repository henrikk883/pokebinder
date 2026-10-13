import { useEffect, useState } from 'react'
import { loadColourIndex } from './colourIndex'
import type { ColourIndex } from './similarColours'

/** The colours of the card pictures, once they are asked for; `undefined` until they are there. */
export function useColours(wanted: boolean): ColourIndex | undefined {
  const [colours, setColours] = useState<ColourIndex>()

  useEffect(() => {
    if (!wanted) return
    let cancelled = false
    loadColourIndex().then(
      (index) => {
        if (!cancelled) setColours(index)
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [wanted])

  return colours
}
