const STORAGE_KEY = 'citas-menu.auth.remember'

interface RememberedDevice {
  email: string
}

export function rememberDevice(email: string): void {
  try {
    const payload: RememberedDevice = { email }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Storage may be unavailable (private mode, blocked cookies, etc.); ignore.
  }
}

export function forgetDevice(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
}

export function readRememberedDevice(): RememberedDevice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'email' in parsed &&
      typeof (parsed as RememberedDevice).email === 'string'
    ) {
      return { email: (parsed as RememberedDevice).email }
    }
    return null
  } catch {
    return null
  }
}
