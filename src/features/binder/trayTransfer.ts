import { binderRepository } from '../../db/binderRepository'
import { binderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import type { CardLang } from '../../types/binder'
import { requestSync } from '../sync/syncStore'
import { addToTray } from './binderModel'
import { baseVariantOf } from './placeCard'

export interface BinderName {
  id: string
  name: string
}

/** The binders of this device by name, the most recently changed first. */
export async function listBinderNames(): Promise<BinderName[]> {
  // the open binder may still be on its way to the database
  await binderStore.getState().whenSaved()
  return (await binderRepository.listBinders()).map(({ id, name }) => ({ id, name }))
}

/**
 * Lays cards into the tray of a binder, as owned and in the finish each card really has.
 * The binder on the table is changed through its store, so that the step can be taken back;
 * any other is read, changed and stored.
 */
export async function layIntoBinder(binderId: string, cards: readonly { cardId: string; lang: CardLang }[]): Promise<void> {
  const cardRefs = await Promise.all(
    cards.map(async ({ cardId, lang }) => ({ cardId, lang, variant: await baseVariantOf(cardId, lang) })),
  )
  const store = binderStore.getState()
  if (store.binder?.id === binderId) {
    store.addToTray(cardRefs)
    await binderStore.getState().whenSaved()
    return
  }
  const stored = await binderRepository.loadBinder(binderId)
  if (!stored) throw new Error('binder is gone')
  await binderRepository.saveBinder(addToTray(stored, cardRefs))
  useEditorStore.getState().refreshBinderList()
  requestSync()
}
