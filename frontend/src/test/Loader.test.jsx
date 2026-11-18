import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Loader from '@/components/ui/Loader'

const FRASES = ['Cargando…', 'Calentando el motor…', 'Ajustando tuercas…']

describe('Loader', () => {
  it('anuncia el texto indicado como estado', () => {
    render(<Loader texto="Cargando órdenes…" />)
    const estado = screen.getByRole('status')
    expect(estado).toHaveTextContent('Cargando órdenes…')
    expect(screen.getByText('Cargando órdenes…')).toBeVisible()
  })

  it('sin texto usa una frase de taller que no cambia entre renders', () => {
    const { rerender } = render(<Loader />)
    const frase = screen.getByRole('status').textContent
    expect(FRASES).toContain(frase)

    rerender(<Loader />)
    rerender(<Loader />)
    expect(screen.getByRole('status')).toHaveTextContent(frase)
  })

  it('el neumático es decorativo y solo gira si se permite movimiento', () => {
    const { container } = render(<Loader texto="Cargando…" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg.getAttribute('class')).toMatch(/motion-safe:animate-/)
    expect(svg.getAttribute('class')).not.toMatch(/(^|\s)animate-spin/)
  })
})
