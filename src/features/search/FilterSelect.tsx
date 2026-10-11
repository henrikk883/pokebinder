interface FilterSelectProps {
  label: string
  value: string | undefined
  options: readonly string[]
  disabled?: boolean
  onChange: (value: string | undefined) => void
}

/** Dropdown whose first entry (the label itself) means "no filter". */
export function FilterSelect({ label, value, options, disabled, onChange }: FilterSelectProps) {
  return (
    <select
      aria-label={label}
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || undefined)}
      className="h-10 w-full min-w-0 rounded-control border border-line bg-raised px-3 text-sm focus:border-accent focus:outline-none disabled:text-muted"
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}
