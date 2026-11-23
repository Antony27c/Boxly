import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Configuracion from '@/pages/Configuracion'
import { TemaProvider } from '@/context/TemaContext'
import { ToastProvider } from '@/context/ToastContext'

const auth = vi.hoisted(() => ({
  usuario: { id: 1, nombre: 'Ana', apellido: 'Gómez', email: 'ana@taller.com', rol: 'recepcion' },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: auth.usuario,
    autenticado: true,
    cargandoSesion: false,
  }),
}))

vi.mock('@/services/soporte', () => ({
  soporteService: {
    listarAccesos: vi.fn().mockResolvedValue([]),
    crearAcceso: vi.fn(),
    revocarAcceso: vi.fn(),
    listarActividad: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}))

const USUARIO_ADMIN = {
  id: 2,
  nombre: 'Admin',
  apellido: 'Sistema',
  email: 'admin@taller.com',
  rol: 'administrador',
}

function montar() {
  return render(
    <MemoryRouter>
      <TemaProvider>
        <ToastProvider>
          <Configuracion />
        </ToastProvider>
      </TemaProvider>
    </MemoryRouter>,
  )
}

describe('Configuracion', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    auth.usuario = { id: 1, nombre: 'Ana', apellido: 'Gómez', email: 'ana@taller.com', rol: 'recepcion' }
  })

  it('elegir otro tema llama setTema: pone la clase dark y lo guarda', async () => {
    montar()

    fireEvent.click(screen.getByRole('radio', { name: /Oscuro/ }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('boxly.tema')).toBe('oscuro')
    expect(await screen.findByText('Preferencia guardada')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /Claro/ }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('boxly.tema')).toBe('claro')
  })

  it('el switch de reducir animaciones agrega la clase y persiste', () => {
    montar()
    const interruptor = screen.getByRole('switch', { name: 'Reducir animaciones' })
    expect(interruptor).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(interruptor)

    expect(document.documentElement.classList.contains('reducir-movimiento')).toBe(true)
    expect(localStorage.getItem('boxly.reducirMovimiento')).toBe('1')
    expect(interruptor).toHaveAttribute('aria-checked', 'true')
  })

  it('elegir texto grande activa la clase y persiste', () => {
    montar()

    fireEvent.click(screen.getByRole('radio', { name: 'Grande' }))

    expect(document.documentElement.classList.contains('texto-grande')).toBe(true)
    expect(localStorage.getItem('boxly.textoGrande')).toBe('1')
    expect(screen.getByRole('radio', { name: 'Grande' })).toHaveAttribute('aria-checked', 'true')
  })

  it('la sección Taller solo aparece para administrador', () => {
    auth.usuario = USUARIO_ADMIN
    montar()

    expect(
      screen.getByRole('button', { name: /Volver a mostrar Primeros pasos/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Usuarios' })).toHaveAttribute('href', '/usuarios')
  })

  it('sin rol de administrador no se ve la sección Taller', () => {
    montar()

    expect(
      screen.queryByRole('button', { name: /Volver a mostrar Primeros pasos/ }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument()
  })

  it('"Volver a mostrar Primeros pasos" borra la clave y avisa', async () => {
    auth.usuario = USUARIO_ADMIN
    localStorage.setItem('boxly.primerosPasos.oculto', '1')
    montar()

    fireEvent.click(screen.getByRole('button', { name: /Volver a mostrar Primeros pasos/ }))

    expect(localStorage.getItem('boxly.primerosPasos.oculto')).toBeNull()
    expect(await screen.findByText(/primeros pasos vuelven a mostrarse/i)).toBeInTheDocument()
  })

  it('Mi cuenta muestra los datos del usuario en solo lectura', () => {
    montar()

    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Gómez')).toBeInTheDocument()
    expect(screen.getByText('ana@taller.com')).toBeInTheDocument()
    expect(screen.getByText('Recepción')).toBeInTheDocument()
    expect(
      screen.getByText(/Para cambiar tu contraseña, pedile al administrador del taller/),
    ).toBeInTheDocument()
  })
})
