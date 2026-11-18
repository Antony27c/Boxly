import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import NoEncontrado from '@/pages/NoEncontrado'

describe('NoEncontrado', () => {
  it('avisa que nos desviamos de ruta y deja volver al inicio', () => {
    render(
      <MemoryRouter>
        <NoEncontrado />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Nos desviamos de ruta' })).toBeInTheDocument()
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Volver al inicio/ })).toHaveAttribute('href', '/inicio')
  })

  it('el cartel de desvío y el cono son decorativos', () => {
    const { container } = render(
      <MemoryRouter>
        <NoEncontrado />
      </MemoryRouter>,
    )
    const ilustracion = container.querySelector('[data-ilustracion="desvio"]')
    const dibujos = ilustracion.querySelectorAll('svg')
    expect(dibujos).toHaveLength(2)
    dibujos.forEach((dibujo) => expect(dibujo).toHaveAttribute('aria-hidden', 'true'))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
