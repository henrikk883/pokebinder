import { createPortal } from 'react-dom'
import { setIdOfCard } from '../../lib/tcgdex'
import type { CardRef } from '../../types/binder'
import { CardInfoDialog } from '../search/CardInfoDialog'
import { useReadyCatalog } from '../search/useCatalog'
import { useCard } from './useCard'

interface PocketCardInfoProps {
  cardRef: CardRef
  onClose: () => void
}

/**
 * The info of a card in the binder, as the search shows it: prices, the collection,
 * similar cards. Laid over the page, outside the binder: what happens in it must neither
 * select the pocket below nor pick its card up.
 */
export function PocketCardInfo({ cardRef, onClose }: PocketCardInfoProps) {
  const card = useCard(cardRef.cardId, cardRef.lang)
  const set = useReadyCatalog(cardRef.lang)?.setsById.get(card ? setIdOfCard(card) : '')
  if (!card) return null
  return createPortal(
    <div
      // React passes events on through a portal to where it stands in the tree: the pocket
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <CardInfoDialog card={card} set={set} lang={cardRef.lang} onClose={onClose} />
    </div>,
    document.body,
  )
}
