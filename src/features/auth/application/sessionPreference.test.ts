import { beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetDevice, readRememberedDevice, rememberDevice } from './sessionPreference'

class FakeStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

describe('sessionPreference', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new FakeStorage())
  })

  it('returns null when nothing was remembered', () => {
    expect(readRememberedDevice()).toBeNull()
  })

  it('remembers and reads back the email', () => {
    rememberDevice('mariana@clinica.mx')
    expect(readRememberedDevice()).toEqual({ email: 'mariana@clinica.mx' })
  })

  it('forgets the device', () => {
    rememberDevice('mariana@clinica.mx')
    forgetDevice()
    expect(readRememberedDevice()).toBeNull()
  })

  it('never persists anything besides the email', () => {
    rememberDevice('mariana@clinica.mx')
    const raw = localStorage.getItem('citas-menu.auth.remember')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toEqual({ email: 'mariana@clinica.mx' })
  })

  it('does not throw when storage access fails', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
      removeItem() {
        throw new Error('blocked')
      },
    })
    expect(() => rememberDevice('a@b.mx')).not.toThrow()
    expect(() => forgetDevice()).not.toThrow()
    expect(readRememberedDevice()).toBeNull()
  })

  it('returns null when the stored value is malformed JSON', () => {
    localStorage.setItem('citas-menu.auth.remember', 'not-json')
    expect(readRememberedDevice()).toBeNull()
  })
})
