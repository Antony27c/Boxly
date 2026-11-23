import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Usuarios from '@/pages/Usuarios'
import { rolesAsignables } from '@/services/usuarios'

const usuarios = vi.hoisted(() => ({
  listar: vi.fn(),
  listarPaginado: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  cambiarEstado: vi.fn(),
  eliminar: vi.fn(),
}))
const cuentas = vi.hoisted(() => ({
  restablecerPassword: vi.fn(),
  cerrarSesiones: vi.fn(),
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
  it('el superadmin puede asignar todos los roles', () => {
    expect(rolesAsignables('superadmin').map((rol) => rol.valor)).toEqual([
      'superadmin',
      'administrador',
      'recepcion',
      'mecanico',
    ])
  })

  it('el administrador solo puede asignar recepción y mecánico', () => {
    expect(rolesAsignables('administrador').map((rol) => rol.valor)).toEqual([
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
    cuentas.restablecerPassword.mockResolvedValue({ password_temporal: 'Tmp1234ab' })
    cuentas.cerrarSesiones.mockResolvedValue({
      detail: 'Se cerraron las sesiones de nico@taller.com',
    })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  it('un administrador no ve acciones sobre tarjetas de administradores o superadmins', async () => {
    usuarios.listarPaginado.mockResolvedValue({
      items: [USUARIO_ADMIN, USUARIO_SUPER, USUARIO_MECANICO],
      total: 3,
    })
    montar()

    await screen.findByRole('heading', { name: 'Min, Ada' })
    for (const titulo of ['Min, Ada', 'Super, Sara']) {
      const tarjeta = tarjetaDe(titulo)
      expect(within(tarjeta).getByText('Solo superadmin')).toBeInTheDocument()
      expect(within(tarjeta).queryByRole('button')).not.toBeInTheDocument()
    }

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

  it('el formulario de nuevo usuario solo ofrece los roles que el admin puede asignar', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo usuario' }))

    const dialogo = await screen.findByRole('dialog')
    const select = within(dialogo).getByLabelText('Rol')
    const textos = within(select)
      .getAllByRole('option')
      .map((opcion) => opcion.textContent)
    expect(textos).toEqual(['Recepcionista', 'Mecánico'])
  })

  it('siendo superadmin el formulario ofrece todos los roles', async () => {
    auth.usuario = LECTOR_SUPER
    usuarios.listarPaginado.mockResolvedValue({ items: [USUARIO_SUPER], total: 1 })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo usuario' }))

    const dialogo = await screen.findByRole('dialog')
    const select = within(dialogo).getByLabelText('Rol')
    const textos = within(select)
      .getAllByRole('option')
      .map((opcion) => opcion.textContent)
    expect(textos).toEqual(['Superadmin', 'Administrador', 'Recepcionista', 'Mecánico'])
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
