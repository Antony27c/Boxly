import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GraciasDemo from '@/pages/GraciasDemo'
import Suscripcion from '@/pages/Suscripcion'
import GuardiaEncuesta from '@/components/suscripcion/GuardiaEncuesta'
import { ToastProvider } from '@/context/ToastContext'
import { ApiError } from '@/lib/api'
import { reiniciarEncuesta } from '@/services/encuesta'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), getConTotal: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal()), api }))

const auth = vi.hoisted(() => ({ value: null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth.value }))

const suscripcionHook = vi.hoisted(() => ({ value: null }))
vi.mock('@/hooks/useSuscripcion', () => ({
  default: () => suscripcionHook.value,
  reiniciarSuscripcion: vi.fn(),
}))

const servicioSuscripcion = vi.hoisted(() => ({
  obtener: vi.fn(),
  planes: vi.fn(),
  cambiarPlan: vi.fn(),
  pagos: vi.fn(),
  activarCobro: vi.fn(),
  cancelarCobro: vi.fn(),
}))
vi.mock('@/services/suscripcion', async (importOriginal) => ({
  ...(await importOriginal()),
  suscripcionService: servicioSuscripcion,
}))

function usuarioCon(rol, token = 'tok') {
  return { token, usuario: { id: 5, nombre: 'Ana', apellido: 'Pérez', rol }, autenticado: true }
}

const DEMO_VENCIDA = {
  plan: { codigo: 'pro', nombre: 'Pro', precio_mensual: 79000, max_personal: 10, activo: true },
  tipo_acceso: 'demo',
  vence_en: '2026-11-20',
  estado: 'solo_lectura',
  dias_para_vencer: -2,
  cobro_automatico: false,
  personal_activo: 2,
  max_personal: 10,
  proximo_monto: 79000,
}

const PLANES = [
  { codigo: 'esencial', nombre: 'Esencial', precio_mensual: 39000, max_personal: 3, funciones: ['gestion', 'whatsapp_manual'] },
  {
    codigo: 'pro',
    nombre: 'Pro',
    precio_mensual: 79000,
    max_personal: 10,
    funciones: ['gestion', 'whatsapp_manual', 'whatsapp_automatico', 'telegram_automatico', 'arca'],
  },
]

function Ubicacion() {
  const { pathname } = useLocation()
  return <p data-testid="ruta">{pathname}</p>
}

function montarGracias() {
  return render(
    <MemoryRouter initialEntries={['/gracias']}>
      <ToastProvider>
        <Routes>
          <Route path="/gracias" element={<GraciasDemo />} />
          <Route path="/suscripcion" element={<Ubicacion />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

function montarGuardia(inicial = '/hoy') {
  return render(
    <MemoryRouter initialEntries={[inicial]}>
      <Routes>
        <Route element={<GuardiaEncuesta />}>
          <Route path="*" element={<Ubicacion />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  reiniciarEncuesta()
  auth.value = usuarioCon('administrador')
  suscripcionHook.value = { suscripcion: DEMO_VENCIDA, cargando: false, error: null, recargar: vi.fn() }
})

describe('GraciasDemo', () => {
  it('agradece y explica el fin de la demo con las fechas', () => {
    montarGracias()
    expect(screen.getByRole('heading', { level: 1, name: 'Gracias por probar Boxly' })).toBeInTheDocument()
    expect(screen.getByText('Tu demo terminó el 20/11.')).toBeInTheDocument()
    expect(screen.getByText(/Tenés hasta el 23\/11 para elegir un plan/)).toBeInTheDocument()
    expect(screen.getByText(/después el acceso se suspende/)).toBeInTheDocument()
  })

  it('ofrece seguir con Pro destacado y Esencial como opción secundaria', async () => {
    servicioSuscripcion.planes.mockResolvedValue(PLANES)
    montarGracias()

    const seguir = await screen.findByRole('button', { name: 'Seguí con Pro' })
    expect(seguir.closest('[aria-current="true"]')).toHaveTextContent('Mantené todo lo que usaste estos 14 días')
    expect(screen.getByRole('button', { name: 'Elegir Esencial' })).toBeInTheDocument()
  })

  it('"Seguí con Pro" activa el débito automático sin cambiar el plan', async () => {
    servicioSuscripcion.planes.mockResolvedValue(PLANES)
    servicioSuscripcion.activarCobro.mockResolvedValue({ init_point: '#mp-demo' })
    montarGracias()

    fireEvent.click(await screen.findByRole('button', { name: 'Seguí con Pro' }))
    await waitFor(() => expect(servicioSuscripcion.activarCobro).toHaveBeenCalledWith('tok'))
    expect(servicioSuscripcion.cambiarPlan).not.toHaveBeenCalled()
    await waitFor(() => expect(window.location.hash).toBe('#mp-demo'))
  })

  it('elegir Esencial avisa qué deja de tener antes de confirmar', async () => {
    servicioSuscripcion.planes.mockResolvedValue(PLANES)
    montarGracias()

    fireEvent.click(await screen.findByRole('button', { name: 'Elegir Esencial' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Con Esencial dejás de tener:')).toBeInTheDocument()
    expect(dialogo).toHaveTextContent('Avisos automáticos por WhatsApp')
    expect(dialogo).toHaveTextContent('Avisos automáticos por Telegram')
    expect(dialogo).toHaveTextContent('Facturación electrónica ARCA')
    expect(servicioSuscripcion.cambiarPlan).not.toHaveBeenCalled()
  })

  it('envía solo lo respondido y va a /suscripcion', async () => {
    api.post.mockResolvedValue({ ok: true })
    montarGracias()

    fireEvent.change(screen.getByLabelText('¿Qué te gustó?'), { target: { value: ' Las órdenes con fotos ' } })
    fireEvent.change(screen.getByLabelText('¿Qué mejorarías?'), { target: { value: 'Los reportes' } })
    fireEvent.click(screen.getByRole('radio', { name: '4 de 5, Bueno' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Tal vez' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByTestId('ruta')).toHaveTextContent('/suscripcion')
    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/suscripcion/encuesta',
      { gusto: 'Las órdenes con fotos', mejoras: 'Los reportes', puntaje: 4, intencion: 'tal_vez' },
      'tok',
    )
  })

  it('el puntaje es un grupo de radios de 1 a 5 y se puede quitar', () => {
    montarGracias()
    const estrellas = screen.getAllByRole('radio', { name: /de 5/ })
    expect(estrellas).toHaveLength(5)
    fireEvent.click(estrellas[2])
    expect(estrellas[2]).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar puntaje' }))
    expect(estrellas.every((e) => !e.checked)).toBe(true)
  })

  it('"Ahora no" saltea la encuesta y va a /suscripcion', async () => {
    api.post.mockResolvedValue({ ok: true })
    montarGracias()
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }))

    expect(await screen.findByTestId('ruta')).toHaveTextContent('/suscripcion')
    expect(api.post).toHaveBeenCalledWith('/api/v1/suscripcion/encuesta', { salteada: true }, 'tok')
  })

  it('el 409 (ya respondida) va directo a /suscripcion', async () => {
    api.post.mockRejectedValue(new ApiError('La encuesta ya fue respondida', 409))
    montarGracias()
    fireEvent.change(screen.getByLabelText('¿Alguna sugerencia?'), { target: { value: 'Nada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByTestId('ruta')).toHaveTextContent('/suscripcion')
  })

  it('otros errores se explican y la persona se queda en la encuesta', async () => {
    api.post.mockRejectedValue(new ApiError('sin conexión', 0))
    montarGracias()
    fireEvent.click(screen.getByRole('radio', { name: 'Sí' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Revisá tu conexión/)
    expect(screen.queryByTestId('ruta')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Sí' })).toBeChecked()
  })
})

describe('GuardiaEncuesta', () => {
  it('lleva al administrador a /gracias cuando corresponde, una sola vez', async () => {
    api.get.mockResolvedValue({ corresponde: true, respondida: false })
    const { unmount } = montarGuardia('/hoy')

    await waitFor(() => expect(screen.getByTestId('ruta')).toHaveTextContent('/gracias'))
    expect(api.get).toHaveBeenCalledWith('/api/v1/suscripcion/encuesta', 'tok')
    unmount()

    // En la misma sesión ya no vuelve a redirigir.
    montarGuardia('/ordenes')
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByTestId('ruta')).toHaveTextContent('/ordenes')
  })

  it('no redirige si no corresponde', async () => {
    api.get.mockResolvedValue({ corresponde: false, respondida: true })
    montarGuardia('/hoy')
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByTestId('ruta')).toHaveTextContent('/hoy')
  })

  it.each(['recepcion', 'mecanico', 'cliente', 'superadmin'])('a %s no lo redirige ni pregunta', async (rol) => {
    auth.value = usuarioCon(rol)
    api.get.mockResolvedValue({ corresponde: true, respondida: false })
    montarGuardia('/hoy')
    await new Promise((r) => setTimeout(r, 20))
    expect(api.get).not.toHaveBeenCalled()
    expect(screen.getByTestId('ruta')).toHaveTextContent('/hoy')
  })

  it('no saca al administrador de los términos', async () => {
    api.get.mockResolvedValue({ corresponde: true, respondida: false })
    montarGuardia('/terminos')
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByTestId('ruta')).toHaveTextContent('/terminos')
  })

  it('si el GET falla deja pasar', async () => {
    api.get.mockRejectedValue(new ApiError('error', 500))
    montarGuardia('/hoy')
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByTestId('ruta')).toHaveTextContent('/hoy')
  })
})

describe('Suscripcion con una demo vencida', () => {
  beforeEach(() => {
    servicioSuscripcion.planes.mockResolvedValue([DEMO_VENCIDA.plan])
    servicioSuscripcion.pagos.mockResolvedValue([])
  })

  function montarSuscripcion() {
    return render(
      <MemoryRouter>
        <ToastProvider>
          <Suscripcion />
        </ToastProvider>
      </MemoryRouter>,
    )
  }

  it('muestra cuándo terminó la demo y hasta cuándo elegir un plan, sin el texto de gracia', async () => {
    montarSuscripcion()
    expect(
      await screen.findByText('Tu demo terminó el 20/11. Tenés hasta el 23/11 para elegir un plan.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Demo terminada')).toBeInTheDocument()
    expect(screen.queryByText(/Solo lectura por falta de pago/)).not.toBeInTheDocument()
  })

  it('una suscripción paga sigue con el texto de siempre', async () => {
    suscripcionHook.value = {
      ...suscripcionHook.value,
      suscripcion: { ...DEMO_VENCIDA, tipo_acceso: 'pago', estado: 'gracia', dias_para_vencer: -3 },
    }
    montarSuscripcion()
    expect(await screen.findByText(/Venció hace 3 días: tenés hasta el/)).toBeInTheDocument()
    expect(screen.queryByText(/Tu demo terminó/)).not.toBeInTheDocument()
  })
})
