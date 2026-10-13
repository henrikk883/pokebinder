import { defaultContext, type ModelContext } from '../binder/binderModel'
import type { Binder } from '../../types/binder'

/**
 * A binder somebody shared, as a binder of one's own: the same pages, cards, pictures and
 * cover, but with a new identity, so that it has nothing to do with the original any more.
 * Changes to the copy stay in the copy, and what its first collector changes later does not
 * arrive in it. Every card starts as missing: what was ticked off was the other one's
 * collection. The pictures keep their ids; they are stored beside the copy.
 */
export function copyOfShared(shared: Binder, ctx: ModelContext = defaultContext): Binder {
  const now = ctx.now()
  // a shared binder comes without a tray; were there one, it would not be copied either
  const { tray: _tray, ...rest } = shared
  void _tray
  return {
    ...rest,
    id: ctx.newId(),
    cover: { ...shared.cover },
    pages: shared.pages.map((page) => ({
      ...page,
      id: ctx.newId(),
      slots: page.slots.map((slot) => (slot.cardRef ? { index: slot.index, cardRef: { ...slot.cardRef }, owned: false } : { index: slot.index, owned: false })),
      images: page.images.map((image) => ({ ...image, id: ctx.newId(), crop: { ...image.crop } })),
    })),
    createdAt: now,
    updatedAt: now,
  }
}
