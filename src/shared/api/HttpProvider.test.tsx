import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HttpProvider } from './HttpProvider'
import { useHttp } from './httpContext'
import type { HttpClient } from './http'

function Probe() {
  const http = useHttp()
  return <span>{typeof http.put}</span>
}

const stub = { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() } as unknown as HttpClient

describe('useHttp', () => {
  it('returns the client published by the provider', () => {
    render(
      <HttpProvider client={stub}>
        <Probe />
      </HttpProvider>,
    )
    expect(screen.getByText('function')).toBeInTheDocument()
  })

  it('fails loudly outside a provider instead of silently building a second client', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/HttpProvider/)
    consoleError.mockRestore()
  })
})
