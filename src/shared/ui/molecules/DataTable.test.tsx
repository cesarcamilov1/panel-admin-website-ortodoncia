import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataTable, type Column, Stacked } from './DataTable'

interface Row {
  id: string
  name: string
  note: string
}

const LONG_NOTE =
  'Profilaxis completa con pulido, aplicación de flúor, revisión de encías, ' +
  'instrucciones de higiene y control de placa en una sola sesión extendida.'

const rows: Row[] = [{ id: 'r1', name: 'Limpieza dental', note: LONG_NOTE }]

const columns: Column<Row>[] = [
  { key: 'name', label: 'Servicio', grow: 2, render: (row) => <Stacked top={row.name} bottom={row.note} /> },
  { key: 'code', label: 'Código', width: '104px', render: () => 'LIMP-01' },
  { key: 'price', label: 'Precio', width: '104px', align: 'right', render: () => '$850.00' },
]

function cellsOf(container: HTMLElement): HTMLElement[] {
  const row = container.querySelectorAll('[role="row"]')[1] as HTMLElement
  return Array.from(row.children) as HTMLElement[]
}

describe('DataTable column sizing', () => {
  it('sizes a growing column from its grow factor, not from its content width', () => {
    const { container } = render(
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />,
    )
    const [growing] = cellsOf(container)

    // flex-basis 0 is what stops a long cell from claiming its max-content width and
    // squeezing every other column.
    expect(growing.style.flexBasis).toBe('0px')
    expect(growing.style.flexGrow).toBe('2')
    expect(growing.style.flexShrink).toBe('1')
    expect(growing.style.minWidth).toBe('0px')
  })

  it('never shrinks a fixed-width column', () => {
    const { container } = render(
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />,
    )
    const [, fixed] = cellsOf(container)

    expect(fixed.style.flexBasis).toBe('104px')
    expect(fixed.style.flexGrow).toBe('0')
    expect(fixed.style.flexShrink).toBe('0')
  })

  it('gives the header the same sizing as the body so the columns line up', () => {
    const { container } = render(
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />,
    )
    const head = container.querySelectorAll('[role="row"]')[0] as HTMLElement
    const headCells = Array.from(head.children) as HTMLElement[]

    expect(headCells[0].style.flexBasis).toBe('0px')
    expect(headCells[1].style.flexBasis).toBe('104px')
    expect(headCells[1].style.flexShrink).toBe('0')
  })

  it('keeps the declared alignment', () => {
    const { container } = render(
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />,
    )
    const cells = cellsOf(container)
    expect(cells[0].style.textAlign).toBe('left')
    expect(cells[2].style.textAlign).toBe('right')
  })

  it('still renders the full text in the DOM, so only the display is clipped', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />)
    expect(screen.getByText(LONG_NOTE)).toBeInTheDocument()
  })

  it('exposes the clipped text in full on hover', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />)
    expect(screen.getByText(LONG_NOTE)).toHaveAttribute('title', LONG_NOTE)
  })
})
