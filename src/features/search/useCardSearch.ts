import { useEffect, useMemo, useState } from 'react'
import { tcgdexFor, type CardSummary } from '../../lib/tcgdex'
import { OFFERED_LANGS, type CardLang } from '../../types/binder'
import { planSearch, runSearch, type SearchPlan } from './searchLogic'

export type CardSearchStatus = 'idle' | 'needsContext' | 'loading' | 'ready' | 'error'

export interface CardSearch {
  status: CardSearchStatus
  cards: CardSummary[]
  hasMore: boolean
  loadingMore: boolean
  loadMore: () => void
}

interface Result {
  key: string
  page: number
  cards: CardSummary[]
  hasMore: boolean
  failed: boolean
}

const NO_CARDS: CardSummary[] = []

export function useCardSearch(
  lang: CardLang,
  text: string,
  setId: string | undefined,
  rarity: string | undefined,
  type: string | undefined,
): CardSearch {
  const plan: SearchPlan = useMemo(
    () => planSearch({ text, setId, rarity, type }),
    [text, setId, rarity, type],
  )
  const key = `${lang}:${JSON.stringify(plan)}`
  const active = plan.kind === 'set' || plan.kind === 'query'

  const [requested, setRequested] = useState({ key, page: 1 })
  const page = requested.key === key ? requested.page : 1
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    // a name may be typed in another language than the cards are shown in
    const others = OFFERED_LANGS.filter((other) => other !== lang).map((other) => tcgdexFor(other))
    runSearch(tcgdexFor(lang), plan, page, others).then(
      ({ cards, hasMore }) => {
        if (cancelled) return
        setResult((previous) => ({
          key,
          page,
          cards: page > 1 && previous?.key === key ? [...previous.cards, ...cards] : cards,
          hasMore,
          failed: false,
        }))
      },
      () => {
        if (!cancelled) setResult({ key, page, cards: NO_CARDS, hasMore: false, failed: true })
      },
    )
    return () => {
      cancelled = true
    }
  }, [active, key, lang, page, plan])

  const current = result?.key === key ? result : null
  const loadingMore = current !== null && current.page < page

  let status: CardSearchStatus
  if (plan.kind === 'idle' || plan.kind === 'needsContext') status = plan.kind
  else if (!current) status = 'loading'
  else if (current.failed) status = 'error'
  else status = 'ready'

  return {
    status,
    cards: active && current ? current.cards : NO_CARDS,
    hasMore: active && current !== null && current.hasMore && !loadingMore,
    loadingMore,
    loadMore: () => setRequested({ key, page: page + 1 }),
  }
}
