import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { binderRepository } from '../../db/binderRepository'
import { de } from '../../i18n/de'
import { setIdOfCard } from '../../lib/tcgdex'
import { useDeckStore } from '../../store/deckStore'
import { promptDialog } from '../../store/dialogStore'
import { useEditorStore } from '../../store/editorStore'
import { DECK_FORMATS, type Deck, type DeckCard } from '../../types/deck'
import { normalizeText } from '../binder/cardFinder'
import { useCard } from '../binder/useCard'
import { ACCEPTED_IMAGE_TYPES } from '../images/upload'
import { uploadErrorText, uploadImages } from '../images/uploadActions'
import { WideSearch } from '../search/CardBrowser'
import { CardImage } from '../search/CardImage'
import { useReadyCatalog } from '../search/useCatalog'
import { copiesAtHand, deckCoverage, deckWorth, ownedCopies, type OwnedCopies } from './deckCollection'
import {
  addCard,
  checkDeck,
  countInDeck,
  DECK_SIZE,
  groupDeck,
  renameDeck,
  setDeckCover,
  setFormat,
} from './deckModel'
import { useDeckInfo } from './useDeckInfo'

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-4 gap-y-6 max-md:grid-cols-3 max-md:gap-x-2'
const buttonClass = 'h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent'
const stepClass =
  'flex size-8 items-center justify-center rounded-control border border-line bg-raised text-base hover:border-accent'

/** One card of the deck: its picture, how often it is in, and the two buttons that change that. */
interface DeckCardTileProps {
  card: DeckCard
  name: string | undefined
  /** How many of the wanted copies lie in the binders. */
  atHand: number
  /** Known not to be playable in the format of the deck. */
  notAllowed: boolean
}

function DeckCardTile({ card, name, atHand, notAllowed }: DeckCardTileProps) {
  const change = useDeckStore((state) => state.change)
  const summary = useCard(card.cardId, card.lang)
  const catalog = useReadyCatalog(card.lang)
  const shownName = name ?? summary?.name ?? card.cardId

  return (
    <li
      data-testid="deck-card"
      data-card-id={card.cardId}
      data-count={card.count}
      data-allowed={!notAllowed}
      className="min-w-0"
    >
      <div className="relative">
        {summary ? (
          <CardImage card={summary} set={catalog?.setsById.get(setIdOfCard(summary))} size="small" />
        ) : (
          <div className="aspect-[63/88] w-full rounded-pocket bg-raised" />
        )}
        <span className="absolute right-1 bottom-1 rounded-control bg-bg/90 px-2 py-0.5 text-sm font-semibold">
          {de.decks.copies(card.count)}
        </span>
        {notAllowed && (
          <span className="absolute top-1 left-1 rounded-control border border-line bg-bg/90 px-2 py-0.5 text-xs font-semibold">
            {de.decks.notAllowedBadge}
          </span>
        )}
      </div>
      <p className="mt-1.5 truncate text-sm font-medium" title={shownName}>
        {shownName}
      </p>
      <p data-testid="deck-card-owned" className="truncate text-xs text-muted">
        {de.decks.atHand(atHand, card.count)}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          aria-label={de.decks.fewer(shownName)}
          onClick={() => change((deck) => addCard(deck, card.cardId, card.lang, -1))}
          className={stepClass}
        >
          <span aria-hidden="true">−</span>
        </button>
        <button
          type="button"
          aria-label={de.decks.more(shownName)}
          onClick={() => change((deck) => addCard(deck, card.cardId, card.lang, 1))}
          className={stepClass}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </li>
  )
}

// the same map every time, as long as the binders are not read yet
const NOTHING_OWNED: OwnedCopies = new Map()

/** What lies in the binders, to tell which cards of a deck are there already. */
function useOwnedCopies(): OwnedCopies {
  const [owned, setOwned] = useState<OwnedCopies>(NOTHING_OWNED)

  useEffect(() => {
    let cancelled = false
    binderRepository.listBinders().then(
      (binders) => {
        if (!cancelled) setOwned(ownedCopies(binders))
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [])

  return owned
}

type Tab = 'deck' | 'add'
const tabClass = 'border-b-2 px-4 pb-2 text-sm font-medium whitespace-nowrap'

/**
 * An open deck. Like the page "Karten stöbern" it shows cards in large, side by side: the
 * ones in the deck by kind, each with how often it is in, and under "Karten hinzufügen"
 * the card search, where a click on a card puts a copy into the deck.
 */
export function DeckEditor({ deck }: { deck: Deck }) {
  const change = useDeckStore((state) => state.change)
  const searchLang = useEditorStore((state) => state.searchLang)
  // a new deck has nothing to show yet: it starts where cards are found
  const [tab, setTab] = useState<Tab>(deck.cards.length === 0 ? 'add' : 'deck')
  const [uploadError, setUploadError] = useState<string | null>(null)
  // narrows the cards shown under "Deck" to those with this in their name or number
  const [filter, setFilter] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const infoOf = useDeckInfo(deck.cards)
  const owned = useOwnedCopies()
  const check = checkDeck(deck, infoOf)
  const groups = groupDeck(deck, infoOf)
  const coverage = deckCoverage(deck, owned)
  const worth = deckWorth(deck, infoOf, owned)
  const notAllowedNames = new Set(check.notAllowed.map((entry) => entry.name))
  const wanted = normalizeText(filter)
  const shown = (card: DeckCard) =>
    wanted === '' ||
    normalizeText(infoOf(card)?.name ?? '').includes(wanted) ||
    // the number is the last part of the id, e.g. "sv03.5-025"
    normalizeText(card.cardId.split('-').at(-1) ?? '').replace(/^0+(?=.)/, '') === wanted.replace(/^0+(?=.)/, '')
  const shownGroups = groups
    .map((group) => ({ ...group, cards: group.cards.filter(shown) }))
    .filter((group) => group.cards.length > 0)

  async function handleRename() {
    const name = await promptDialog({
      title: de.decks.rename,
      label: de.decks.name,
      value: deck.name,
      confirmLabel: de.decks.renameConfirm,
    })
    if (name !== null) change((current) => renameDeck(current, name))
  }

  async function handleCover(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (files.length === 0) return
    setUploadError(null)
    try {
      const [asset] = await uploadImages(files.slice(0, 1))
      if (asset) change((current) => setDeckCover(current, asset.id))
    } catch (error) {
      setUploadError(uploadErrorText(error))
    }
  }

  return (
    <section className="mx-auto flex min-h-full max-w-[110rem] flex-col p-5 max-md:p-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto min-w-0 truncate text-2xl font-semibold" title={deck.name}>
          {deck.name}
        </h2>
        <select
          aria-label={de.decks.format}
          title={de.decks.formatHint}
          value={deck.format}
          onChange={(event) => {
            const format = DECK_FORMATS.find((known) => known === event.target.value)
            if (format) change((current) => setFormat(current, format))
          }}
          className="h-10 rounded-control border border-line bg-raised px-3 text-sm focus:border-accent focus:outline-none"
        >
          {DECK_FORMATS.map((format) => (
            <option key={format} value={format}>
              {de.decks.formats[format]}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleRename} className={buttonClass}>
          {de.decks.rename}
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} className={buttonClass}>
          {deck.coverAssetId === undefined ? de.decks.coverAdd : de.decks.coverChange}
        </button>
        {deck.coverAssetId !== undefined && (
          <button type="button" onClick={() => change((current) => setDeckCover(current, undefined))} className={buttonClass}>
            {de.decks.coverRemove}
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          aria-label={de.decks.coverInput}
          onChange={handleCover}
          className="hidden"
        />
      </div>
      {uploadError && (
        <p role="alert" className="mt-2 text-sm text-muted">
          {uploadError}
        </p>
      )}

      <p data-testid="deck-check" data-valid={check.valid} className="mt-3 text-sm text-muted">
        <span className="font-medium text-text">{de.decks.size(check.size, DECK_SIZE)}</span>
        {' · '}
        {check.missing > 0
          ? de.decks.missing(check.missing)
          : check.missing < 0
            ? de.decks.surplus(-check.missing)
            : de.decks.full}
      </p>
      {check.size > 0 && (
        <p data-testid="deck-worth" title={de.price.label} className="mt-1 text-sm text-muted">
          {de.decks.worth(worth.worth)}
          {worth.unpriced > 0 && ` (${de.price.unpriced(worth.unpriced)})`}
          {' · '}
          {coverage.missing === 0 ? de.decks.allAtHand : de.decks.coverage(coverage.have, coverage.missing, worth.missingWorth)}
        </p>
      )}
      {check.notAllowed.length > 0 && (
        <p data-testid="deck-not-allowed" role="status" className="mt-1 text-sm text-muted">
          {de.decks.notAllowed(de.decks.formats[deck.format], check.notAllowed)}
        </p>
      )}
      {check.tooMany.length > 0 && (
        <p data-testid="deck-too-many" role="status" className="mt-1 text-sm text-muted">
          {de.decks.tooMany(check.tooMany)}
        </p>
      )}

      <div role="tablist" aria-label={deck.name} className="mt-4 flex border-b border-line">
        {(['deck', 'add'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={tab === option}
            onClick={() => setTab(option)}
            className={`${tabClass} ${
              tab === option ? 'border-accent text-accent-hover' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {de.decks.tabs[option]}
            {option === 'deck' && check.size > 0 && <span className="ml-1 text-xs text-muted">{check.size}</span>}
          </button>
        ))}
      </div>

      {/* both stay mounted, so the search keeps its results while the deck is looked at */}
      <div className={tab === 'deck' ? 'mt-5' : 'hidden'} data-testid="deck-cards">
        {groups.length === 0 && <p className="text-sm text-muted">{de.decks.emptyDeck}</p>}
        {groups.length > 0 && (
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={de.find.inDeck}
            aria-label={de.find.inDeck}
            className="mb-5 h-10 w-full max-w-sm rounded-control border border-line bg-raised px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
          />
        )}
        {groups.length > 0 && shownGroups.length === 0 && <p className="text-sm text-muted">{de.find.none}</p>}
        {shownGroups.map((group) => (
          <div key={group.category} className="mb-8" data-testid="deck-group" data-category={group.category}>
            <h3 className="mb-3 text-lg font-semibold">
              {de.decks.categories[group.category]} <span className="text-sm font-normal text-muted">{group.count}</span>
            </h3>
            <ul className={GRID}>
              {group.cards.map((card) => (
                <DeckCardTile
                  key={`${card.lang}:${card.cardId}`}
                  card={card}
                  name={infoOf(card)?.name}
                  atHand={copiesAtHand(card, owned)}
                  notAllowed={notAllowedNames.has(infoOf(card)?.name ?? card.cardId)}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className={tab === 'add' ? 'mt-5' : 'hidden'}>
        <p className="mb-3 text-sm text-muted">{de.decks.addHint}</p>
        <WideSearch
          key={searchLang}
          lang={searchLang}
          dragIdPrefix="deck"
          onPick={(card, lang) => change((current) => addCard(current, card.id, lang, 1))}
          countOf={(cardId, lang) => countInDeck(deck, cardId, lang)}
        />
      </div>
    </section>
  )
}
