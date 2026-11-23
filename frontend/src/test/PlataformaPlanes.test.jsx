import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlataformaPlanes from '@/pages/PlataformaPlanes'
import { ToastProvider } from '@/context/ToastContext'

const suscripciones = vi.hoisted(() => ({
  listarPlanes: vi.fn(),
  actualizarPlan: vi.fn(),
  obtenerSuscripcion: vi.fn(),
  cambiarPlan: vi.fn(),
  registrarPago: vi.fn(),
  ajustarVencimiento: vi.fn(),
}))

vi.mock('@/services/suscripcionesPlataforma', () => ({
  suscripcionesPlataformaService: suscripciones,
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Root', apellido: 'Admin', rol: 'superadmin' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

const PLANES = [
  { codigo: 'basico', nombre: 'Básico', precio_mensual: 15000, max_personal: 3, activo: true },
  { codigo: 'pro', nombre: 'Pro', precio_mensual: 30000, max_personal: 10, activo: true },
  { codigo: 'taller_plus', nombre: 'Taller+', precio_mensual: 50000, max_personal: null, activo: false },
]

function tarjeta(nombre) {
  return screen.getByText(nombre, { selector: 'h3' }).closest('li')
}

function montar() {
  return render(
    <ToastProvider>
      <PlataformaPlanes />
    </ToastProvider>,
  )
}

describe('PlataformaPlanes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    suscripciones.listarPlanes.mockResolvedValue(PLANES)
    suscripciones.actualizarPlan.mockResolvedValue(PLANES[1])
  })

  it('lista los planes con precio, límite de personal y estado', async () => {
    montar()

    expect(await screen.findByText('Básico')).toBeInTheDocument()
    expect(suscripciones.listarPlanes).toHaveBeenCalledWith('tok')

    const basico = tarjeta('Básico')
    expect(within(basico).getByText(/15\.000/)).toBeInTheDocument()
    expect(within(basico).getByText('3')).toBeInTheDocument()
    expect(within(basico).getByText('Activo')).toBeInTheDocument()

    const plus = tarjeta('Taller+')
    expect(within(plus).getByText(/50\.000/)).toBeInTheDocument()
    expect(within(plus).getByText('Sin límite')).toBeInTheDocument()
    expect(within(plus).getByText('Inactivo')).toBeInTheDocument()

    // El aviso de que el precio nuevo rige desde el próximo período.
    expect(
      screen.getByText(/El precio nuevo rige desde el próximo período/),
    ).toBeInTheDocument()
  })

  it('edita un plan y manda todos los campos al servicio', async () => {
    montar()
    await screen.findByText('Básico')

    fireEvent.click(within(tarjeta('Pro')).getByRole('button', { name: 'Editar plan' }))

    const dialogo = await screen.findByRole('dialog')
    fireEvent.change(within(dialogo).getByLabelText('Precio mensual'), {
      target: { value: '35000' },
    })
    fireEvent.change(within(dialogo).getByLabelText('Personal máximo'), {
      target: { value: '' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar plan' }))

    await waitFor(() =>
      expect(suscripciones.actualizarPlan).toHaveBeenCalledWith(
        'pro',
        { nombre: 'Pro', precio_mensual: 35000, max_personal: null, activo: true },
        'tok',
      ),
    )
    expect(await screen.findByText('Plan actualizado.')).toBeInTheDocument()
    expect(suscripciones.listarPlanes).toHaveBeenCalledTimes(2) // recarga
  })

  it('valida el formulario sin llamar al servicio', async () => {
    montar()
    await screen.findByText('Básico')

    fireEvent.click(within(tarjeta('Pro')).getByRole('button', { name: 'Editar plan' }))

    const dialogo = await screen.findByRole('dialog')
    fireEvent.change(within(dialogo).getByLabelText('Precio mensual'), {
      target: { value: '-5' },
    })
    fireEvent.change(within(dialogo).getByLabelText('Personal máximo'), {
      target: { value: '2.5' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar plan' }))

    expect(await within(dialogo).findByText(/precio válido/)).toBeInTheDocument()
    expect(await within(dialogo).findByText(/entero de 1 o más/)).toBeInTheDocument()
    expect(suscripciones.actualizarPlan).not.toHaveBeenCalled()
  })

  it('si el servidor falla al editar muestra el error dentro del modal', async () => {
    suscripciones.actualizarPlan.mockRejectedValue(new Error('No se pudo guardar el plan.'))
    montar()
    await screen.findByText('Básico')

    fireEvent.click(within(tarjeta('Pro')).getByRole('button', { name: 'Editar plan' }))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar plan' }))

    expect(await within(dialogo).findByText('No se pudo guardar el plan.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument() // el modal sigue abierto
  })

  it('si la lista falla muestra la alerta y Reintentar vuelve a pedir', async () => {
    suscripciones.listarPlanes.mockRejectedValueOnce(new Error('Sin conexión'))
    montar()

    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Básico')).toBeInTheDocument()
    expect(suscripciones.listarPlanes).toHaveBeenCalledTimes(2)
  })
})
