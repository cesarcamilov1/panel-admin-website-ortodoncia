import { describe, expect, it } from 'vitest'
import { resolveApiBaseUrl, resolveApiBaseUrlForCommand, resolveDevApiProxyTarget } from './apiOrigin'

describe('resolveApiBaseUrl', () => {
  it('uses same-origin requests when the API base URL is missing', () => {
    expect(resolveApiBaseUrl(undefined, true)).toBe('')
    expect(resolveApiBaseUrl('', true)).toBe('')
  })

  it('accepts an origin-only HTTPS production API base URL', () => {
    expect(resolveApiBaseUrl('https://api.example.test', true)).toBe('https://api.example.test')
  })

  it.each([
    'http://api.example.test',
    'https://user:password@api.example.test',
    'https://api.example.test/api/v1',
    'https://api.example.test?debug=true',
    'https://api.example.test#fragment',
  ])('rejects an unsafe production API base URL: %s', (value) => {
    expect(() => resolveApiBaseUrl(value, true)).toThrow('VITE_API_BASE_URL')
  })

  it('requires HTTPS for every build command, including custom deployment modes', () => {
    expect(() => resolveApiBaseUrlForCommand('http://api.example.test', 'build')).toThrow(
      'VITE_API_BASE_URL',
    )
    expect(resolveApiBaseUrlForCommand('https://api.example.test', 'build')).toBe(
      'https://api.example.test',
    )
  })
})

describe('resolveDevApiProxyTarget', () => {
  it('defaults to the local backend target', () => {
    expect(resolveDevApiProxyTarget(undefined)).toBe('http://localhost:8080')
  })

  it('accepts an origin-only HTTP development proxy target', () => {
    expect(resolveDevApiProxyTarget('http://127.0.0.1:8081')).toBe('http://127.0.0.1:8081')
  })

  it.each(['http://user:password@localhost:8080', 'http://localhost:8080/api', 'ftp://localhost:8080'])
    ('rejects an unsafe development proxy target: %s', (value) => {
      expect(() => resolveDevApiProxyTarget(value)).toThrow('DEV_API_PROXY_TARGET')
    })
})
