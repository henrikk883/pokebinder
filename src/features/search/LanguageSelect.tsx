import { de } from '../../i18n/de'
import { OFFERED_LANGS, type CardLang } from '../../types/binder'

const flagClass = 'size-5 shrink-0 overflow-hidden rounded-full'

/** Small round flag for a card language. */
export function LangFlag({ lang }: { lang: CardLang }) {
  if (lang === 'de') {
    return (
      <span aria-hidden="true" className={`${flagClass} flex flex-col`}>
        <span className="flex-1 bg-black" />
        <span className="flex-1 bg-[#dd0000]" />
        <span className="flex-1 bg-[#ffce00]" />
      </span>
    )
  }
  if (lang === 'ja') {
    return (
      <span aria-hidden="true" className={`${flagClass} flex items-center justify-center bg-white`}>
        <span className="size-2.5 rounded-full bg-[#bc002d]" />
      </span>
    )
  }
  if (lang === 'en') {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={flagClass}>
        <rect width="20" height="20" fill="#012169" />
        <path d="M0 0 20 20M20 0 0 20" stroke="#fff" strokeWidth="4" />
        <path d="M0 0 20 20M20 0 0 20" stroke="#c8102e" strokeWidth="1.5" />
        <path d="M10 0v20M0 10h20" stroke="#fff" strokeWidth="6" />
        <path d="M10 0v20M0 10h20" stroke="#c8102e" strokeWidth="3.5" />
      </svg>
    )
  }
  return <span aria-hidden="true" className={`${flagClass} bg-line`} />
}

interface LanguageSelectProps {
  label: string
  value: CardLang
  /** Languages to offer; all offered languages by default. */
  options?: readonly CardLang[]
  onChange: (lang: CardLang) => void
}

/** Dropdown for a card language, with its flag. */
export function LanguageSelect({ label, value, options = OFFERED_LANGS, onChange }: LanguageSelectProps) {
  return (
    <div className="flex h-10 items-center gap-3 rounded-control border border-line bg-raised pl-3 text-sm focus-within:border-accent">
      <LangFlag lang={value} />
      <select
        aria-label={label}
        value={value}
        disabled={options.length < 2}
        onChange={(event) => onChange(event.target.value as CardLang)}
        className="h-full min-w-0 flex-1 bg-transparent pr-2 focus:outline-none disabled:text-muted"
      >
        {options.map((lang) => (
          <option key={lang} value={lang} className="bg-raised">
            {de.languages[lang]}
          </option>
        ))}
      </select>
    </div>
  )
}
