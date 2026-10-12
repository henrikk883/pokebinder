import { needsWideFont } from './pdfText'

/** Noto Sans JP, shipped with the app (public/fonts, SIL Open Font License). */
const WIDE_FONT_URL = `${import.meta.env.BASE_URL}fonts/NotoSansJP-Regular.ttf`

let loading: Promise<Uint8Array | undefined> | undefined

/**
 * The font for Japanese if one of the texts needs it, loaded once. `undefined` if none
 * does, or if the file cannot be loaded (no connection): the list is then written as far
 * as the standard font can.
 */
export async function wideFontFor(texts: Iterable<string>): Promise<Uint8Array | undefined> {
  let needed = false
  for (const text of texts) {
    if (needsWideFont(text)) {
      needed = true
      break
    }
  }
  if (!needed) return undefined

  loading ??= fetch(WIDE_FONT_URL).then(
    async (response) => (response.ok ? new Uint8Array(await response.arrayBuffer()) : undefined),
    () => undefined,
  )
  const font = await loading
  // a failed attempt may work next time
  if (!font) loading = undefined
  return font
}
