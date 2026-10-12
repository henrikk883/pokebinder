import { useId } from 'react'

interface IllustratorInputProps {
  label: string
  value: string
  /** Names to choose from; a part of a name does as well. */
  options: readonly string[]
  onChange: (value: string) => void
}

/** Field for the artist of a card: typed freely, with the known names to pick from. */
export function IllustratorInput({ label, value, options, onChange }: IllustratorInputProps) {
  const listId = useId()

  return (
    <>
      <input
        type="search"
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        aria-label={label}
        className="h-10 w-full min-w-0 rounded-control border border-line bg-raised px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  )
}
