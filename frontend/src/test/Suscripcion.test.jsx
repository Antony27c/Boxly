import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Suscripcion from '@/pages/Suscripcion'
import { ToastProvider } from '@/context/ToastContext'
import useSuscripcion, { reiniciarSuscripcion } from '@/hooks/useSuscripcion'
import { ApiError, api } from '@/lib/api'

const servicio = vi.hoisted(() => ({
  obtener: vi.fn(),
  planes: vi.fn(),
  cambiarPlan: vi.fn(),
  pagos: vi.fn(),
  activarCobro: vi.fn(),
  cancelarCobro: vi.fn(),
}))
vi.mock('@/services/suscripcion', async (importOriginal) => ({
  ...(await importOriginal()),
  suscripcionService: servicio,
}))

const auth = vi.hoisted(() => ({
  value: {
    token: 'tok',
    usuario: { id: 5, nombre: 'Ana', apellido: 'Pérez', email: 'ana@taller.com', rol: 'administrador' },
    autenticado: true,
    cargandoSesion: false,
    logout: vi.fn(),
  },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => auth.value,
  AuthProvider: ({ children }) => children,
}))

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', fetchMock)

function respuestaJson(datos, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    text: async () => JSON.stringify(datos),
  }
}

const PLANES = [
  {
    codigo: 'esencial',
    nombre: 'Esencial',
    precio_mensual: 15000,
    max_personal: 3,
    activo: true,
    funciones: ['gestion', 'whatsapp_manual'],
  },
  {
    codigo: 'pro',
    nombre: 'Pro',
    precio_mensual: 30000,
    max_personal: 10,
    activo: true,
    funciones: ['gestion', 'whatsapp_manual', 'whatsapp_automatico', 'arca'],
  },
  {
    codigo: 'profesional',
    nombre: 'Profesional',
    precio_mensual: 50000,
    max_personal: null,
    activo: true,
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

function suscripcionCon(estado, extra = {}) {
  return {
    plan: PLANES[0],
    vence_en: '2026-12-23',
    estado,
    dias_para_vencer: estado === 'al_dia' ? 30 : -3,
    cobro_automatico: false,
    personal_activo: 2,
    max_personal: 3,
    proximo_monto: 15000,
    ...extra,
  }
}

const PAGO = {
  id: 1,
  creado_en: '2026-11-20T10:00:00',
  monto: 15000,
  periodo_desde: '2026-11-20',
  periodo_hasta: '2026-12-19',
  medio: 'mercadopago',
  estado: 'aprobado',
  referencia: null,
  registrado_por: 'Mercado Pago',
}

function montar() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Suscripcion />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('Suscripcion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reiniciarSuscripcion()
    fetchMock.mockResolvedValue(respuestaJson({}, { headers: { 'x-total-count': '0' } }))
    servicio.planes.mockResolvedValue(PLANES)
    servicio.pagos.mockResolvedValue([])
    servicio.obtener.mockResolvedValue(suscripcionCon('al_dia'))
    servicio.cambiarPlan.mockResolvedValue(suscripcionCon('pro'))
    servicio.activarCobro.mockResolvedValue({ init_point: '#mp-init' })
    servicio.cancelarCobro.mockResolvedValue(suscripcionCon('al_dia'))
  })

  it('al día muestra el estado grande, el plan actual y los demás planes', async () => {
    montar()

    expect(await screen.findByText('Al día hasta el 23/12')).toBeInTheDocument()
    expect(screen.getByText('Al día')).toBeInTheDocument()
    expect(await screen.findByText('Esencial')).toBeInTheDocument()
    expect(screen.getAllByText('Plan actual')).toHaveLength(1)
    // Solo los planes que no son el actual ofrecen el cambio.
    expect(screen.getAllByRole('button', { name: 'Pasar a este plan' })).toHaveLength(2)
    expect(screen.getByText(/Personal sin límite/)).toBeInTheDocument()
  })

  it('muestra las funciones del plan actual y las de cada plan, con "Próximamente"', async () => {
    servicio.obtener.mockResolvedValue(
      suscripcionCon('al_dia', { funciones_efectivas: ['gestion', 'whatsapp_manual', 'arca'] }),
    )
    montar()

    const incluye = (await screen.findByText('Incluye tu plan')).parentElement
    // El adicional ARCA entra por funciones_efectivas, aunque el plan no lo traiga.
    expect(within(incluye).getByText('Facturación electrónica ARCA')).toBeInTheDocument()
    expect(within(incluye).getAllByText('Próximamente')).toHaveLength(1)

    const tarjeta = (await screen.findByRole('heading', { level: 3, name: 'Profesional' })).closest(
      'div.flex-col',
    )
    expect(within(tarjeta).getByText('Personalización de marca')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Gestión del taller')).toBeInTheDocument()
    expect(within(tarjeta).getAllByText('Próximamente')).toHaveLength(4)
  })

  it('en gracia muestra la frase con el límite para pagar sin cortes', async () => {
    servicio.obtener.mockResolvedValue(
      suscripcionCon('gracia', { vence_en: '2026-11-20', dias_para_vencer: -3 }),
    )
    montar()

    expect(
      await screen.findByText(/Venció hace 3 días: tenés hasta el \d{2}\/\d{2} para pagar sin cortes/),
    ).toBeInTheDocument()
    expect(screen.getByText('En gracia')).toBeInTheDocument()
  })

  it('en gracia usa el fin_gracia del backend cuando viene', async () => {
    servicio.obtener.mockResolvedValue(
      suscripcionCon('gracia', {
        vence_en: '2026-11-20',
        dias_para_vencer: -3,
        fin_gracia: '2026-11-30',
      }),
    )
    montar()

    expect(
      await screen.findByText('Venció hace 3 días: tenés hasta el 30/11 para pagar sin cortes'),
    ).toBeInTheDocument()
  })

  it('suspendida muestra el chip corto y la frase del estado', async () => {
    servicio.obtener.mockResolvedValue(suscripcionCon('suspendida', { dias_para_vencer: -35 }))
    montar()

    expect(await screen.findByText('Suscripción suspendida: venció hace 35 días')).toBeInTheDocument()
    expect(screen.getByText('Suspendida')).toBeInTheDocument()
  })

  it('cambiar de plan pide confirmación y explica que el precio rige desde el próximo período', async () => {
    montar()

    const botones = await screen.findAllByRole('button', { name: 'Pasar a este plan' })
    fireEvent.click(botones[0]) // Pro

    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText(/precio nuevo rige desde el próximo período/)).toBeInTheDocument()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cambiar plan' }))
    await waitFor(() => expect(servicio.cambiarPlan).toHaveBeenCalledWith('pro', 'tok'))
    await waitFor(() => expect(servicio.obtener).toHaveBeenCalledTimes(2))
  })

  it('el 409 del cambio de plan se muestra dentro de la confirmación', async () => {
    servicio.cambiarPlan.mockRejectedValue(
      new ApiError('Tu personal activo supera el límite de ese plan', 409, 'plan_personal_excedido'),
    )
    montar()

    const botones = await screen.findAllByRole('button', { name: 'Pasar a este plan' })
    fireEvent.click(botones[1]) // Profesional
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cambiar plan' }))

    expect(await within(dialogo).findByText('Tu personal activo supera el límite de ese plan')).toBeInTheDocument()
  })

  it('el 409 por personal explica cuántos son y qué hacer', async () => {
    servicio.obtener.mockResolvedValue(
      suscripcionCon('al_dia', { plan: PLANES[1], personal_activo: 4, max_personal: 10 }),
    )
    servicio.cambiarPlan.mockRejectedValue(new ApiError('Otro texto cualquiera', 409, 'plan_personal_excedido'))
    montar()

    const botones = await screen.findAllByRole('button', { name: 'Pasar a este plan' })
    fireEvent.click(botones[0]) // Esencial
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cambiar plan' }))

    expect(
      await within(dialogo).findByText(
        /Tenés 4 personas activas en el personal y el plan Esencial permite hasta 3\. Desactivá/,
      ),
    ).toBeInTheDocument()
  })

  it('activar cobro automático redirige al init_point de Mercado Pago', async () => {
    montar()

    fireEvent.click(await screen.findByRole('button', { name: 'Activar cobro automático' }))

    await waitFor(() => expect(servicio.activarCobro).toHaveBeenCalledWith('tok'))
    // jsdom no navega a URLs reales: con un fragmento se observa el assign.
    await waitFor(() => expect(window.location.hash).toBe('#mp-init'))
  })

  it('un 503 del cobro automático se explica en vez de fallar', async () => {
    servicio.activarCobro.mockRejectedValue(
      Object.assign(new Error('El cobro automático todavía no está configurado'), { status: 503 }),
    )
    montar()

    fireEvent.click(await screen.findByRole('button', { name: 'Activar cobro automático' }))

    expect(
      await screen.findByText(
        'El débito automático todavía no está habilitado. Escribinos y te ayudamos.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/transferencia/i)).not.toBeInTheDocument()
  })

  it('con cobro automático activo permite cancelarlo con confirmación', async () => {
    servicio.obtener.mockResolvedValue(suscripcionCon('al_dia', { cobro_automatico: true }))
    montar()

    expect(await screen.findByText(/Mercado Pago debita el plan cada mes/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar cobro automático' }))

    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Sí, cancelar' }))
    await waitFor(() => expect(servicio.cancelarCobro).toHaveBeenCalledWith('tok'))
  })

  it('muestra el historial de pagos', async () => {
    servicio.pagos.mockResolvedValue([PAGO])
    montar()

    const tabla = await screen.findByRole('table')
    // "Mercado Pago" sale en la columna del medio y en "registrado por".
    expect(within(tabla).getAllByText('Mercado Pago').length).toBeGreaterThan(0)
    expect(within(tabla).getByText('Aprobado')).toBeInTheDocument()
    expect(within(tabla).getByText(/20\/11 → 19\/12/)).toBeInTheDocument()
    // creado_en llega en UTC sin zona: se muestra en hora de Argentina (10:00 UTC → 07:00).
    expect(within(tabla).getByText('20/11/2026, 07:00')).toBeInTheDocument()
  })

  it('un pago manual sin nombre lo registró Boxly y un cobro sin nombre es automático', async () => {
    servicio.pagos.mockResolvedValue([
      { ...PAGO, id: 2, medio: 'manual', registrado_por: null },
      { ...PAGO, id: 3, estado: 'rechazado', registrado_por: null },
    ])
    montar()

    const tabla = await screen.findByRole('table')
    expect(within(tabla).getByText('Boxly')).toBeInTheDocument()
    expect(within(tabla).getByText('Automático')).toBeInTheDocument()
    expect(within(tabla).getByText('Rechazado')).toBeInTheDocument()
  })

  it('un 409 sin el código de plan muestra el mensaje del servidor tal cual', async () => {
    servicio.obtener.mockResolvedValue(
      suscripcionCon('al_dia', { plan: PLANES[1], personal_activo: 4, max_personal: 10 }),
    )
    servicio.cambiarPlan.mockRejectedValue(new ApiError('El plan cambió mientras tanto', 409))
    montar()

    const botones = await screen.findAllByRole('button', { name: 'Pasar a este plan' })
    fireEvent.click(botones[0]) // Esencial
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cambiar plan' }))

    expect(await within(dialogo).findByText('El plan cambió mientras tanto')).toBeInTheDocument()
    expect(within(dialogo).queryByText(/Tenés 4 personas activas/)).not.toBeInTheDocument()
  })

  it('con la suscripción suspendida el 403 del GET la marca suspendida, sin recargar en bucle', async () => {
    servicio.obtener.mockRejectedValue(new ApiError('Cualquier texto', 403, 'suscripcion_suspendida'))
    const { result } = renderHook(() => useSuscripcion())

    await waitFor(() => expect(result.current.suscripcion).toEqual({ estado: 'suspendida' }))
    expect(result.current.error).toBeNull()
    expect(servicio.obtener).toHaveBeenCalledTimes(1)

    // Otro 403 de suspensión (o el del propio GET) no vuelve a pedir la suscripción.
    fetchMock.mockResolvedValue(
      respuestaJson(
        { detail: 'La suscripción del taller está vencida', codigo: 'suscripcion_suspendida' },
        { status: 403 },
      ),
    )
    await act(async () => {
      await api.get('/api/v1/ordenes', 'tok').catch(() => {})
      await api.get('/api/v1/suscripcion', 'tok').catch(() => {})
    })
    expect(servicio.obtener).toHaveBeenCalledTimes(1)
  })

  it('un 403 de suscripción recarga el estado', async () => {
    montar()
    await screen.findByText('Al día hasta el 23/12')
    expect(servicio.obtener).toHaveBeenCalledTimes(1)

    fetchMock.mockResolvedValueOnce(
      respuestaJson(
        { detail: 'El taller está en solo lectura por falta de pago de la suscripción', codigo: 'suscripcion_solo_lectura' },
        { status: 403 },
      ),
    )
    await act(async () => {
      await api.get('/api/v1/ordenes', 'tok').catch(() => {})
    })

    await waitFor(() => expect(servicio.obtener).toHaveBeenCalledTimes(2))
  })

  it('un 403 con código suscripcion_suspendida recarga aunque el texto sea otro', async () => {
    montar()
    await screen.findByText('Al día hasta el 23/12')
    expect(servicio.obtener).toHaveBeenCalledTimes(1)

    fetchMock.mockResolvedValueOnce(
      respuestaJson({ detail: 'Texto nuevo que nadie previó', codigo: 'suscripcion_suspendida' }, { status: 403 }),
    )
    await act(async () => {
      await api.post('/api/v1/ordenes', {}, 'tok').catch(() => {})
    })

    await waitFor(() => expect(servicio.obtener).toHaveBeenCalledTimes(2))
  })

  it('un 403 sin código (permiso común) no recarga aunque el texto hable de la suscripción', async () => {
    montar()
    await screen.findByText('Al día hasta el 23/12')

    fetchMock.mockResolvedValueOnce(
      respuestaJson({ detail: 'La suscripción del taller está vencida' }, { status: 403 }),
    )
    await act(async () => {
      await api.get('/api/v1/ordenes', 'tok').catch(() => {})
    })

    expect(servicio.obtener).toHaveBeenCalledTimes(1)
  })
})
