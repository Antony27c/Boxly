import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SuscripcionTaller from '@/components/plataforma/SuscripcionTaller'
import TarjetaTaller from '@/components/plataforma/TarjetaTaller'
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

const PLAN_ACTUAL = {
  codigo: 'pro',
  nombre: 'Pro',
  precio_mensual: 30000,
  max_personal: 10,
  activo: true,
}

const PLANES = [
  { codigo: 'basico', nombre: 'Básico', precio_mensual: 15000, max_personal: 3, activo: true },
  PLAN_ACTUAL,
  { codigo: 'profesional', nombre: 'Profesional', precio_mensual: 50000, max_personal: null, activo: true },
]

const SUSCRIPCION = {
  plan: PLAN_ACTUAL,
  vence_en: '2026-12-15',
  estado: 'al_dia',
  dias_para_vencer: 22,
  cobro_automatico: true,
  personal_activo: 4,
  max_personal: 10,
  proximo_monto: 30000,
  pagos: [
    {
      id: 9,
      monto: 30000,
      periodo_desde: '2026-11-15',
      periodo_hasta: '2026-12-14',
      medio: 'manual',
      estado: 'aprobado',
      referencia: 'TF-123',
      creado_en: '2026-11-15T12:00:00Z',
      registrado_por: 'Admin Norte',
    },
    {
      id: 8,
      monto: 0,
      periodo_desde: '2026-10-15',
      periodo_hasta: '2026-11-14',
      medio: 'mercadopago',
      estado: 'aprobado',
      referencia: null,
      creado_en: '2026-10-15T12:00:00Z',
      registrado_por: null,
    },
  ],
}

function montar(props = {}) {
  return render(
    <ToastProvider>
      <SuscripcionTaller tallerId={2} {...props} />
    </ToastProvider>,
  )
}

async function esperarSuscripcion() {
  return screen.findByText('Historial de pagos')
}

describe('SuscripcionTaller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    suscripciones.obtenerSuscripcion.mockResolvedValue(SUSCRIPCION)
    suscripciones.listarPlanes.mockResolvedValue(PLANES)
    suscripciones.cambiarPlan.mockResolvedValue(SUSCRIPCION)
    suscripciones.registrarPago.mockResolvedValue({ id: 10 })
    suscripciones.ajustarVencimiento.mockResolvedValue(SUSCRIPCION)
  })

  it('muestra plan, estado, vencimiento, cobro automático, personal y pagos', async () => {
    montar()
    await esperarSuscripcion()

    expect(suscripciones.obtenerSuscripcion).toHaveBeenCalledWith(2, 'tok')
    expect(suscripciones.listarPlanes).toHaveBeenCalledWith('tok')

    expect(screen.getByText(/^Pro · /)).toBeInTheDocument()
    expect(screen.getByText('Al día')).toBeInTheDocument()
    expect(screen.getByText(/15\/12\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/Vence en 22 días/)).toBeInTheDocument()
    expect(screen.getByText('Sí')).toBeInTheDocument() // cobro automático
    expect(screen.getByText('4 de 10')).toBeInTheDocument() // personal vs límite
    expect(screen.getByText('Próximo cobro')).toBeInTheDocument()

    // Historial: fecha, período, monto, medio, referencia y registrado por.
    expect(screen.getByText('TF-123', { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/Admin Norte/)).toBeInTheDocument()
    expect(screen.getByText(/Automático/)).toBeInTheDocument()
    expect(screen.getByText(/Mercado Pago/)).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Registrar pago o cortesía' }),
    ).toBeInTheDocument()
  })

  it('muestra el estado y el detalle cuando la suscripción no está al día', async () => {
    suscripciones.obtenerSuscripcion.mockResolvedValue({
      ...SUSCRIPCION,
      estado: 'solo_lectura',
      dias_para_vencer: -12,
    })
    montar()
    await esperarSuscripcion()

    expect(screen.getByText('Solo lectura')).toBeInTheDocument()
    expect(screen.getByText(/solo pueden leer/)).toBeInTheDocument()
    expect(screen.getByText(/Venció hace 12 días/)).toBeInTheDocument()
  })

  it('cambiar plan llama al servicio con el código elegido', async () => {
    const onCambio = vi.fn()
    montar({ onCambio })
    await esperarSuscripcion()

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar plan' }))
    const dialogo = await screen.findByRole('dialog')

    fireEvent.change(within(dialogo).getByLabelText('Plan nuevo'), {
      target: { value: 'profesional' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cambiar plan' }))

    await waitFor(() =>
      expect(suscripciones.cambiarPlan).toHaveBeenCalledWith(2, 'profesional', 'tok'),
    )
    expect(await screen.findByText('Plan actualizado.')).toBeInTheDocument()
    expect(suscripciones.obtenerSuscripcion).toHaveBeenCalledTimes(2) // recarga
    expect(onCambio).toHaveBeenCalled()
  })

  it('si el servidor rechaza el plan (409 por límite) muestra el mensaje', async () => {
    suscripciones.cambiarPlan.mockRejectedValue(
      new Error('Tu personal activo supera el límite de ese plan'),
    )
    montar()
    await esperarSuscripcion()

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar plan' }))
    const dialogo = await screen.findByRole('dialog')

    fireEvent.change(within(dialogo).getByLabelText('Plan nuevo'), {
      target: { value: 'basico' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cambiar plan' }))

    expect(
      await within(dialogo).findByText('Tu personal activo supera el límite de ese plan'),
    ).toBeInTheDocument()
  })

  it('registrar pago sugiere precio × meses y lo manda al servicio', async () => {
    montar()
    await esperarSuscripcion()

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago o cortesía' }))
    const dialogo = await screen.findByRole('dialog')

    const monto = within(dialogo).getByLabelText('Monto')
    expect(monto).toHaveValue(30000) // 30.000 × 1 mes

    fireEvent.change(within(dialogo).getByLabelText('Meses'), { target: { value: '3' } })
    expect(monto).toHaveValue(90000) // se recalcula la sugerencia

    fireEvent.change(within(dialogo).getByLabelText('Referencia'), {
      target: { value: 'Comprobante 778' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }))

    await waitFor(() =>
      expect(suscripciones.registrarPago).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ monto: 90000, meses: 3, referencia: 'Comprobante 778' }),
        'tok',
      ),
    )
    expect(await screen.findByText('Pago registrado.')).toBeInTheDocument()
  })

  it('acepta monto 0 como cortesía', async () => {
    montar()
    await esperarSuscripcion()

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago o cortesía' }))
    const dialogo = await screen.findByRole('dialog')

    fireEvent.change(within(dialogo).getByLabelText('Monto'), { target: { value: '0' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }))

    await waitFor(() =>
      expect(suscripciones.registrarPago).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ monto: 0, meses: 1 }),
        'tok',
      ),
    )
  })

  it('ajustar vencimiento pide la fecha y confirma antes de llamar', async () => {
    montar()
    await esperarSuscripcion()

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar vencimiento' }))
    const formulario = await screen.findByRole('dialog', { name: 'Ajustar vencimiento' })

    const fecha = within(formulario).getByLabelText('Vence el')
    expect(fecha).toHaveValue('2026-12-15') // precargada con la actual

    fireEvent.change(fecha, { target: { value: '2027-01-15' } })
    fireEvent.click(within(formulario).getByRole('button', { name: 'Continuar' }))

    // Recién con la confirmación se llama al servicio, con el antes y el después.
    const confirmacion = await screen.findByRole('dialog', { name: 'Confirmar vencimiento' })
    expect(confirmacion).toHaveTextContent('15/12/2026')
    expect(confirmacion).toHaveTextContent('15/01/2027')
    expect(suscripciones.ajustarVencimiento).not.toHaveBeenCalled()

    fireEvent.click(
      within(confirmacion).getByRole('button', { name: 'Ajustar vencimiento' }),
    )

    await waitFor(() =>
      expect(suscripciones.ajustarVencimiento).toHaveBeenCalledWith(
        2,
        '2027-01-15',
        'tok',
      ),
    )
    expect(await screen.findByText('Vencimiento ajustado.')).toBeInTheDocument()
  })

  it('si la suscripción falla muestra la alerta y Reintentar vuelve a pedir', async () => {
    suscripciones.obtenerSuscripcion.mockRejectedValueOnce(new Error('No se pudo cargar'))
    montar()

    expect(await screen.findByText('No se pudo cargar')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await esperarSuscripcion()
    expect(suscripciones.obtenerSuscripcion).toHaveBeenCalledTimes(2)
  })
})

describe('TarjetaTaller: chips de plan y suscripción', () => {
  const BASE = {
    id: 2,
    nombre: 'Taller Norte',
    estado: 'activo',
    creado_en: '2026-02-01T10:00:00Z',
    suspendido_en: null,
    personal: 3,
    clientes: 25,
    ordenes_mes: 8,
    ultimo_uso: '2026-11-20T10:00:00Z',
    soporte_vigente_hasta: null,
    terminos_aceptados_en: '2026-11-01T10:00:00Z',
  }

  function tarjetaDe(taller) {
    return render(
      <MemoryRouter>
        <ul>
          <li>
            <TarjetaTaller taller={taller} />
          </li>
        </ul>
      </MemoryRouter>,
    )
  }

  it('muestra el chip de plan y el de suscripción cuando no está al día', () => {
    tarjetaDe({ ...BASE, plan_codigo: 'pro', suscripcion_estado: 'gracia' })

    expect(screen.getByText('Plan pro')).toBeInTheDocument()
    expect(screen.getByText('En gracia')).toBeInTheDocument()
  })

  it('al día muestra el plan pero no el chip de suscripción', () => {
    tarjetaDe({ ...BASE, plan_codigo: 'basico', suscripcion_estado: 'al_dia' })

    expect(screen.getByText('Plan basico')).toBeInTheDocument()
    expect(screen.queryByText('Al día')).not.toBeInTheDocument()
  })

  it('sin datos de suscripción no muestra chips de plan ni de estado', () => {
    tarjetaDe(BASE)

    expect(screen.queryByText(/Plan /)).not.toBeInTheDocument()
    expect(screen.queryByText('En gracia')).not.toBeInTheDocument()
    expect(screen.queryByText('Suspendida por falta de pago')).not.toBeInTheDocument()
  })
})
