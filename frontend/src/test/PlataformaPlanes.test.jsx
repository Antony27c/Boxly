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
  cambiarAcceso: vi.fn(),
  listarAdicionales: vi.fn(),
  activarAdicional: vi.fn(),
  desactivarAdicional: vi.fn(),
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

// Datos como los devuelve la API (docs/Oferta.md): códigos esencial/pro/
// profesional y la lista de funciones de cada plan. Nada de esto se
// hardcodea en la pantalla: todo sale del fixture.
const PLANES = [
  {
    codigo: 'esencial',
    nombre: 'Esencial',
    precio_mensual: 35000,
    max_personal: 3,
    activo: true,
    funciones: ['gestion', 'whatsapp_manual'],
  },
  {
    codigo: 'pro',
    nombre: 'Pro',
    precio_mensual: 79000,
    max_personal: 10,
    cupo_facturas_arca: 30,
    descuento_anual_pct: 15,
    activo: true,
    funciones: ['gestion', 'whatsapp_manual', 'whatsapp_automatico', 'telegram_automatico', 'arca'],
  },
  {
    codigo: 'profesional',
    nombre: 'Profesional',
    precio_mensual: 169000,
    max_personal: null,
    activo: false,
    funciones: [
      'gestion',
      'whatsapp_manual',
      'whatsapp_automatico',
      'arca',
      'recordatorios_service',
      'marca_propia',
    ],
  },
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

  it('lista los planes con precio, límite de personal, estado y funciones', async () => {
    montar()

    expect(await screen.findByText('Esencial')).toBeInTheDocument()
    expect(suscripciones.listarPlanes).toHaveBeenCalledWith('tok')

    const esencial = tarjeta('Esencial')
    expect(within(esencial).getByText(/35\.000/)).toBeInTheDocument()
    expect(within(esencial).getByText('3')).toBeInTheDocument()
    expect(within(esencial).getByText('Activo')).toBeInTheDocument()
    // Las funciones del plan se muestran como chips legibles.
    expect(within(esencial).getByText('Gestión del taller')).toBeInTheDocument()
    expect(within(esencial).getByText('Mensajes de WhatsApp armados (envío manual)')).toBeInTheDocument()

    const profesional = tarjeta('Profesional')
    expect(within(profesional).getByText(/169\.000/)).toBeInTheDocument()
    expect(within(profesional).getByText('Sin límite')).toBeInTheDocument()
    expect(within(profesional).getByText('Inactivo')).toBeInTheDocument()
    expect(within(profesional).getByText('Personalización de marca')).toBeInTheDocument()
    expect(within(profesional).getByText('Sin definir')).toBeInTheDocument()
    expect(within(profesional).getByText('Sin pago anual')).toBeInTheDocument()
    expect(within(tarjeta('Pro')).getByText('15%')).toBeInTheDocument()
    expect(within(tarjeta('Pro')).getByText('30')).toBeInTheDocument()
    expect(within(tarjeta('Pro')).getByText('Avisos automáticos por Telegram')).toBeInTheDocument()

    // El aviso de que el precio nuevo rige desde el próximo período.
    expect(
      screen.getByText(/El precio nuevo rige desde el próximo período/),
    ).toBeInTheDocument()
  })

  it('edita un plan y manda todos los campos, con las funciones en orden del contrato', async () => {
    montar()
    await screen.findByText('Pro')

    fireEvent.click(within(tarjeta('Pro')).getByRole('button', { name: 'Editar plan' }))

    const dialogo = await screen.findByRole('dialog')
    fireEvent.change(within(dialogo).getByLabelText('Precio mensual'), {
      target: { value: '89000' },
    })
    fireEvent.change(within(dialogo).getByLabelText('Personal máximo'), {
      target: { value: '' },
    })
    expect(within(dialogo).getByLabelText('Cupo de facturas ARCA por mes')).toHaveValue(30)
    fireEvent.change(within(dialogo).getByLabelText('Cupo de facturas ARCA por mes'), {
      target: { value: '' },
    })
    expect(within(dialogo).getByLabelText('Descuento por pago anual (%)')).toHaveValue(15)
    fireEvent.change(within(dialogo).getByLabelText('Descuento por pago anual (%)'), {
      target: { value: '20' },
    })

    // Pro venía con gestion, whatsapp_manual, whatsapp_automatico y arca:
    // se destilda ARCA y se tildan recordatorios y marca propia (en ese
    // orden de clicks, al revés del orden del contrato).
    fireEvent.click(within(dialogo).getByLabelText('Facturación electrónica ARCA'))
    fireEvent.click(within(dialogo).getByLabelText('Personalización de marca'))
    fireEvent.click(within(dialogo).getByLabelText('Recordatorios automáticos de service'))

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar plan' }))

    await waitFor(() =>
      expect(suscripciones.actualizarPlan).toHaveBeenCalledWith(
        'pro',
        {
          nombre: 'Pro',
          precio_mensual: 89000,
          max_personal: null,
          // Vacío = todavía sin definir.
          cupo_facturas_arca: null,
          descuento_anual_pct: 20,
          activo: true,
          // Orden canónico del contrato, no el orden en que se tildó.
          funciones: [
            'gestion',
            'whatsapp_manual',
            'whatsapp_automatico',
            'telegram_automatico',
            'recordatorios_service',
            'marca_propia',
          ],
        },
        'tok',
      ),
    )
    expect(await screen.findByText('Plan actualizado.')).toBeInTheDocument()
    expect(suscripciones.listarPlanes).toHaveBeenCalledTimes(2) // recarga
  })

  it('los checkboxes de funciones reflejan lo que tiene el plan', async () => {
    montar()
    await screen.findByText('Esencial')

    fireEvent.click(within(tarjeta('Esencial')).getByRole('button', { name: 'Editar plan' }))

    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByLabelText('Gestión del taller')).toBeChecked()
    expect(within(dialogo).getByLabelText('Mensajes de WhatsApp armados (envío manual)')).toBeChecked()
    expect(within(dialogo).getByLabelText('Avisos automáticos por WhatsApp')).not.toBeChecked()
    expect(within(dialogo).getByLabelText('Avisos automáticos por Telegram')).not.toBeChecked()
    // Sin cupo cargado, el campo arranca vacío.
    expect(within(dialogo).getByLabelText('Cupo de facturas ARCA por mes')).toHaveValue(null)
    expect(within(dialogo).getByLabelText('Descuento por pago anual (%)')).toHaveValue(null)
    expect(within(dialogo).getByLabelText('Facturación electrónica ARCA')).not.toBeChecked()
  })

  it('valida el formulario sin llamar al servicio', async () => {
    montar()
    await screen.findByText('Pro')

    fireEvent.click(within(tarjeta('Pro')).getByRole('button', { name: 'Editar plan' }))

    const dialogo = await screen.findByRole('dialog')
    fireEvent.change(within(dialogo).getByLabelText('Precio mensual'), {
      target: { value: '-5' },
    })
    fireEvent.change(within(dialogo).getByLabelText('Personal máximo'), {
      target: { value: '2.5' },
    })
    fireEvent.change(within(dialogo).getByLabelText('Cupo de facturas ARCA por mes'), {
      target: { value: '12.5' },
    })
    fireEvent.change(within(dialogo).getByLabelText('Descuento por pago anual (%)'), {
      target: { value: '150' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar plan' }))

    expect(await within(dialogo).findByText(/Escribí el monto con coma/)).toBeInTheDocument()
    expect(within(dialogo).getByText(/El cupo tiene que ser un número entero/)).toBeInTheDocument()
    expect(within(dialogo).getByText(/El descuento tiene que ser un número entero entre 0 y 100/)).toBeInTheDocument()
    expect(await within(dialogo).findByText(/entero de 1 o más/)).toBeInTheDocument()
    expect(suscripciones.actualizarPlan).not.toHaveBeenCalled()
  })

  it('si el servidor falla al editar muestra el error dentro del modal', async () => {
    suscripciones.actualizarPlan.mockRejectedValue(new Error('No se pudo guardar el plan.'))
    montar()
    await screen.findByText('Pro')

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

    expect(await screen.findByText('Esencial')).toBeInTheDocument()
    expect(suscripciones.listarPlanes).toHaveBeenCalledTimes(2)
  })
})
