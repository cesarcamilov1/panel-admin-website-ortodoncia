import { type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RouteBoundary } from './RouteBoundary'

function BrokenRoute(): ReactNode {
  throw new Error('lazy chunk unavailable')
}

describe('RouteBoundary', () => {
  it('explains how to manually recover when a route chunk cannot load', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<RouteBoundary><BrokenRoute /></RouteBoundary>)

    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar esta sección.')
    expect(screen.getByRole('button', { name: 'Recargar página' })).toBeInTheDocument()
    expect(screen.getByText(/no se reenviarán automáticamente/i)).toBeInTheDocument()
  })
})
