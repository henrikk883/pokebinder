import type { CardLang } from '../../types/binder'

/**
 * TCGdex names types, kinds of cards and rarities in the language asked in. German has
 * names of its own; the other languages use the English ones. English name → German name.
 */
const GERMAN: Readonly<Record<string, string>> = {
  // types
  Colorless: 'Farblos',
  Darkness: 'Unlicht',
  Dragon: 'Drache',
  Fairy: 'Fee',
  Fighting: 'Kampf',
  Fire: 'Feuer',
  Grass: 'Pflanze',
  Lightning: 'Elektro',
  Metal: 'Metall',
  Psychic: 'Psycho',
  Water: 'Wasser',
  // kinds of cards
  Energy: 'Energie',
  Pokemon: 'Pokémon',
  // rarities
  'ACE SPEC Rare': 'ASS-KLASSE',
  'Amazing Rare': 'Atemberaubend',
  'Black White Rare': 'Schwarz-Weiß Selten',
  Common: 'Häufig',
  'Double rare': 'Doppelselten',
  'Full Art Trainer': 'Vollkunsttrainer',
  'Holo Rare': 'Holografisch Selten',
  'Holo Rare V': 'Holografisch Selten V',
  'Holo Rare VMAX': 'Holografisch Selten VMAX',
  'Holo Rare VSTAR': 'Holografisch Selten VSTAR',
  'Hyper rare': 'Hyperselten',
  'Illustration rare': 'Selten, Illustration',
  LEGEND: 'LEGENDE',
  'Mega Hyper Rare': 'Mega Hyper Selten',
  None: 'Keine',
  'Radiant Rare': 'Selten, Strahlend',
  Rare: 'Selten',
  'Rare Holo': 'Selten, Holografisch',
  'Rare Holo LV.X': 'Selten, Holografisch LV.X',
  'Rare PRIME': 'selten, Primus',
  'Secret Rare': 'Versteckt Selten',
  'Shiny Ultra Rare': 'ultraselten, Schillernd',
  'Special illustration rare': 'Selten, besondere Illustration',
  'Ultra Rare': 'Ultra Selten',
  Uncommon: 'Ungewöhnlich',
}
const ENGLISH: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(GERMAN).map(([english, german]) => [german, english]),
)

/**
 * The name of a type, a kind of card or a rarity as TCGdex has it in another language, so
 * that a filter survives a change of language. Names that are the same everywhere ("Promo",
 * "Trainer") and names not known here come back as they are; whether the other language
 * has them at all, its own list tells.
 */
export function filterNameIn(name: string, from: CardLang, to: CardLang): string {
  if ((from === 'de') === (to === 'de')) return name
  return (to === 'de' ? GERMAN[name] : ENGLISH[name]) ?? name
}
