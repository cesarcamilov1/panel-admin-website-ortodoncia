/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional origin-only browser API base URL; empty keeps requests same-origin. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
