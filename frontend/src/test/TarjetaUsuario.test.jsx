import { fireEvent, render, screen } from '@testing-library/react'
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
})
