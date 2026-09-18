import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SelectField, TextArea, TextField } from './Field'

describe('TextField error state', () => {
  it('renders no alert when there is no error', () => {
    render(<TextField label="Correo" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Correo')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('renders the error message and marks the field invalid', () => {
    render(<TextField label="Correo" error="El correo es obligatorio." />)

    const input = screen.getByLabelText('Correo')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('El correo es obligatorio.')
    expect(input).toHaveAttribute('aria-describedby', alert.id)
  })
})

describe('TextArea error state', () => {
  it('renders the error message', () => {
    render(<TextArea label="Notas" error="Campo requerido." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Campo requerido.')
    expect(screen.getByLabelText('Notas')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('SelectField error state', () => {
  it('renders the error message', () => {
    render(<SelectField label="Rol" options={['A', 'B']} error="Selecciona una opción." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Selecciona una opción.')
    expect(screen.getByLabelText('Rol')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('SelectField options', () => {
  it('keeps using the label as the value for a plain string option', () => {
    render(<SelectField label="Rol" options={['Titular', 'Asistente']} />)

    expect(screen.getByRole('option', { name: 'Titular' })).toHaveValue('Titular')
  })

  it('separates value from label, so two options may share a name', () => {
    render(
      <SelectField
        label="Sede"
        options={[
          { value: '', label: 'Todas las sedes' },
          { value: 'loc-1', label: 'Sede Roma' },
          { value: 'loc-2', label: 'Sede Roma' },
        ]}
        value="loc-2"
        onChange={() => {}}
      />,
    )

    expect(
      screen
        .getAllByRole<HTMLOptionElement>('option', { name: 'Sede Roma' })
        .map((option) => option.value),
    ).toEqual(['loc-1', 'loc-2'])
    expect(screen.getByLabelText('Sede')).toHaveValue('loc-2')
  })
})
