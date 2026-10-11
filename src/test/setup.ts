import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Unit tests never talk to the network; tests that need TCGdex data inject it.
vi.stubGlobal('fetch', () => Promise.reject(new Error('Network access is disabled in unit tests')))

afterEach(() => {
  cleanup()
})
