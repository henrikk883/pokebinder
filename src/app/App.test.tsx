import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { de } from '../i18n/de'
import { App } from './App'

describe('App shell', () => {
  it('renders header, the three columns and the footer notice', () => {
    render(<App />)

    expect(screen.getByRole('banner')).toHaveTextContent(de.app.name)
    expect(screen.getByRole('heading', { name: de.search.title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: de.binder.title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: de.selection.title })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent(de.footer.disclaimer)
  })

  it('places search left, binder in the middle and selection right', () => {
    render(<App />)

    expect(screen.getByTestId('column-left')).toHaveTextContent(de.search.title)
    expect(screen.getByTestId('column-center')).toHaveTextContent(de.binder.title)
    expect(screen.getByTestId('column-right')).toHaveTextContent(de.selection.title)
  })
})
