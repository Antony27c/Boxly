import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TarjetaUsuario from '@/components/admin/TarjetaUsuario'

const USUARIO = {
  id: 3,
  nombre: 'Sofía',
  apellido: 'Paz',
  email: 'sofia@taller.com',
  rol: 'mecanico',
  activo: true,
}

function renderTarjeta(props = {}) {
  return render(
    <ul>
      <TarjetaUsuario
        usuario={USUARIO}
        onEditar={vi.fn()}
        onAlternarEstado={vi.fn()}
        onEliminar={vi.fn()}
        onRestablecer={vi.fn()}
        onCerrarSesiones={vi.fn()}
        {...props}
      />
    </ul>,
  )
}

describe('TarjetaUsuario', () => {
  it('muestra el nombre como titulo, el rol arriba, las iniciales, el correo y el estado', () => {
    const { container } = renderTarjeta()
    expect(screen.getByRole('heading', { name: 'Paz, Sofía' })).toBeInTheDocument()
    expect(screen.getByText('Mecánico')).toBeInTheDocument()
    expect(screen.getByText('SP')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('sofia@taller.com')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toHaveClass('text-ok')
    // Mecánico lleva el acento azul.
    expect(container.querySelector('.bg-serie-1')).not.toBeNull()
  })

  it('inactivo se marca en rojo y ofrece activar', () => {
    const onAlternarEstado = vi.fn()
    renderTarjeta({ usuario: { ...USUARIO, activo: false, rol: 'administrador' }, onAlternarEstado })
    expect(screen.getByText('Inactivo')).toHaveClass('text-danger')
    expect(screen.getByText('Administrador')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Activar' }))
    expect(onAlternarEstado).toHaveBeenCalledOnce()
  })

  it('las acciones del pie llaman a editar, desactivar y eliminar', () => {
    const onEditar = vi.fn()
    const onAlternarEstado = vi.fn()
    const onEliminar = vi.fn()
    renderTarjeta({ onEditar, onAlternarEstado, onEliminar })
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onEditar).toHaveBeenCalledOnce()
    expect(onAlternarEstado).toHaveBeenCalledOnce()
    expect(onEliminar).toHaveBeenCalledOnce()
  })

  it('el superadmin tiene acento grafito, distinto del dorado del administrador', () => {
    const { container, unmount } = renderTarjeta({
      usuario: { ...USUARIO, rol: 'superadmin' },
    })
    expect(screen.getByText('Superadmin')).toBeInTheDocument()
    expect(container.querySelector('.bg-graphite-500')).not.toBeNull()
    expect(container.querySelector('.bg-amber')).toBeNull()
    unmount()

    const { container: otro } = renderTarjeta({ usuario: { ...USUARIO, rol: 'administrador' } })
    expect(otro.querySelector('.bg-amber')).not.toBeNull()
    expect(otro.querySelector('.bg-graphite-500')).toBeNull()
  })

  it('con soloSuperadmin no hay acciones y se ve el chip', () => {
    renderTarjeta({ usuario: { ...USUARIO, rol: 'administrador' }, soloSuperadmin: true })
    const tarjeta = screen.getByRole('heading', { name: 'Paz, Sofía' }).closest('li')
    expect(within(tarjeta).getByText('Solo superadmin')).toBeInTheDocument()
    expect(within(tarjeta).queryByRole('button')).not.toBeInTheDocument()
  })

  it('el superadmin ve Restablecer contraseña y Cerrar sesiones, y llaman a sus callbacks', () => {
    const onRestablecer = vi.fn()
    const onCerrarSesiones = vi.fn()
    renderTarjeta({ esSuperadmin: true, onRestablecer, onCerrarSesiones })
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesiones' }))
    expect(onRestablecer).toHaveBeenCalledOnce()
    expect(onCerrarSesiones).toHaveBeenCalledOnce()
  })

  it('sin ser superadmin no aparecen las acciones de cuenta', () => {
    renderTarjeta()
    expect(screen.queryByRole('button', { name: 'Restablecer contraseña' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar sesiones' })).not.toBeInTheDocument()
  })

  it('la tarjeta propia no tiene Desactivar ni Cerrar sesiones, pero sí Restablecer', () => {
    renderTarjeta({ esPropio: true, esSuperadmin: true })
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar sesiones' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restablecer contraseña' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
  })
})
