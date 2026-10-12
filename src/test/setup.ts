import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Unit tests never talk to the network; tests that need TCGdex data inject it.
vi.stubGlobal('fetch', () => Promise.reject(new Error('Network access is disabled in unit tests')))

// Component tests start in the app itself, as after loading the page anew; the start
// page of a new visit has tests of its own.
if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('pokebinder:visited', '1')

afterEach(() => {
  cleanup()
})
