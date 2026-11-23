import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConfigTaller from '@/components/superadmin/ConfigTaller'
import { ToastProvider } from '@/context/ToastContext'

const taller = vi.hoisted(() => ({
  obtener: vi.fn(),
  actualizar: vi.fn(),
}))

vi.mock('@/services/taller', () => ({ tallerService: taller }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Admin', apellido: 'Box', rol: 'superadmin' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

const TALLER = {
  nombre: 'Taller El Rayo',
  razon_social: 'El Rayo SRL',
  cuit: '30-71234567-8',
  direccion: 'Av. San Martín 1234',
  telefono: '11-5555-1234',
  email: 'contacto@elrayo.com',
  sitio_web: 'https://elrayo.com',
  hora_apertura: '08:00',
  hora_cierre: '18:00',
  mensaje_portal: 'Traé tu vehículo para una revisión gratis.',
  pie_ticket: 'Gracias por tu visita.',
  dias_garantia: 90,
  actualizado_en: '2026-11-20T15:30:00Z',
}

function montar() {
  return render(
    <ToastProvider>
      <ConfigTaller />
    </ToastProvider>,
  )
}

describe('ConfigTaller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    taller.obtener.mockResolvedValue(TALLER)
    taller.actualizar.mockResolvedValue(TALLER)
  })

  it('carga los datos del taller en el formulario y avisa la última actualización', async () => {
    montar()

    expect(await screen.findByLabelText('Nombre')).toHaveValue('Taller El Rayo')
    expect(screen.getByLabelText('Razón social')).toHaveValue('El Rayo SRL')
    expect(screen.getByLabelText('CUIT')).toHaveValue('30-71234567-8')
    expect(screen.getByLabelText('Dirección')).toHaveValue('Av. San Martín 1234')
    expect(screen.getByLabelText('Teléfono')).toHaveValue('11-5555-1234')
    expect(screen.getByLabelText('Email')).toHaveValue('contacto@elrayo.com')
    expect(screen.getByLabelText('Horario de apertura')).toHaveValue('08:00')
    expect(screen.getByLabelText('Horario de cierre')).toHaveValue('18:00')
    expect(screen.getByLabelText('Días de garantía')).toHaveValue(90)
    expect(screen.getByLabelText('Mensaje para el portal del cliente')).toHaveValue(
      'Traé tu vehículo para una revisión gratis.',
    )
    expect(screen.getByLabelText('Pie del ticket de cobro')).toHaveValue('Gracias por tu visita.')

    expect(screen.getByText(/Última actualización:/)).toBeInTheDocument()
    expect(screen.getByText(`${TALLER.mensaje_portal.length}/500`)).toBeInTheDocument()
    expect(screen.getByText(`${TALLER.pie_ticket.length}/300`)).toBeInTheDocument()

    // Sin cambios no hay nada que guardar.
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    expect(taller.obtener).toHaveBeenCalled()
  })

  it('valida el CUIT, el email y el horario antes de llamar al servidor', async () => {
    montar()

    fireEvent.change(await screen.findByLabelText('CUIT'), { target: { value: '123' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'no-es-mail' } })
    fireEvent.change(screen.getByLabelText('Horario de cierre'), { target: { value: '07:00' } })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('El CUIT debe tener 11 dígitos.')).toBeInTheDocument()
    expect(screen.getByText('El correo no tiene un formato válido.')).toBeInTheDocument()
    expect(
      screen.getByText('El cierre tiene que ser después de la apertura.'),
    ).toBeInTheDocument()
    expect(taller.actualizar).not.toHaveBeenCalled()
  })

  it('guarda solo los campos cambiados y avisa con un toast', async () => {
    montar()

    fireEvent.change(await screen.findByLabelText('Nombre'), {
      target: { value: 'Taller Norte' },
    })
    expect(screen.getByText('Tienes cambios sin guardar.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(taller.actualizar).toHaveBeenCalledTimes(1))
    expect(taller.actualizar).toHaveBeenCalledWith({ nombre: 'Taller Norte' }, 'tok')
    expect(await screen.findByText('Datos del taller guardados.')).toBeInTheDocument()

    // Después de guardar no quedan cambios pendientes.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled(),
    )
    expect(screen.getByLabelText('Nombre')).toHaveValue('Taller El Rayo')
  })

  it('manda null al limpiar un campo opcional', async () => {
    montar()

    fireEvent.change(await screen.findByLabelText('Razón social'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(taller.actualizar).toHaveBeenCalledTimes(1))
    expect(taller.actualizar).toHaveBeenCalledWith({ razon_social: null }, 'tok')
  })

  it('muestra el error del servidor sin perder lo cargado', async () => {
    taller.actualizar.mockRejectedValue(
      Object.assign(new Error('El CUIT ingresado no es válido.'), { status: 422 }),
    )
    montar()

    fireEvent.change(await screen.findByLabelText('Nombre'), {
      target: { value: 'Taller Norte' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('El CUIT ingresado no es válido.')).toBeInTheDocument()
    // El formulario sigue con lo que escribió la persona.
    expect(screen.getByLabelText('Nombre')).toHaveValue('Taller Norte')
  })
})
