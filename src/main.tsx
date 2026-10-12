import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './index.css'

// The built app keeps itself and the card pictures for use without a connection (see
// public/sw.js). Not while developing: there a worker would only get in the way of fresh
// code and of the tests.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => undefined)
}

// For tracking down B-001 (docs/BUGS.md): opened with ?grau=aus the app shows missing cards
// in colour, so that the same binder can be compared with and without the grey filter.
if (new URLSearchParams(window.location.search).get('grau') === 'aus') {
  document.documentElement.classList.add('no-grey')
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
