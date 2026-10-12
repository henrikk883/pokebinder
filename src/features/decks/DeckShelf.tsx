import { useEffect, useState } from 'react'
import { deckRepository } from '../../db/deckRepository'
import { de } from '../../i18n/de'
import { confirmDialog, promptDialog } from '../../store/dialogStore'
import { useDeckStore } from '../../store/deckStore'
import { useEditorStore } from '../../store/editorStore'
import type { Deck } from '../../types/deck'
import { DeckBox } from './DeckBox'
import { createDeck, renameDeck } from './deckModel'

const smallButtonClass = 'h-8 min-w-0 truncate rounded-control border px-2 text-xs'

/** The second shelf of "Meine Karten": the decks to play with, each in its box. */
export function DeckShelf() {
  const openDeck = useDeckStore((state) => state.openDeck)
  const adoptDeck = useDeckStore((state) => state.adoptDeck)
  const [decks, setDecks] = useState<Deck[]>([])
  const [version, setVersion] = useState(0)
  const listVersion = useEditorStore((state) => state.binderListVersion)

  useEffect(() => {
    let cancelled = false
    // a deck that was just closed may still be on its way to the database
    useDeckStore
      .getState()
      .whenSaved()
      .then(() => deckRepository.listDecks())
      .then(
        (stored) => {
          if (!cancelled) setDecks(stored)
        },
        () => undefined,
      )
    return () => {
      cancelled = true
    }
  }, [version, listVersion])

  async function handleCreate() {
    const name = await promptDialog({
      title: de.decks.create,
      label: de.decks.name,
      value: '',
      confirmLabel: de.decks.createConfirm,
    })
    if (name !== null) adoptDeck(createDeck(name))
  }

  async function handleRename(deck: Deck) {
    const name = await promptDialog({
      title: de.decks.rename,
      label: de.decks.name,
      value: deck.name,
      confirmLabel: de.decks.renameConfirm,
    })
    if (name === null) return
    await deckRepository.saveDeck(renameDeck(deck, name))
    setVersion((current) => current + 1)
  }

  async function handleDelete(deck: Deck) {
    const agreed = await confirmDialog({
      title: de.decks.deleteTitle(deck.name),
      text: de.decks.confirmDelete,
      confirmLabel: de.decks.delete,
      danger: true,
    })
    if (!agreed) return
    await deckRepository.deleteDeck(deck.id)
    setVersion((current) => current + 1)
  }

  return (
    <div className="mt-10" data-testid="deck-shelf">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold">{de.decks.title}</h3>
        <button
          type="button"
          onClick={handleCreate}
          className="flex h-10 items-center gap-2 rounded-control border border-line bg-raised px-4 text-sm font-medium hover:border-accent"
        >
          <span aria-hidden="true">+</span>
          {de.decks.create}
        </button>
      </div>
      {decks.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{de.decks.empty}</p>
      ) : (
        <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-5 gap-y-7 max-md:grid-cols-2 max-md:gap-x-3">
          {decks.map((deck) => (
            <li key={deck.id} data-testid="deck-tile" data-deck-name={deck.name} className="shelf-item flex min-w-0 flex-col">
              <button
                type="button"
                aria-label={de.decks.open(deck.name)}
                onClick={() => openDeck(deck)}
                className="group block w-full text-left"
              >
                <DeckBox deck={deck} />
                <span className="mt-3 block truncate text-base font-medium group-hover:text-accent-hover">
                  {deck.name}
                </span>
                <span className="block text-xs text-muted">
                  {de.decks.formats[deck.format]} · {de.decks.kinds(deck.cards.length)}
                </span>
              </button>
              <div className="shelf-actions mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-label={de.decks.renameLabel(deck.name)}
                  onClick={() => handleRename(deck)}
                  className={`${smallButtonClass} border-line bg-raised hover:border-accent`}
                >
                  {de.binderList.rename}
                </button>
                <button
                  type="button"
                  aria-label={de.decks.deleteLabel(deck.name)}
                  onClick={() => handleDelete(deck)}
                  className={`${smallButtonClass} border-danger/60 text-danger hover:bg-danger/10`}
                >
                  {de.decks.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
