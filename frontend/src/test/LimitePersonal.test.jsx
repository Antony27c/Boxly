import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import Usuarios from '@/pages/Usuarios'

const usuarios = vi.hoisted(() => ({
  listar: vi.fn(),
  listarPaginado: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  cambiarEstado: vi.fn(),
  eliminar: vi.fn(),
}))
const limite = vi.hoisted(() => ({
  obtener: vi.fn(),
}))
const auth = vi.hoisted(() => ({
  usuario: {
    id: 9,
    nombre: 'Admin',
    apellido: 'Sistema',
    email: 'admin@taller.com',
    rol: 'administrador',
  },
}))

vi.mock('@/services/usuarios', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, usuariosService: usuarios }
})
vi.mock('@/services/suscripcion', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, suscripcionService: limite }
})
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: auth.usuario,
    autenticado: true,
    cargandoSesion: false,
  }),
}))

const SUSCRIPCION_BASE = {
  plan: { codigo: 'esencial', nombre: 'Esencial', max_personal: 3 },
  personal_activo: 2,
  max_personal: 3,
}

const USUARIO_MECANICO = {
  id: 3,
  nombre: 'Meca',
  apellido: 'Nico',
  email: 'nico@taller.com',
  rol: 'mecanico',
  activo: true,
}
const USUARIO_INACTIVO = {
  id: 5,
  nombre: 'Ina',
  apellido: 'Activo',
  email: 'ina@taller.com',
  rol: 'recepcion',
  activo: false,
}

// Se reconoce por el código, no por el texto: el mensaje se muestra tal cual.
const ERROR_409_LIMITE = new ApiError(
  'Tu plan permite hasta 3 usuarios del personal. Pasá a un plan mayor para sumar más.',
  409,
  'limite_personal',
)

function montar() {
  return render(
    <MemoryRouter>
      <Usuarios />
    </MemoryRouter>,
  )
}

function tarjetaDe(titulo) {
  return screen.getByRole('heading', { name: titulo }).closest('li')
}

describe('Usuarios — límite de personal del plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.usuario = {
      id: 9,
      nombre: 'Admin',
      apellido: 'Sistema',
      email: 'admin@taller.com',
      rol: 'administrador',
    }
    usuarios.listarPaginado.mockResolvedValue({ items: [USUARIO_MECANICO], total: 1 })
    usuarios.listar.mockResolvedValue([USUARIO_MECANICO])
    limite.obtener.mockResolvedValue(SUSCRIPCION_BASE)
  })

  it('muestra el contador con el tope del plan', async () => {
    montar()
    expect(await screen.findByText('Personal: 2 de 3 en tu plan Esencial')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo usuario' })).toBeEnabled()
  })

  it('con plan sin límite muestra el contador sin tope', async () => {
    limite.obtener.mockResolvedValue({
      ...SUSCRIPCION_BASE,
      plan: { codigo: 'profesional', nombre: 'Profesional', max_personal: null },
      personal_activo: 7,
      max_personal: null,
    })
    montar()
    expect(await screen.findByText('Personal: 7 · plan sin límite')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo usuario' })).toBeEnabled()
  })

  it('al llegar al límite deshabilita el alta y ofrece Ver planes', async () => {
    limite.obtener.mockResolvedValue({ ...SUSCRIPCION_BASE, personal_activo: 3 })
    montar()

    expect(await screen.findByText('Personal: 3 de 3 en tu plan Esencial')).toBeInTheDocument()
    expect(screen.getByText(/Llegaste al límite de tu plan/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo usuario' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute(
      'href',
      '/suscripcion',
    )
  })

  it('no deja reactivar personal con el plan lleno', async () => {
    limite.obtener.mockResolvedValue({ ...SUSCRIPCION_BASE, personal_activo: 3 })
    usuarios.listarPaginado.mockResolvedValue({ items: [USUARIO_INACTIVO], total: 1 })
    usuarios.listar.mockResolvedValue([USUARIO_INACTIVO])
    montar()

    await screen.findByRole('heading', { name: 'Activo, Ina' })
    fireEvent.click(
      within(tarjetaDe('Activo, Ina')).getByRole('button', { name: 'Activar' }),
    )

    expect(usuarios.cambiarEstado).not.toHaveBeenCalled()
    // El texto aparece en el alta bloqueada y en el aviso: alcanza con que se vea.
    expect(
      (await screen.findAllByText(/Llegaste al límite de tu plan/)).length,
    ).toBeGreaterThan(0)
    // Con el plan lleno hay dos "Ver planes": el del alta bloqueada y el del aviso.
    for (const enlace of screen.getAllByRole('link', { name: 'Ver planes' })) {
      expect(enlace).toHaveAttribute('href', '/suscripcion')
    }
  })

  it('muestra el mensaje del 409 del servidor con el link a planes', async () => {
    // El contador local dice que hay lugar pero el servidor ya está lleno.
    usuarios.crear.mockRejectedValue(ERROR_409_LIMITE)
    montar()

    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo usuario' }))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Nuevo' } })
    fireEvent.change(within(dialogo).getByLabelText('Apellido'), { target: { value: 'User' } })
    fireEvent.change(within(dialogo).getByLabelText('Correo'), {
      target: { value: 'nuevo@taller.com' },
    })
    fireEvent.change(within(dialogo).getByLabelText('Contraseña'), {
      target: { value: 'Clave1234' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar usuario' }))

    await waitFor(() => expect(usuarios.crear).toHaveBeenCalled())
    // El modal se cierra y el aviso queda a nivel página, con el link.
    expect(
      await screen.findByText(/Tu plan permite hasta 3 usuarios del personal/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute(
      'href',
      '/suscripcion',
    )
  })

  it('el contador se actualiza después de crear y desactivar', async () => {
    let respuesta = { ...SUSCRIPCION_BASE, personal_activo: 2 }
    limite.obtener.mockImplementation(() => Promise.resolve(respuesta))
    usuarios.crear.mockImplementation(async () => {
      respuesta = { ...respuesta, personal_activo: respuesta.personal_activo + 1 }
      return { id: 10 }
    })
    usuarios.cambiarEstado.mockImplementation(async (_id, activo) => {
      respuesta = { ...respuesta, personal_activo: activo ? respuesta.personal_activo + 1 : respuesta.personal_activo - 1 }
      return {}
    })
    montar()

    expect(await screen.findByText('Personal: 2 de 3 en tu plan Esencial')).toBeInTheDocument()

    // Crear suma uno.
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Nuevo' } })
    fireEvent.change(within(dialogo).getByLabelText('Apellido'), { target: { value: 'User' } })
    fireEvent.change(within(dialogo).getByLabelText('Correo'), {
      target: { value: 'nuevo@taller.com' },
    })
    fireEvent.change(within(dialogo).getByLabelText('Contraseña'), {
      target: { value: 'Clave1234' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar usuario' }))
    expect(await screen.findByText('Personal: 3 de 3 en tu plan Esencial')).toBeInTheDocument()

    // Desactivar vuelve a bajar (el usuario de la lista sigue activo en el mock).
    usuarios.listarPaginado.mockResolvedValue({ items: [USUARIO_MECANICO], total: 1 })
    await screen.findByRole('heading', { name: 'Nico, Meca' })
    fireEvent.click(
      within(tarjetaDe('Nico, Meca')).getByRole('button', { name: 'Desactivar' }),
    )
    expect(await screen.findByText('Personal: 2 de 3 en tu plan Esencial')).toBeInTheDocument()
  })

  it('reconoce el 409 del límite por el código aunque el texto cambie', async () => {
    usuarios.crear.mockRejectedValue(new ApiError('Sin lugar en el plan', 409, 'limite_personal'))
    montar()
    await completarAlta()

    expect(await screen.findByText('Sin lugar en el plan')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute('href', '/suscripcion')
  })

  it('un 409 sin el código (correo repetido) queda en el formulario, sin aviso de plan', async () => {
    usuarios.crear.mockRejectedValue(new ApiError('Tu plan permite hasta 3 usuarios del personal', 409))
    montar()
    const dialogo = await completarAlta()

    expect(await within(dialogo).findByText('Tu plan permite hasta 3 usuarios del personal')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver planes' })).not.toBeInTheDocument()
  })
})

async function completarAlta() {
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo usuario' }))
  const dialogo = await screen.findByRole('dialog')
  fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Nuevo' } })
  fireEvent.change(within(dialogo).getByLabelText('Apellido'), { target: { value: 'User' } })
  fireEvent.change(within(dialogo).getByLabelText('Correo'), { target: { value: 'nuevo@taller.com' } })
  fireEvent.change(within(dialogo).getByLabelText('Contraseña'), { target: { value: 'Clave1234' } })
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar usuario' }))
  await waitFor(() => expect(usuarios.crear).toHaveBeenCalled())
  return dialogo
}
