export interface CsrfTokenStore {
  get: () => string | null
  set: (token: string) => void
  clear: () => void
}

export function createCsrfTokenStore(): CsrfTokenStore {
  let token: string | null = null
  return {
    get: () => token,
    set: (next: string) => {
      token = next
    },
    clear: () => {
      token = null
    },
  }
}
