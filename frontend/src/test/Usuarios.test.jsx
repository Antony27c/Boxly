import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Usuarios from '@/pages/Usuarios'
import { rolesAsignables } from '@/services/usuarios'

const usuarios = vi.hoisted(() => ({
  listar: vi.fn(),
  listarPaginado: vi.fn(),
  contarAdministradoresActivos: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  cambiarEstado: vi.fn(),
  eliminar: vi.fn(),
}))
const cuentas = vi.hoisted(() => ({
  restablecerPassword: vi.fn(),
  cerrarSesiones: vi.fn(),
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
vi.mock('@/services/cuentas', () => ({ cuentasService: cuentas }))
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

const LECTOR_ADMIN = {
  id: 9,
  nombre: 'Admin',
  apellido: 'Sistema',
  email: 'admin@taller.com',
  rol: 'administrador',
}
const LECTOR_SUPER = {
  id: 4,
  nombre: 'Sara',
  apellido: 'Super',
  email: 'sara@taller.com',
  rol: 'superadmin',
}

const USUARIO_ADMIN = {
  id: 2,
  nombre: 'Ada',
  apellido: 'Min',
  email: 'ada@taller.com',
  rol: 'administrador',
  activo: true,
}
const USUARIO_SUPER = {
  id: 4,
  nombre: 'Sara',
  apellido: 'Super',
  email: 'sara@taller.com',
  rol: 'superadmin',
  activo: true,
}
const USUARIO_MECANICO = {
  id: 3,
  nombre: 'Meca',
  apellido: 'Nico',
  email: 'nico@taller.com',
  rol: 'mecanico',
  activo: true,
}

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

describe('rolesAsignables', () => {
  it('ofrece administrador, recepción y mecánico, nunca superadmin', () => {
    expect(rolesAsignables().map((rol) => rol.valor)).toEqual([
      'administrador',
      'recepcion',
      'mecanico',
    ])
  })
})

describe('Usuarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.usuario = LECTOR_ADMIN
    usuarios.listarPaginado.mockResolvedValue({ items: [USUARIO_ADMIN, USUARIO_MECANICO], total: 2 })
    usuarios.listar.mockResolvedValue([USUARIO_ADMIN, USUARIO_MECANICO])
    usuarios.contarAdministradoresActivos.mockResolvedValue(2)
    cuentas.restablecerPassword.mockResolvedValue({ password_temporal: 'Tmp1234ab' })
    cuentas.cerrarSesiones.mockResolvedValue({
      detail: 'Se cerraron las sesiones de nico@taller.com',
    })
    // Plan sin límite por defecto: estos tests no ejercitan el tope (eso va en
    // LimitePersonal.test.jsx).
    limite.obtener.mockResolvedValue({
      plan: { codigo: 'profesional', nombre: 'Profesional', max_personal: null },
      personal_activo: 4,
      max_personal: null,
    })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  it('un administrador gestiona a otros administradores, no a una cuenta superadmin', async () => {
    usuarios.listarPaginado.mockResolvedValue({
      items: [USUARIO_ADMIN, USUARIO_SUPER, USUARIO_MECANICO],
      total: 3,
    })
    montar()

    // P1: el administrador gestiona todo el personal de su taller, también a
    // otros administradores.
    await screen.findByRole('heading', { name: 'Min, Ada' })
    const admin = tarjetaDe('Min, Ada')
    expect(within(admin).queryByText('Solo superadmin')).not.toBeInTheDocument()
    expect(within(admin).getByRole('button', { name: 'Editar' })).toBeInTheDocument()

    const superadmin = tarjetaDe('Super, Sara')
    expect(within(superadmin).getByText('Solo superadmin')).toBeInTheDocument()
    expect(within(superadmin).queryByRole('button')).not.toBeInTheDocument()

    // La cuenta de mecánico sí se gestiona, pero sin las acciones de superadmin.
    const mecanico = tarjetaDe('Nico, Meca')
    expect(within(mecanico).getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(within(mecanico).getByRole('button', { name: 'Desactivar' })).toBeInTheDocument()
    expect(
      within(mecanico).queryByRole('button', { name: 'Restablecer contraseña' }),
    ).not.toBeInTheDocument()
    expect(
      within(mecanico).queryByRole('button', { name: 'Cerrar sesiones' }),
    ).not.toBeInTheDocument()
  })

  it('un administrador puede elegir administrador al crear un usuario', async () => {
    usuarios.crear.mockResolvedValue({ id: 20 })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo usuario' }))

    const dialogo = await screen.findByRole('dialog')
    const select = within(dialogo).getByLabelText('Rol')
    const textos = within(select)
      .getAllByRole('option')
      .map((opcion) => opcion.textContent)
    expect(textos).toEqual(['Administrador', 'Recepcionista', 'Mecánico'])

    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Bruno' } })
    fireEvent.change(within(dialogo).getByLabelText('Apellido'), { target: { value: 'Díaz' } })
    fireEvent.change(within(dialogo).getByLabelText('Correo'), {
      target: { value: 'bruno@taller.com' },
    })
    fireEvent.change(select, { target: { value: 'administrador' } })
    fireEvent.change(within(dialogo).getByLabelText('Contraseña'), {
      target: { value: 'Clave1234' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar usuario' }))

    await waitFor(() =>
      expect(usuarios.crear).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'bruno@taller.com', rol: 'administrador' }),
        'tok',
      ),
    )
  })

  it('el filtro de rol no ofrece Superadmin', async () => {
    montar()
    await screen.findByRole('heading', { name: 'Min, Ada' })
    const filtro = screen.getByLabelText('Rol')
    const textos = within(filtro)
      .getAllByRole('option')
      .map((opcion) => opcion.textContent)
    expect(textos).toEqual(['Todos los roles', 'Administrador', 'Recepcionista', 'Mecánico'])
  })

  it('el único administrador activo no se puede desactivar, eliminar ni cambiar de rol', async () => {
    usuarios.contarAdministradoresActivos.mockResolvedValue(1)
    montar()
    await screen.findByText(/único administrador activo/)

    const admin = tarjetaDe('Min, Ada')
    expect(within(admin).getByRole('button', { name: 'Desactivar' })).toBeDisabled()
    expect(within(admin).getByRole('button', { name: 'Eliminar' })).toBeDisabled()
    expect(within(admin).getByText(/único administrador activo/)).toBeInTheDocument()

    // El mecánico sigue con sus acciones.
    const mecanico = tarjetaDe('Nico, Meca')
    expect(within(mecanico).getByRole('button', { name: 'Desactivar' })).toBeEnabled()

    fireEvent.click(within(admin).getByRole('button', { name: 'Editar' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByLabelText('Rol')).toBeDisabled()
  })

  it('con más de un administrador activo se pueden desactivar', async () => {
    montar()
    await screen.findByRole('heading', { name: 'Min, Ada' })
    await waitFor(() => expect(usuarios.contarAdministradoresActivos).toHaveBeenCalled())
    const admin = tarjetaDe('Min, Ada')
    expect(within(admin).getByRole('button', { name: 'Desactivar' })).toBeEnabled()
    expect(within(admin).queryByText(/único administrador activo/)).not.toBeInTheDocument()
  })

  it('siendo superadmin el formulario tampoco ofrece superadmin', async () => {
    auth.usuario = LECTOR_SUPER
    usuarios.listarPaginado.mockResolvedValue({ items: [USUARIO_SUPER], total: 1 })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo usuario' }))

    const dialogo = await screen.findByRole('dialog')
    const select = within(dialogo).getByLabelText('Rol')
    const textos = within(select)
      .getAllByRole('option')
      .map((opcion) => opcion.textContent)
    expect(textos).toEqual(['Administrador', 'Recepcionista', 'Mecánico'])
  })

  it('el superadmin restablece la contraseña, ve la temporal una vez y la copia', async () => {
    auth.usuario = LECTOR_SUPER
    usuarios.listarPaginado.mockResolvedValue({ items: [USUARIO_MECANICO], total: 1 })
    montar()

    await screen.findByRole('heading', { name: 'Nico, Meca' })
    const tarjeta = tarjetaDe('Nico, Meca')
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Restablecer contraseña' }))

    const confirmacion = await screen.findByRole('dialog')
    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Restablecer' }))

    await waitFor(() =>
      expect(cuentas.restablecerPassword).toHaveBeenCalledWith(USUARIO_MECANICO.id, 'tok'),
    )

    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByText('Tmp1234ab')).toBeInTheDocument()
    expect(within(modal).getByText(/no se vuelve a mostrar/)).toBeInTheDocument()

    fireEvent.click(within(modal).getByRole('button', { name: 'Copiar' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Tmp1234ab'),
    )
    expect(await within(modal).findByRole('button', { name: 'Copiado' })).toBeInTheDocument()
  })

  it('cerrar sesiones llama al servicio y muestra el aviso de éxito', async () => {
    auth.usuario = LECTOR_SUPER
    usuarios.listarPaginado.mockResolvedValue({ items: [USUARIO_MECANICO], total: 1 })
    montar()

    await screen.findByRole('heading', { name: 'Nico, Meca' })
    const tarjeta = tarjetaDe('Nico, Meca')
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Cerrar sesiones' }))

    const confirmacion = await screen.findByRole('dialog')
    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Cerrar sesiones' }))

    await waitFor(() =>
      expect(cuentas.cerrarSesiones).toHaveBeenCalledWith(USUARIO_MECANICO.id, 'tok'),
    )
    expect(
      await screen.findByText('Se cerraron las sesiones de nico@taller.com'),
    ).toBeInTheDocument()
  })

  it('la tarjeta del propio usuario no tiene Desactivar ni Cerrar sesiones', async () => {
    auth.usuario = LECTOR_SUPER
    usuarios.listarPaginado.mockResolvedValue({ items: [USUARIO_SUPER, USUARIO_MECANICO], total: 2 })
    montar()

    await screen.findByRole('heading', { name: 'Super, Sara' })
    const propia = tarjetaDe('Super, Sara')
    expect(within(propia).getByRole('button', { name: 'Restablecer contraseña' })).toBeInTheDocument()
    expect(within(propia).queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument()
    expect(within(propia).queryByRole('button', { name: 'Cerrar sesiones' })).not.toBeInTheDocument()

    const otra = tarjetaDe('Nico, Meca')
    expect(within(otra).getByRole('button', { name: 'Desactivar' })).toBeInTheDocument()
    expect(within(otra).getByRole('button', { name: 'Cerrar sesiones' })).toBeInTheDocument()
  })

  it('un error del servidor se muestra con su mensaje', async () => {
    auth.usuario = LECTOR_SUPER
    cuentas.cerrarSesiones.mockRejectedValue(
      new Error('Solo el superadmin puede gestionar administradores'),
    )
    usuarios.listarPaginado.mockResolvedValue({ items: [USUARIO_MECANICO], total: 1 })
    montar()

    await screen.findByRole('heading', { name: 'Nico, Meca' })
    const tarjeta = tarjetaDe('Nico, Meca')
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Cerrar sesiones' }))

    const confirmacion = await screen.findByRole('dialog')
    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Cerrar sesiones' }))

    expect(
      await within(confirmacion).findByText('Solo el superadmin puede gestionar administradores'),
    ).toBeInTheDocument()
  })
})
