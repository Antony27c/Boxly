import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import AppLayout from '@/layouts/AppLayout'

const auth = vi.hoisted(() => ({ rol: 'recepcion' }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ usuario: { id: 1, nombre: 'Rosa', rol: auth.rol }, logout: vi.fn() }),
}))

function Ubicacion() {
  return <output data-testid="ubicacion">{useLocation().pathname}</output>
}

function montar(desde) {
  return render(
    <MemoryRouter initialEntries={[desde]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="*" element={<Ubicacion />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppLayout: logo', () => {
  it('el logo y el nombre llevan al inicio del rol', () => {
    auth.rol = 'recepcion'
    montar('/clientes')
    fireEvent.click(screen.getAllByRole('link', { name: 'Ir al inicio' })[0])
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/hoy')
  })

  it('el cliente vuelve a su portal', () => {
    auth.rol = 'cliente'
    montar('/ayuda')
    expect(screen.getAllByRole('link', { name: 'Ir al inicio' })[0]).toHaveAttribute('href', '/portal')
  })

  it('la barra lateral muestra las paginas del rol y las acciones de cuenta', () => {
    auth.rol = 'recepcion'
    montar('/hoy')
    const lateral = screen.getByRole('complementary', { name: 'Navegación principal' })
    expect(lateral).toHaveClass('chapa-melon', 'bg-graphite-800')
    expect(within(lateral).getByRole('link', { name: /Órdenes/ })).toHaveAttribute('href', '/ordenes')
    expect(within(lateral).getByRole('link', { name: /Ayuda/ })).toHaveAttribute('href', '/ayuda')
    expect(within(lateral).getByRole('button', { name: /Cerrar sesión/ })).toBeInTheDocument()
  })
})
