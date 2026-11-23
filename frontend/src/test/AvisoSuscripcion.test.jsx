import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from '@/layouts/AppLayout'

const hook = vi.hoisted(() => ({
  value: { suscripcion: null, cargando: false, error: null, recargar: vi.fn() },
}))
vi.mock('@/hooks/useSuscripcion', () => ({
  default: () => hook.value,
  reiniciarSuscripcion: vi.fn(),
}))

const auth = vi.hoisted(() => ({
  value: {
    token: 'tok',
    usuario: { id: 5, nombre: 'Ana', apellido: 'Pérez', email: 'ana@taller.com', rol: 'administrador' },
    autenticado: true,
    cargandoSesion: false,
    logout: vi.fn(),
  },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => auth.value,
  AuthProvider: ({ children }) => children,
}))

function Contenido() {
  return (
    <div>
      <button type="button">Acción</button>
      <input aria-label="Campo de prueba" />
    </div>
  )
}

function montar(ruta = '/hoy') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/suscripcion" element={<div>PaginaSuscripcion</div>} />
          <Route path="*" element={<Contenido />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function suscripcionCon(estado, extra = {}) {
  return {
    plan: { codigo: 'basico', nombre: 'Básico', precio_mensual: 15000, max_personal: 3 },
    vence_en: '2026-11-20',
    estado,
    dias_para_vencer: -3,
    cobro_automatico: false,
    personal_activo: 2,
    max_personal: 3,
    proximo_monto: 15000,
    ...extra,
  }
}

describe('Aviso de suscripción en AppLayout', () => {
  beforeEach(() => {
    hook.value = { suscripcion: null, cargando: false, error: null, recargar: vi.fn() }
    auth.value.usuario.rol = 'administrador'
    sessionStorage.clear()
  })

  it('en gracia el admin ve el aviso ámbar con link a /suscripcion', () => {
    hook.value.suscripcion = suscripcionCon('gracia')
    montar()

    expect(
      screen.getByText(/La suscripción venció; regularizala hasta el 27\/11 para evitar cortes/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Suscripción' })).toHaveAttribute(
      'href',
      '/suscripcion',
    )
  })

  it('en gracia el resto del personal ve el aviso sin link', () => {
    auth.value.usuario.rol = 'recepcion'
    hook.value.suscripcion = suscripcionCon('gracia')
    montar()

    expect(screen.getByText(/La suscripción venció/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ir a Suscripción' })).not.toBeInTheDocument()
  })

  it('en solo lectura hay aviso rojo y el contenido queda deshabilitado', () => {
    hook.value.suscripcion = suscripcionCon('solo_lectura')
    montar('/ordenes')

    expect(screen.getByText(/solo lectura por falta de pago/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Acción' })).toBeDisabled()
    expect(screen.getByLabelText('Campo de prueba')).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Ir a Suscripción' })).toBeInTheDocument()
  })

  it('en /suscripcion la página de pago no queda deshabilitada en solo lectura', () => {
    hook.value.suscripcion = suscripcionCon('solo_lectura')
    const { container } = montar('/suscripcion')

    expect(screen.getByText('PaginaSuscripcion')).toBeInTheDocument()
    expect(container.querySelector('fieldset')).not.toBeDisabled()
  })

  it('suspendida: el admin es redirigido a /suscripcion desde cualquier otra ruta', () => {
    hook.value.suscripcion = suscripcionCon('suspendida')
    montar('/ordenes')

    expect(screen.getByText('PaginaSuscripcion')).toBeInTheDocument()
  })

  it('suspendida: el resto del personal ve la pantalla de suspensión', () => {
    auth.value.usuario.rol = 'recepcion'
    hook.value.suscripcion = suscripcionCon('suspendida')
    montar('/hoy')

    expect(screen.getByText('El taller tiene la suscripción suspendida.')).toBeInTheDocument()
    expect(screen.getByText(/Hablá con el administrador del taller/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Acción' })).not.toBeInTheDocument()
  })

  it('al día no hay aviso ni bloqueo', () => {
    hook.value.suscripcion = suscripcionCon('al_dia', { dias_para_vencer: 30 })
    montar('/hoy')

    expect(screen.queryByText(/La suscripción venció/)).not.toBeInTheDocument()
    expect(screen.queryByText(/solo lectura por falta de pago/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Acción' })).toBeEnabled()
  })
})
