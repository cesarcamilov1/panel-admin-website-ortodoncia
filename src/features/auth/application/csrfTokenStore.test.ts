import { describe, expect, it } from 'vitest'
import { createCsrfTokenStore } from './csrfTokenStore'

describe('createCsrfTokenStore', () => {
  it('starts with no token', () => {
    const store = createCsrfTokenStore()
    expect(store.get()).toBeNull()
  })

  it('stores and returns the token', () => {
    const store = createCsrfTokenStore()
    store.set('abc')
    expect(store.get()).toBe('abc')
  })

  it('clears the token', () => {
    const store = createCsrfTokenStore()
    store.set('abc')
    store.clear()
    expect(store.get()).toBeNull()
  })
})
