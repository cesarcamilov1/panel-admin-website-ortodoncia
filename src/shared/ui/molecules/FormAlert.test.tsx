import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormAlert } from './FormAlert'

describe('<FormAlert />', () => {
  it('uses role alert for the error tone', () => {
    render(<FormAlert tone="error">Correo o contraseña incorrectos.</FormAlert>)
    expect(screen.getByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.')
  })

  it('uses role status for the success tone', () => {
    render(<FormAlert tone="success">Listo.</FormAlert>)
    expect(screen.getByRole('status')).toHaveTextContent('Listo.')
  })

  it('uses role status for the info tone', () => {
    render(<FormAlert tone="info">Revisa tu correo.</FormAlert>)
    expect(screen.getByRole('status')).toHaveTextContent('Revisa tu correo.')
  })
})
