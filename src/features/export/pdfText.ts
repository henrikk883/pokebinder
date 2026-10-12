import { StandardFonts, type PDFDocument, type PDFFont } from 'pdf-lib'

/** Fonts of a PDF: the standard ones, and one for Japanese where the list needs it. */
export interface PdfFonts {
  regular: PDFFont
  bold: PDFFont
  /** Knows kana and kanji as well as Latin letters; only there when it was handed in. */
  wide?: PDFFont
}

// kana, kanji, and the punctuation and full-width forms that come with them
const WIDE_CHARACTERS = /[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/

/** Whether a text has characters only the font for Japanese can write. */
export function needsWideFont(text: string): boolean {
  return WIDE_CHARACTERS.test(text)
}

/**
 * Embeds the fonts of a document. `wideFont` is the file of the font for Japanese
 * (TrueType); without it, texts that need it are printed with substitutes as before.
 */
export async function embedFonts(pdf: PDFDocument, wideFont?: Uint8Array): Promise<PdfFonts> {
  const fonts: PdfFonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  }
  if (wideFont) {
    // loaded only here: most lists never need it
    const { default: fontkit } = await import('@pdf-lib/fontkit')
    pdf.registerFontkit(fontkit)
    // The whole font, not a subset: pdf-lib's subsetting leaves glyphs out of this font
    // (tried, most of a name went missing). That adds about 1.6 MB to such a file.
    fonts.wide = await pdf.embedFont(wideFont)
  }
  return fonts
}

/** The font to write a text in: `preferred`, or the wide one where the text needs it. */
export function fontFor(text: string, preferred: PDFFont, fonts: PdfFonts): PDFFont {
  return fonts.wide && needsWideFont(text) ? fonts.wide : preferred
}

const characterSets = new WeakMap<PDFFont, Set<number>>()

function knownCharacters(font: PDFFont): Set<number> {
  let known = characterSets.get(font)
  if (!known) {
    known = new Set(font.getCharacterSet())
    characterSets.set(font, known)
  }
  return known
}

const REPLACEMENTS: Record<string, string> = { '♀': ' (w)', '♂': ' (m)', '★': '*', '’': "'", '–': '-' }

/** A text with every character the font cannot write replaced; unknown ones become `?`. */
export function printable(text: string, font: PDFFont): string {
  const known = knownCharacters(font)
  let result = ''
  for (const char of text) {
    if (known.has(char.codePointAt(0) ?? 0)) {
      result += char
      continue
    }
    for (const piece of REPLACEMENTS[char] ?? char) {
      result += known.has(piece.codePointAt(0) ?? 0) ? piece : '?'
    }
  }
  return result
}
