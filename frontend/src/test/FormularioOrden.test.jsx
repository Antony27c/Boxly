import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FormularioOrden from '@/components/ordenes/FormularioOrden'

const sesion = vi.hoisted(() => ({
  usuario: { id: 1, nombre: 'Ana', apellido: 'Díaz', rol: 'recepcion' },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: sesion.usuario, autenticado: true }),
}))

function montar() {
  return render(
    <FormularioOrden clientes={[]} vehiculos={[]} onGuardar={vi.fn()} onCancelar={vi.fn()} />,
  )
}

describe('FormularioOrden — presupuesto estimado según el rol', () => {
  it('recepción ve el campo Presupuesto estimado', () => {
    sesion.usuario = { id: 1, nombre: 'Ana', apellido: 'Díaz', rol: 'recepcion' }
    montar()

    expect(screen.getByLabelText('Presupuesto estimado')).toBeInTheDocument()
  })

  it('administración ve el campo Presupuesto estimado', () => {
    sesion.usuario = { id: 2, nombre: 'Jefe', apellido: 'Propio', rol: 'administrador' }
    montar()

    expect(screen.getByLabelText('Presupuesto estimado')).toBeInTheDocument()
  })

  it('el mecánico no ve el campo Presupuesto estimado', () => {
    sesion.usuario = { id: 9, nombre: 'Mario', apellido: 'Sosa', rol: 'mecanico' }
    montar()

    expect(screen.queryByLabelText('Presupuesto estimado')).not.toBeInTheDocument()
    // El resto del formulario sigue disponible.
    expect(screen.getByLabelText('Trabajo a realizar')).toBeInTheDocument()
  })
})
