import { MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'

/** Movement that tells a drag with the mouse from a click. */
const MOUSE_DISTANCE_PX = 6
/**
 * A finger has to rest this long before it picks something up. Until then a swipe scrolls
 * as usual; without the wait, the long lists could not be scrolled without grabbing a card.
 */
export const TOUCH_HOLD_MS = 250
/** How far the finger may wander while it rests. */
const TOUCH_TOLERANCE_PX = 8

/** How dragging starts: at once with the mouse, after a short hold with a finger. */
export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: MOUSE_DISTANCE_PX } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: TOUCH_HOLD_MS, tolerance: TOUCH_TOLERANCE_PX },
    }),
  )
}
