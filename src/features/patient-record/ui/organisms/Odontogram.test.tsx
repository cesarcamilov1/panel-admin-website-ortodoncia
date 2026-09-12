import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Odontogram } from './Odontogram'

function findingsPanel() {
  return screen.getByText('Hallazgos').closest('section') as HTMLElement
}

describe('<Odontogram />', () => {
  it('lists the seeded findings', () => {
    render(<Odontogram onSendToPlan={vi.fn()} />)
    expect(within(findingsPanel()).getByText('Oclusal · Caries')).toBeInTheDocument()
  })

  it('marks a surface with the selected tool', async () => {
    const user = userEvent.setup()
    render(<Odontogram onSendToPlan={vi.fn()} />)

    await user.click(screen.getByRole('radio', { name: 'Obturación' }))
    await user.click(screen.getByRole('button', { name: 'Diente 15, Vestibular' }))

    expect(within(findingsPanel()).getByText('Vestibular · Obturación')).toBeInTheDocument()
  })

  it('removes a finding from the panel', async () => {
    const user = userEvent.setup()
    render(<Odontogram onSendToPlan={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Quitar Diente 16, Oclusal · Caries' }))

    expect(within(findingsPanel()).queryByText('Oclusal · Caries')).not.toBeInTheDocument()
  })

  it('swaps to primary dentition', async () => {
    const user = userEvent.setup()
    render(<Odontogram onSendToPlan={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Temporal' }))

    expect(screen.getByRole('button', { name: 'Diente 55, Vestibular' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Diente 18, Vestibular' })).not.toBeInTheDocument()
  })

  it('hands the findings over to the treatment plan', async () => {
    const user = userEvent.setup()
    const onSendToPlan = vi.fn()
    render(<Odontogram onSendToPlan={onSendToPlan} />)

    await user.click(screen.getByRole('button', { name: /Pasar hallazgos al plan/ }))

    expect(onSendToPlan).toHaveBeenCalledOnce()
  })
})
