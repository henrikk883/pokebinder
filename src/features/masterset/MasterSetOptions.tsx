import { useEffect, useState } from 'react'
import { de } from '../../i18n/de'
import { tcgdex, type CardDetail, type Catalog } from '../../lib/tcgdex'
import type { Layout } from '../../types/binder'
import { SetPicker } from '../search/SetPicker'
import {
  buildMasterSet,
  pagesNeeded,
  promoSetIdOf,
  secretRareGroups,
  type MasterSetOptions as Options,
  type MasterSetSource,
} from './masterSet'

type Details = { status: 'loading' } | { status: 'ready'; cards: CardDetail[] } | { status: 'error' }

/** Cards of a set with rarity and finishes; `undefined` while no set is chosen. */
function useSetDetails(setId: string | undefined): Details | undefined {
  const [loaded, setLoaded] = useState<{ setId: string; details: Details }>()

  useEffect(() => {
    if (setId === undefined) return
    let cancelled = false
    tcgdex.getSetDetails(setId).then(
      (cards) => {
        if (!cancelled) setLoaded({ setId, details: { status: 'ready', cards } })
      },
      () => {
        if (!cancelled) setLoaded({ setId, details: { status: 'error' } })
      },
    )
    return () => {
      cancelled = true
    }
  }, [setId])

  if (setId === undefined) return undefined
  return loaded?.setId === setId ? loaded.details : { status: 'loading' }
}

export interface MasterSetChoice {
  setId: string
  setName: string
  options: Options
  /** Everything needed to build the binder; `undefined` until the cards are loaded. */
  source: MasterSetSource | undefined
}

interface MasterSetOptionsProps {
  catalog: Catalog | undefined
  catalogUnavailableText: string | undefined
  layout: Layout
  onChange: (choice: MasterSetChoice | undefined) => void
}

const switchRowClass = 'flex cursor-pointer items-start gap-3 text-sm'
const checkboxClass = 'mt-0.5 size-4 shrink-0 accent-accent'

/** Second step of the assistant: which set, and what belongs into its master set. */
export function MasterSetOptions({ catalog, catalogUnavailableText, layout, onChange }: MasterSetOptionsProps) {
  const [setId, setSetId] = useState<string>()
  const [withVariants, setWithVariants] = useState(false)
  const [withPromos, setWithPromos] = useState(false)
  const [excluded, setExcluded] = useState<string[]>([])

  const set = setId ? catalog?.setsById.get(setId) : undefined
  const promoSetId = catalog && setId ? promoSetIdOf(catalog, setId) : undefined
  const promoSet = promoSetId ? catalog?.setsById.get(promoSetId) : undefined
  const details = useSetDetails(setId)
  const promoDetails = useSetDetails(withPromos ? promoSetId : undefined)

  const options: Options = { withVariants, excludedSecretRarities: excluded, withPromos: withPromos && !!promoSet }
  const promosReady = !options.withPromos || promoDetails?.status === 'ready'
  const source: MasterSetSource | undefined =
    set && details?.status === 'ready' && promosReady
      ? {
          cards: details.cards,
          officialCount: set.cardCount.official,
          promos: promoDetails?.status === 'ready' ? promoDetails.cards : [],
          lang: tcgdex.lang,
        }
      : undefined
  const cardCount = source ? buildMasterSet(source, options).length : undefined
  const groups = set && details?.status === 'ready' ? secretRareGroups(details.cards, set.cardCount.official) : []

  // report every change to the dialog, which owns the "create" button
  const choiceKey = JSON.stringify([setId, options, source !== undefined])
  useEffect(() => {
    onChange(set ? { setId: set.id, setName: set.name, options, source } : undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- choiceKey stands for set, options and source
  }, [choiceKey])

  function chooseSet(next: string | undefined) {
    setSetId(next)
    setExcluded([])
  }

  const failed = details?.status === 'error' || (options.withPromos && promoDetails?.status === 'error')
  const loading = details?.status === 'loading' || (options.withPromos && promoDetails?.status === 'loading')

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm">
        <p>{de.masterSet.set}</p>
        <SetPicker
          catalog={catalog}
          unavailableText={catalogUnavailableText}
          value={setId}
          onChange={chooseSet}
        />
        {!set && <p className="text-xs text-muted">{de.masterSet.chooseSet}</p>}
      </div>

      {set && (
        <>
          <label className={switchRowClass}>
            <input
              type="checkbox"
              role="switch"
              checked={withVariants}
              onChange={(event) => setWithVariants(event.target.checked)}
              className={checkboxClass}
            />
            <span>
              {de.masterSet.withVariants}
              <span className="block text-xs text-muted">{de.masterSet.withVariantsHint}</span>
            </span>
          </label>

          <fieldset className="space-y-2 text-sm">
            <legend>{de.masterSet.secretRares}</legend>
            <p className="text-xs text-muted">{de.masterSet.secretRaresHint}</p>
            {details?.status === 'ready' && groups.length === 0 && (
              <p className="text-xs text-muted">{de.masterSet.noSecretRares}</p>
            )}
            {groups.map((group) => (
              <label key={group.rarity} className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={!excluded.includes(group.rarity)}
                  onChange={(event) =>
                    setExcluded((current) =>
                      event.target.checked
                        ? current.filter((rarity) => rarity !== group.rarity)
                        : [...current, group.rarity],
                    )
                  }
                  className="size-4 shrink-0 accent-accent"
                />
                {de.masterSet.rarityCount(group.rarity || de.masterSet.unknownRarity, group.count)}
              </label>
            ))}
          </fieldset>

          <label className={`${switchRowClass} ${promoSet ? '' : 'cursor-not-allowed text-muted'}`}>
            <input
              type="checkbox"
              role="switch"
              checked={withPromos && !!promoSet}
              disabled={!promoSet}
              onChange={(event) => setWithPromos(event.target.checked)}
              className={checkboxClass}
            />
            <span>
              {de.masterSet.withPromos}
              <span className="block text-xs text-muted">
                {promoSet
                  ? de.masterSet.withPromosHint(
                      promoSet.name,
                      promoDetails?.status === 'ready' ? promoDetails.cards.length : promoSet.cardCount.total,
                    )
                  : de.masterSet.noPromos}
              </span>
            </span>
          </label>

          {loading && (
            <p role="status" className="text-sm text-muted">
              {de.masterSet.loading}
            </p>
          )}
          {failed && (
            <p role="alert" className="text-sm text-muted">
              {de.masterSet.loadFailed}
            </p>
          )}
          {cardCount !== undefined && (
            <p role="status" data-testid="master-set-summary" className="rounded-control border border-line bg-raised px-3 py-2 text-sm">
              {de.masterSet.summary(cardCount, pagesNeeded(cardCount, layout))}
            </p>
          )}
        </>
      )}
    </div>
  )
}
