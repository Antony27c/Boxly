import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TarjetaCliente from '@/components/clientes/TarjetaCliente'

const sesion = vi.hoisted(() => ({ rol: 'administrador' }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: { id: 1, rol: sesion.rol } }),
}))
vi.mock('@/services/taller', () => ({
  tallerService: { obtener: vi.fn().mockResolvedValue({ nombre: 'Taller Don Pepe' }) },
}))

const CLIENTE = {
  id: 5,
  nombre: 'Ana',
  apellido: 'García',
  dni: '30999888',
  telefono: '1144440000',
  email: 'ana@mail.com',
  tiene_cuenta: false,
}

function renderTarjeta(props = {}) {
  return render(
    <MemoryRouter>
      <ul>
        <TarjetaCliente
          cliente={CLIENTE}
          vehiculos={2}
          onInvitar={vi.fn()}
          onEditar={vi.fn()}
          onEliminar={vi.fn()}
          {...props}
        />
      </ul>
    </MemoryRouter>,
  )
}

describe('TarjetaCliente', () => {
  beforeEach(() => {
    sesion.rol = 'administrador'
  })

  it('destaca el nombre como titulo y muestra DNI, contacto, vehiculos y verificacion', () => {
    renderTarjeta()
    expect(screen.getByRole('heading', { name: 'García, Ana' })).toBeInTheDocument()
    expect(screen.getByText('DNI/CUIT 30999888')).toBeInTheDocument()
    expect(screen.getByText('1144440000')).toBeInTheDocument()
    expect(screen.getByText('ana@mail.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /2 vehículos/ })).toHaveAttribute('href', '/vehiculos?cliente=5')
    expect(screen.getByText('Verificación pendiente')).toBeInTheDocument()
  })

  it('las acciones del pie llaman a reenviar, editar y eliminar', () => {
    const onInvitar = vi.fn()
    const onEditar = vi.fn()
    const onEliminar = vi.fn()
    renderTarjeta({ onInvitar, onEditar, onEliminar })
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar correo de verificación' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onInvitar).toHaveBeenCalledOnce()
    expect(onEditar).toHaveBeenCalledOnce()
    expect(onEliminar).toHaveBeenCalledOnce()
  })

  it('con cuenta muestra el acceso al portal y no ofrece reenviar el correo', () => {
    renderTarjeta({ cliente: { ...CLIENTE, tiene_cuenta: true }, vehiculos: 1 })
    expect(screen.getByText('Con acceso al portal')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /1 vehículo$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reenviar/ })).not.toBeInTheDocument()
  })

  it('sin correo no muestra chip de correo ni de verificacion', () => {
    renderTarjeta({ cliente: { ...CLIENTE, email: '', dni: '' }, vehiculos: 0 })
    expect(screen.getByText('Cliente')).toBeInTheDocument()
    expect(screen.queryByText('Verificación pendiente')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /0 vehículos/ })).toBeInTheDocument()
  })

  it('ofrece WhatsApp con un saludo del taller', async () => {
    renderTarjeta()
    const link = await screen.findByRole('link', { name: /WhatsApp/ })
    await waitFor(() => expect(link.getAttribute('href')).toContain(encodeURIComponent('Taller Don Pepe')))
    expect(link).toHaveAttribute(
      'href',
      `https://wa.me/5491144440000?text=${encodeURIComponent('¡Hola, Ana! Te escribimos de Taller Don Pepe.')}`,
    )
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('sin teléfono el WhatsApp queda deshabilitado y explica por qué', () => {
    renderTarjeta({ cliente: { ...CLIENTE, telefono: '' } })
    const boton = screen.getByRole('button', { name: 'WhatsApp' })
    expect(boton).toBeDisabled()
    expect(boton).toHaveAccessibleDescription('El cliente no tiene un teléfono cargado.')
  })

  it('el mecánico no ve el WhatsApp', () => {
    sesion.rol = 'mecanico'
    renderTarjeta()
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /WhatsApp/ })).not.toBeInTheDocument()
  })
})
