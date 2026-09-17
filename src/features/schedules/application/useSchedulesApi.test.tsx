import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { HttpClient } from '../../../shared/api/http'
import { HttpProvider } from '../../../shared/api/HttpProvider'
import { useSchedulesApi } from './useSchedulesApi'

function Probe() {
  const api = useSchedulesApi()
  return <span>{Object.keys(api).sort().join(',')}</span>
}

describe('useSchedulesApi', () => {
  it('builds the schedules api on top of the app-wide http client', () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      del: vi.fn(),
    } as unknown as HttpClient

    render(
      <HttpProvider client={client}>
        <Probe />
      </HttpProvider>,
    )

    expect(
      screen.getByText(
        'createBlock,createSchedule,deleteBlock,deleteSchedule,listBlocks,listSchedules',
      ),
    ).toBeInTheDocument()
  })
})
