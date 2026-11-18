import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProtectedRoute from '@/routes/ProtectedRoute'

const authState = vi.hoisted(() => ({ value: {} }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState.value,
}))

function SondaLogin() {
  const location = useLocation()
  return <div data-testid="destino">login|{location.state?.desde ?? 'sin-estado'}</div>
}

function SondaPortal() {
  return <div>portal</div>
}

function montar(ruta, auth) {
  authState.value = auth
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="/admin/panel" element={<div>Zona admin</div>} />
        </Route>
        <Route path="/login" element={<SondaLogin />} />
        <Route path="/portal" element={<SondaPortal />} />
      </Routes>
    </MemoryRouter>,
  )
}

const autenticadoAdmin = {
  token: 'tok',
  usuario: { id: 1, rol: 'admin' },
  autenticado: true,
  cargandoSesion: false,
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    authState.value = {}
  })

  it('sin sesión redirige a /login guardando pathname + search en desde', () => {
    montar('/admin/panel?x=1&y=2', { ...autenticadoAdmin, autenticado: false, usuario: null })
    expect(screen.getByTestId('destino')).toHaveTextContent('login|/admin/panel?x=1&y=2')
  })

  it('usuario sin rol va a /login', () => {
    montar('/admin/panel', { ...autenticadoAdmin, usuario: { id: 2 } })
    expect(screen.getByTestId('destino')).toHaveTextContent('login|/admin/panel')
  })

  it('rol sin permiso va al inicio de su rol', () => {
    montar('/admin/panel', { ...autenticadoAdmin, usuario: { id: 3, rol: 'cliente' } })
    expect(screen.getByText('portal')).toBeInTheDocument()
  })

  it('con el rol permitido muestra el contenido', () => {
    montar('/admin/panel', autenticadoAdmin)
    expect(screen.getByText('Zona admin')).toBeInTheDocument()
  })
})
