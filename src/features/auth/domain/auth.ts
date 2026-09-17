import { isApiError } from '../../../shared/api/problem'

export type Role = 'OWNER_DENTIST' | 'ASSISTANT' | 'BILLING'

export interface CurrentUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: Role
  mfaRequired: boolean
}

export interface CurrentUserDto {
  id: string
  email: string
  first_name: string
  last_name: string
  role: Role
  mfa_required: boolean
}

export function fromCurrentUserDto(dto: CurrentUserDto): CurrentUser {
  return {
    id: dto.id,
    email: dto.email,
    firstName: dto.first_name,
    lastName: dto.last_name,
    role: dto.role,
    mfaRequired: dto.mfa_required,
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER_DENTIST: 'Odontólogo titular',
  ASSISTANT: 'Asistente',
  BILLING: 'Facturación',
}

export function fullName(user: Pick<CurrentUser, 'firstName' | 'lastName'>): string {
  return `${user.firstName} ${user.lastName}`.trim()
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'El correo es obligatorio.'
  if (trimmed.length > 254) return 'El correo es demasiado largo.'
  if (!EMAIL_PATTERN.test(trimmed)) return 'Escribe un correo válido.'
  return null
}

export const PASSWORD_MIN_LENGTH = 12
const PASSWORD_MAX_BYTES = 128

export function validatePassword(value: string, { minLength }: { minLength: number }): string | null {
  const codePoints = Array.from(value).length
  if (codePoints < minLength) {
    return minLength === 1
      ? 'La contraseña es obligatoria.'
      : `La contraseña debe tener al menos ${minLength} caracteres.`
  }
  const byteLength = new TextEncoder().encode(value).length
  if (byteLength > PASSWORD_MAX_BYTES) return 'La contraseña es demasiado larga.'
  return null
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (password !== confirmation) return 'Las contraseñas no coinciden.'
  return null
}

export function validateMfaCode(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length < 6 || trimmed.length > 64) return 'Escribe un código válido.'
  return null
}

export const AUTH_PATHS = {
  login: '/login',
  forgot: '/recuperar',
  reset: '/reset-password',
} as const

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function readResetTokenFromHash(hash: string): string | null {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
  if (!withoutHash) return null
  const params = new URLSearchParams(withoutHash)
  const token = params.get('token')
  if (!token || !TOKEN_PATTERN.test(token)) return null
  return token
}

const PUBLIC_AUTH_PATHS: string[] = Object.values(AUTH_PATHS)

export function sanitizeReturnPath(candidate: unknown): string {
  if (typeof candidate !== 'string') return '/'
  if (!candidate.startsWith('/')) return '/'
  if (candidate.startsWith('//')) return '/'
  if (candidate.includes('://')) return '/'
  if (candidate.includes('\\')) return '/'
  if (PUBLIC_AUTH_PATHS.includes(candidate)) return '/'
  return candidate
}

type AuthErrorContext = 'login' | 'mfa' | 'forgot' | 'reset' | 'session'

export function authErrorMessage(error: unknown, context: AuthErrorContext): string {
  if (!isApiError(error)) return 'Algo salió mal. Inténtalo de nuevo.'

  if (error.code === 'INVALID_CREDENTIALS') {
    if (context === 'mfa') return 'El código no es válido o ya expiró.'
    if (context === 'reset') return 'El enlace ya no es válido. Solicita uno nuevo.'
    return 'Correo o contraseña incorrectos.'
  }

  if (error.code === 'RATE_LIMITED') {
    const wait = error.retryAfterSeconds ? `${error.retryAfterSeconds} segundos` : 'unos minutos'
    return `Demasiados intentos. Espera ${wait} e inténtalo de nuevo.`
  }

  if (error.code === 'INVALID_PASSWORD') {
    return `La contraseña no cumple la política: mínimo ${PASSWORD_MIN_LENGTH} caracteres.`
  }

  if (error.code === 'AUTH_SERVICE_UNAVAILABLE' || error.status >= 500) {
    return 'El servicio no está disponible por ahora. Inténtalo más tarde.'
  }

  if (error.code === 'NETWORK' || error.code === 'TIMEOUT') {
    return 'No pudimos conectar con el servidor. Revisa tu conexión.'
  }

  if (context === 'session') return 'No pudimos cerrar la sesión. Inténtalo de nuevo.'
  return 'Algo salió mal. Inténtalo de nuevo.'
}
