import { useState } from 'react'
import { de } from '../../i18n/de'
import type { Binder } from '../../types/binder'
import { changeOf, seriesOf, type SeriesPoint, type ValuePoint } from './valueHistory'

interface ValueHistoryDialogProps {
  history: readonly ValuePoint[]
  binders: readonly Binder[]
  onClose: () => void
}

const WIDTH = 600
const HEIGHT = 200
const PAD = 12
const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'UTC' })
const day = (date: string) => dateFormat.format(new Date(`${date}T00:00:00.000Z`))

/** The line of a series: days from left to right by their distance in time, value upwards. */
function linePoints(series: readonly SeriesPoint[]): string {
  const times = series.map((point) => Date.parse(`${point.date}T00:00:00.000Z`))
  const values = series.map((point) => point.value)
  const [firstTime = 0, lastTime = 0] = [times[0], times.at(-1)]
  const low = Math.min(...values)
  const high = Math.max(...values)
  return series
    .map((point, index) => {
      const x = PAD + ((times[index] ?? 0) - firstTime) / Math.max(1, lastTime - firstTime) * (WIDTH - 2 * PAD)
      // a value that never moved runs through the middle
      const share = high === low ? 0.5 : (point.value - low) / (high - low)
      const y = HEIGHT - PAD - share * (HEIGHT - 2 * PAD)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/**
 * How the worth of the collection, or of one binder, went over the days it was noted. A
 * day is noted when the shelf works out the values, so the line starts with the first
 * visit after this was built.
 */
export function ValueHistoryDialog({ history, binders, onClose }: ValueHistoryDialogProps) {
  const [binderId, setBinderId] = useState('')
  const series = seriesOf(history, binderId === '' ? null : binderId)
  const change = changeOf(series)
  const first = series[0]
  const last = series.at(-1)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="value-history-title"
        className="flex max-h-full w-full max-w-2xl flex-col gap-4 rounded-panel border border-line bg-panel p-6 shadow-lg"
      >
        <h2 id="value-history-title" className="text-xl font-semibold">
          {de.history.valueTitle}
        </h2>
        <select
          aria-label={de.history.valueOf}
          value={binderId}
          onChange={(event) => setBinderId(event.target.value)}
          className="h-10 rounded-control border border-line bg-raised px-3 text-sm focus:border-accent focus:outline-none"
        >
          <option value="">{de.history.wholeCollection}</option>
          {binders.map((binder) => (
            <option key={binder.id} value={binder.id}>
              {binder.name}
            </option>
          ))}
        </select>

        {series.length < 2 || !first || !last ? (
          <p className="text-sm text-muted">{de.history.valueTooShort}</p>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-label={de.history.valueChart(series.length)}
              data-testid="value-chart"
              className="w-full rounded-control border border-line bg-raised"
            >
              <polyline
                points={linePoints(series)}
                fill="none"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="stroke-accent-hover"
              />
            </svg>
            <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 text-sm text-muted">
              <span>{de.history.valueOn(day(first.date), first.value)}</span>
              <span className="font-medium text-text">{de.history.valueOn(day(last.date), last.value)}</span>
            </div>
            {change && (
              <p data-testid="value-change" className="text-sm">
                {de.history.valueChange(change.amount, day(change.since))}
              </p>
            )}
          </>
        )}
        <p className="text-xs text-muted">{de.history.valueHint}</p>

        <div className="flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent"
          >
            {de.history.close}
          </button>
        </div>
      </div>
    </div>
  )
}
