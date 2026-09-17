import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { HttpClient } from '../../../shared/api/http'
import { HttpProvider } from '../../../shared/api/HttpProvider'
import { useServicesApi } from './useServicesApi'

function Probe() {
  const api = useServicesApi()
  return <span>{Object.keys(api).sort().join(',')}</span>
}

describe('useServicesApi', () => {
  it('builds the services api on top of the app-wide http client', () => {
    const client = { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() } as unknown as HttpClient

    render(
      <HttpProvider client={client}>
        <Probe />
      </HttpProvider>,
    )

    expect(screen.getByText(
      'create,list,listLocationServices,listPublicLocationServices,putFiscalConfig,replaceLocationServices,update',
    )).toBeInTheDocument()
  })
})
