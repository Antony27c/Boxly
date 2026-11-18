import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import TarjetaVehiculo from '@/components/vehiculos/TarjetaVehiculo'

const VEHICULO = { id: 7, patente: 'AB123CD', marca: 'Toyota', modelo: 'Corolla', anio: 2019, color: 'Gris' }
const CLIENTE = { nombre: 'Juan', apellido: 'Perez' }

function renderTarjeta(props = {}) {
  return render(
    <MemoryRouter>
      <ul>
        <TarjetaVehiculo vehiculo={VEHICULO} cliente={CLIENTE} onEditar={vi.fn()} onEliminar={vi.fn()} {...props} />
      </ul>
    </MemoryRouter>,
  )
}

describe('TarjetaVehiculo', () => {
  it('destaca el modelo como titulo y muestra marca, patente, año, color y cliente', () => {
    renderTarjeta()
    expect(screen.getByRole('heading', { name: 'Corolla' })).toBeInTheDocument()
    expect(screen.getByText('Toyota')).toBeInTheDocument()
    expect(screen.getByText('AB123CD')).toBeInTheDocument()
    expect(screen.getByText('2019')).toBeInTheDocument()
    expect(screen.getByText('Gris')).toBeInTheDocument()
    expect(screen.getByText('Perez, Juan')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver ficha/i })).toHaveAttribute('href', '/vehiculos/7')
  })

  it('llama a editar y eliminar', () => {
    const onEditar = vi.fn()
    const onEliminar = vi.fn()
    renderTarjeta({ onEditar, onEliminar })
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onEditar).toHaveBeenCalledOnce()
    expect(onEliminar).toHaveBeenCalledOnce()
  })

  it('sin año ni color no deja chips vacios y sin cliente muestra un guion', () => {
    renderTarjeta({ vehiculo: { ...VEHICULO, anio: null, color: '' }, cliente: undefined })
    expect(screen.queryByText('2019')).not.toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
