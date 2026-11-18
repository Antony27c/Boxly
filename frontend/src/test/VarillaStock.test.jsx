import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import VarillaStock from '@/components/inventario/VarillaStock'

describe('Stock como varilla de aceite', () => {
  it('con stock de sobra queda en verde', () => {
    const { container } = render(<VarillaStock stock={12} minimo={5} />)
    expect(screen.getByRole('img', { name: 'Stock 12, mínimo 5: nivel correcto' })).toBeInTheDocument()
    expect(container.querySelector('.fill-ok')).toBeInTheDocument()
    expect(screen.getByText('MIN')).toBeInTheDocument()
    expect(screen.getByText('MAX')).toBeInTheDocument()
  })

  it('cerca del mínimo o justo en él queda en ámbar', () => {
    const { container, rerender } = render(<VarillaStock stock={7} minimo={5} />)
    expect(screen.getByRole('img', { name: 'Stock 7, mínimo 5: cerca del mínimo' })).toBeInTheDocument()
    expect(container.querySelector('.fill-amber')).toBeInTheDocument()
    rerender(<VarillaStock stock={5} minimo={5} />)
    expect(screen.getByRole('img', { name: 'Stock 5, mínimo 5: en el mínimo' })).toBeInTheDocument()
  })

  it('debajo del mínimo queda en rojo', () => {
    const { container, rerender } = render(<VarillaStock stock={4} minimo={5} />)
    expect(screen.getByRole('img', { name: 'Stock 4, mínimo 5: bajo el mínimo' })).toBeInTheDocument()
    expect(container.querySelector('.fill-danger')).toBeInTheDocument()
    rerender(<VarillaStock stock={0} minimo={5} />)
    expect(screen.getByRole('img', { name: 'Stock 0, mínimo 5: sin stock' })).toBeInTheDocument()
  })
})
