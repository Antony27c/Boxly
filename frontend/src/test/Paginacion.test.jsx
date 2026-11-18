import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Paginacion from '@/components/ui/Paginacion'

function montar(props = {}) {
  const onPagina = vi.fn()
  render(
    <Paginacion
      pagina={2}
      paginas={5}
      desde={21}
      hasta={40}
      total={97}
      onPagina={onPagina}
      {...props}
    />,
  )
  return onPagina
}

describe('Paginacion', () => {
  it('muestra el rango y la página actual dentro de un nav rotulado', () => {
    montar()
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument()
    expect(screen.getByText('Mostrando 21 a 40 de 97')).toBeInTheDocument()
    expect(screen.getByText('Página 2 de 5')).toBeInTheDocument()
  })

  it('navega a la página anterior y siguiente', () => {
    const onPagina = montar()
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(onPagina).toHaveBeenCalledWith(3)
    fireEvent.click(screen.getByRole('button', { name: /anterior/i }))
    expect(onPagina).toHaveBeenCalledWith(1)
  })

  it('en la primera página Anterior está deshabilitado', () => {
    montar({ pagina: 1 })
    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeEnabled()
  })

  it('en la última página Siguiente está deshabilitado', () => {
    montar({ pagina: 5 })
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /anterior/i })).toBeEnabled()
  })
})
