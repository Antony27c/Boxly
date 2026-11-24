import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProtectedRoute from '@/routes/ProtectedRoute'

const authState = vi.hoisted(() => ({ value: {} }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState.value,
}))

const soporteState = vi.hoisted(() => ({
  value: { activo: false, taller: null, hasta: null, entrar: vi.fn(), salir: vi.fn() },
}))
vi.mock('@/context/SoporteContext', () => ({
  useSoporte: () => soporteState.value,
  SoporteProvider: ({ children }) => children,
}))

function SondaLogin() {
  const location = useLocation()
  return <div data-testid="destino">login|{location.state?.desde ?? 'sin-estado'}</div>
}

function SondaPortal() {
  return <div>portal</div>
}

function montar(ruta, auth, { roles = ['admin'], soporteActivo = false } = {}) {
  authState.value = auth
  soporteState.value.activo = soporteActivo
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<ProtectedRoute roles={roles} />}>
          <Route path="/admin/panel" element={<div>Zona admin</div>} />
          <Route path="/hoy" element={<div>Zona taller</div>} />
        </Route>
        <Route path="/login" element={<SondaLogin />} />
        <Route path="/portal" element={<SondaPortal />} />
        <Route element={<ProtectedRoute roles={['superadmin']} />}>
          <Route path="/plataforma" element={<div>Plataforma</div>} />
        </Route>
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

const superadmin = {
  token: 'tok',
  usuario: { id: 9, rol: 'superadmin' },
  autenticado: true,
  cargandoSesion: false,
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    authState.value = {}
    soporteState.value.activo = false
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

describe('ProtectedRoute en modo soporte', () => {
  beforeEach(() => {
    authState.value = {}
    soporteState.value.activo = false
  })

  const rolesTaller = ['administrador', 'recepcion', 'mecanico']

  it('superadmin sin modo soporte no entra a rutas del taller', () => {
    montar('/hoy', superadmin, { roles: rolesTaller })
    expect(screen.getByText('Plataforma')).toBeInTheDocument()
  })

  it('superadmin en modo soporte entra a las rutas del taller como administrador', () => {
    montar('/hoy', superadmin, { roles: rolesTaller, soporteActivo: true })
    expect(screen.getByText('Zona taller')).toBeInTheDocument()
  })

  it('en modo soporte sigue pudiendo entrar a rutas de plataforma', () => {
    montar('/plataforma', superadmin, { roles: ['superadmin'], soporteActivo: true })
    expect(screen.getByText('Plataforma')).toBeInTheDocument()
  })

  it('el modo soporte no eleva a quien no es superadmin', () => {
    montar(
      '/hoy',
      { ...autenticadoAdmin, usuario: { id: 4, rol: 'cliente' } },
      { roles: rolesTaller, soporteActivo: true },
    )
    expect(screen.getByText('portal')).toBeInTheDocument()
  })
})
