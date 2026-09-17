import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import {
  AUTH_PATHS,
  PASSWORD_MIN_LENGTH,
  ROLE_LABELS,
  authErrorMessage,
  fromCurrentUserDto,
  fullName,
  normalizeEmail,
  readResetTokenFromHash,
  sanitizeReturnPath,
  validateEmail,
  validateMfaCode,
  validatePassword,
  validatePasswordConfirmation,
} from './auth'

describe('fromCurrentUserDto', () => {
  it('maps the snake_case dto into camelCase', () => {
    const user = fromCurrentUserDto({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'Mariana@Clinica.mx',
      first_name: 'Mariana',
      last_name: 'Cázares',
      role: 'OWNER_DENTIST',
      mfa_required: true,
    })

    expect(user).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'Mariana@Clinica.mx',
      firstName: 'Mariana',
      lastName: 'Cázares',
      role: 'OWNER_DENTIST',
      mfaRequired: true,
    })
  })
})

describe('ROLE_LABELS', () => {
  it('has a Spanish label for every role', () => {
    expect(ROLE_LABELS.OWNER_DENTIST).toBe('Odontólogo titular')
    expect(ROLE_LABELS.ASSISTANT).toBe('Asistente')
    expect(ROLE_LABELS.BILLING).toBe('Facturación')
  })
})

describe('fullName', () => {
  it('joins first and last name', () => {
    expect(fullName({ firstName: 'Mariana', lastName: 'Cázares' } as never)).toBe('Mariana Cázares')
  })
})

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Mariana@Clinica.MX  ')).toBe('mariana@clinica.mx')
  })
})

describe('validateEmail', () => {
  it('requires a value', () => {
    expect(validateEmail('')).toBe('El correo es obligatorio.')
  })

  it('rejects an invalid shape', () => {
    expect(validateEmail('not-an-email')).toBeTypeOf('string')
  })

  it('rejects a value over 254 characters', () => {
    const long = `${'a'.repeat(250)}@b.mx`
    expect(validateEmail(long)).toBeTypeOf('string')
  })

  it('accepts a valid email', () => {
    expect(validateEmail('mariana@clinica.mx')).toBeNull()
  })
})

describe('validatePassword', () => {
  it('login policy requires at least one character', () => {
    expect(validatePassword('', { minLength: 1 })).toBeTypeOf('string')
    expect(validatePassword('x', { minLength: 1 })).toBeNull()
  })

  it('login policy rejects over 128 UTF-8 bytes', () => {
    const long = 'a'.repeat(129)
    expect(validatePassword(long, { minLength: 1 })).toBeTypeOf('string')
  })

  it('reset policy requires 12 code points minimum', () => {
    expect(validatePassword('a'.repeat(11), { minLength: PASSWORD_MIN_LENGTH })).toBeTypeOf('string')
    expect(validatePassword('a'.repeat(12), { minLength: PASSWORD_MIN_LENGTH })).toBeNull()
  })

  it('reset policy rejects over 128 UTF-8 bytes even under the code point limit', () => {
    const long = '💧'.repeat(40)
    expect(validatePassword(long, { minLength: PASSWORD_MIN_LENGTH })).toBeTypeOf('string')
  })
})

describe('validatePasswordConfirmation', () => {
  it('requires both values to match', () => {
    expect(validatePasswordConfirmation('abcdefghijkl', 'abcdefghijkl')).toBeNull()
    expect(validatePasswordConfirmation('abcdefghijkl', 'other')).toBeTypeOf('string')
  })
})

describe('validateMfaCode', () => {
  it('rejects codes shorter than 6 characters', () => {
    expect(validateMfaCode('12345')).toBeTypeOf('string')
  })

  it('accepts a 6-digit code', () => {
    expect(validateMfaCode('123456')).toBeNull()
  })

  it('trims surrounding whitespace before validating', () => {
    expect(validateMfaCode('  123456  ')).toBeNull()
  })

  it('rejects codes longer than 64 characters', () => {
    expect(validateMfaCode('a'.repeat(65))).toBeTypeOf('string')
  })
})

describe('readResetTokenFromHash', () => {
  const token = 'A'.repeat(43)

  it('reads a well-formed token', () => {
    expect(readResetTokenFromHash(`#token=${token}`)).toBe(token)
  })

  it('reads the token even with other params present', () => {
    expect(readResetTokenFromHash(`#foo=bar&token=${token}&baz=1`)).toBe(token)
  })

  it('returns null when the hash has no token', () => {
    expect(readResetTokenFromHash('#foo=bar')).toBeNull()
  })

  it('returns null for a malformed token', () => {
    expect(readResetTokenFromHash('#token=too-short')).toBeNull()
  })

  it('returns null for an empty hash', () => {
    expect(readResetTokenFromHash('')).toBeNull()
  })
})

describe('sanitizeReturnPath', () => {
  it('accepts a plain internal path', () => {
    expect(sanitizeReturnPath('/pacientes')).toBe('/pacientes')
  })

  it('rejects a protocol-relative path', () => {
    expect(sanitizeReturnPath('//evil.com')).toBe('/')
  })

  it('rejects an absolute url', () => {
    expect(sanitizeReturnPath('https://evil.com')).toBe('/')
  })

  it('rejects a backslash payload', () => {
    expect(sanitizeReturnPath('/\\evil.com')).toBe('/')
  })

  it('rejects non-string input', () => {
    expect(sanitizeReturnPath(undefined)).toBe('/')
    expect(sanitizeReturnPath(42)).toBe('/')
  })

  it('rejects the public auth paths', () => {
    expect(sanitizeReturnPath(AUTH_PATHS.login)).toBe('/')
    expect(sanitizeReturnPath(AUTH_PATHS.forgot)).toBe('/')
    expect(sanitizeReturnPath(AUTH_PATHS.reset)).toBe('/')
  })
})

describe('authErrorMessage', () => {
  it('never reveals whether the account exists on login failures', () => {
    const error = new ApiError({ status: 401, code: 'INVALID_CREDENTIALS' })
    expect(authErrorMessage(error, 'login')).toBe('Correo o contraseña incorrectos.')
  })

  it('maps mfa invalid credentials to an mfa-specific message', () => {
    const error = new ApiError({ status: 401, code: 'INVALID_CREDENTIALS' })
    expect(authErrorMessage(error, 'mfa')).toBe('El código no es válido o ya expiró.')
  })

  it('maps reset invalid credentials to a link-specific message', () => {
    const error = new ApiError({ status: 401, code: 'INVALID_CREDENTIALS' })
    expect(authErrorMessage(error, 'reset')).toBe('El enlace ya no es válido. Solicita uno nuevo.')
  })

  it('includes the retry-after seconds for rate limiting', () => {
    const error = new ApiError({ status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 45 })
    expect(authErrorMessage(error, 'login')).toBe('Demasiados intentos. Espera 45 segundos e inténtalo de nuevo.')
  })

  it('falls back to a generic wait message without retryAfterSeconds', () => {
    const error = new ApiError({ status: 429, code: 'RATE_LIMITED' })
    expect(authErrorMessage(error, 'login')).toBe('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.')
  })

  it('maps password policy errors', () => {
    const error = new ApiError({ status: 400, code: 'INVALID_PASSWORD' })
    expect(authErrorMessage(error, 'reset')).toBeTypeOf('string')
  })

  it('maps service unavailable errors', () => {
    const error = new ApiError({ status: 503, code: 'AUTH_SERVICE_UNAVAILABLE' })
    expect(authErrorMessage(error, 'login')).toBe('El servicio no está disponible por ahora. Inténtalo más tarde.')
  })

  it('maps network and timeout errors', () => {
    expect(authErrorMessage(new ApiError({ status: 0, code: 'NETWORK' }), 'login')).toBe(
      'No pudimos conectar con el servidor. Revisa tu conexión.',
    )
    expect(authErrorMessage(new ApiError({ status: 0, code: 'TIMEOUT' }), 'login')).toBe(
      'No pudimos conectar con el servidor. Revisa tu conexión.',
    )
  })

  it('falls back to a generic message for unknown errors', () => {
    expect(authErrorMessage(new ApiError({ status: 400, code: 'UNKNOWN' }), 'login')).toBe(
      'Algo salió mal. Inténtalo de nuevo.',
    )
    expect(authErrorMessage(new Error('boom'), 'login')).toBe('Algo salió mal. Inténtalo de nuevo.')
  })
})
