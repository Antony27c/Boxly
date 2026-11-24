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
    activo: true,
    funciones: ['gestion', 'whatsapp_manual', 'whatsapp_automatico', 'arca'],
  },
  {
    codigo: 'profesional',
    nombre: 'Profesional',
    precio_mensual: 169000,
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

const PLAN_ACTUAL = PLANES[1]

const SUSCRIPCION = {
  plan: PLAN_ACTUAL,
  vence_en: '2026-12-15',
  estado: 'al_dia',
  dias_para_vencer: 22,
  cobro_automatico: true,
  personal_activo: 4,
  max_personal: 10,
  proximo_monto: 79000,
  tipo_acceso: 'demo',
  adicionales: [],
  funciones_efectivas: ['gestion', 'whatsapp_manual', 'whatsapp_automatico', 'arca'],
  pagos: [
    {
      id: 9,
      monto: 79000,
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

const ADICIONALES = [
  { codigo: 'arca', activo: true, desde: '2026-11-01', hasta: null },
]

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
    suscripciones.listarAdicionales.mockResolvedValue([])
    suscripciones.cambiarPlan.mockResolvedValue(SUSCRIPCION)
    suscripciones.registrarPago.mockResolvedValue({ id: 10 })
    suscripciones.ajustarVencimiento.mockResolvedValue(SUSCRIPCION)
    suscripciones.cambiarAcceso.mockResolvedValue(SUSCRIPCION)
    suscripciones.activarAdicional.mockResolvedValue({ codigo: 'arca', activo: true })
    suscripciones.desactivarAdicional.mockResolvedValue({ codigo: 'arca', activo: false })
  })

  it('muestra plan, tipo de acceso, estado, vencimiento, cobro, personal, funciones y pagos', async () => {
    montar()
    await esperarSuscripcion()

    expect(suscripciones.obtenerSuscripcion).toHaveBeenCalledWith(2, 'tok')
    expect(suscripciones.listarPlanes).toHaveBeenCalledWith('tok')
    expect(suscripciones.listarAdicionales).toHaveBeenCalledWith(2, 'tok')

    expect(screen.getByText(/^Pro · /)).toBeInTheDocument()
    // Tipo de acceso (C3): la demo se distingue del pago común.
    expect(screen.getByText('Acceso')).toBeInTheDocument()
    expect(screen.getByText('Demo')).toBeInTheDocument()
    expect(screen.getByText('Al día')).toBeInTheDocument()
    expect(screen.getByText(/15\/12\/2026/)).toBeInTheDocument()
    // Dentro del cupo: sin aviso de personal.
    expect(screen.getByText('4 de 10')).not.toHaveClass('text-danger')
    expect(screen.queryByText(/supera el cupo/)).not.toBeInTheDocument()
    expect(screen.getByText(/Vence en 22 días/)).toBeInTheDocument()
    expect(screen.getByText('Sí')).toBeInTheDocument() // cobro automático
    expect(screen.getByText('4 de 10')).toBeInTheDocument() // personal vs límite
    expect(screen.getByText('Próximo cobro')).toBeInTheDocument()

    // Funciones efectivas como chips legibles (códigos del contrato → etiquetas).
    expect(screen.getByText('Funciones incluidas')).toBeInTheDocument()
    expect(screen.getByText('Gestión del taller')).toBeInTheDocument()
    expect(screen.getByText('Avisos automáticos por WhatsApp')).toBeInTheDocument()
    expect(screen.getByText('Facturación electrónica ARCA')).toBeInTheDocument()

    // Historial: fecha, período, monto, medio, referencia y registrado por.
    expect(screen.getByText('TF-123', { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/Admin Norte/)).toBeInTheDocument()
    expect(screen.getByText(/Automático/)).toBeInTheDocument()
    expect(screen.getByText(/Mercado Pago/)).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Registrar pago o cortesía' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar acceso' })).toBeInTheDocument()
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

  it('muestra los límites de gracia y acceso que manda el backend', async () => {
    suscripciones.obtenerSuscripcion.mockResolvedValue({
      ...SUSCRIPCION,
      estado: 'gracia',
      tipo_acceso: 'pago',
      dias_para_vencer: -4,
      fin_gracia: '2026-12-01',
      fin_acceso: '2026-12-20',
    })
    montar()
    await esperarSuscripcion()

    expect(screen.getByText(/Gracia hasta el 01\/12\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/Acceso hasta el 20\/12\/2026/)).toBeInTheDocument()
  })

  it('al día no muestra límites de gracia ni de acceso', async () => {
    suscripciones.obtenerSuscripcion.mockResolvedValue({
      ...SUSCRIPCION,
      fin_gracia: '2026-12-22',
      fin_acceso: '2027-01-14',
    })
    montar()
    await esperarSuscripcion()

    expect(screen.queryByText(/Gracia hasta el/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Acceso hasta el/)).not.toBeInTheDocument()
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
      target: { value: 'esencial' },
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
    expect(monto).toHaveValue('79.000') // 79.000 × 1 mes, formato argentino

    fireEvent.change(within(dialogo).getByLabelText('Meses'), { target: { value: '3' } })
    expect(monto).toHaveValue('237.000') // se recalcula la sugerencia

    fireEvent.change(within(dialogo).getByLabelText('Referencia'), {
      target: { value: 'Comprobante 778' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }))

    await waitFor(() =>
      expect(suscripciones.registrarPago).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ monto: 237000, meses: 3, referencia: 'Comprobante 778' }),
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

  it('cambiar acceso convierte la demo en pago con el plan elegido', async () => {
    const onCambio = vi.fn()
    montar({ onCambio })
    await esperarSuscripcion()

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar acceso' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Cambiar acceso' })

    // Demo → el destino por defecto es pago; el plan arranca en el actual.
    const tipo = within(dialogo).getByLabelText('Tipo de acceso nuevo')
    expect(tipo).toHaveValue('pago')
    expect(within(dialogo).getByLabelText('Plan')).toHaveValue('pro')
    expect(within(dialogo).queryByLabelText('Fin del piloto')).not.toBeInTheDocument()

    fireEvent.change(within(dialogo).getByLabelText('Plan'), {
      target: { value: 'profesional' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cambiar acceso' }))

    await waitFor(() =>
      expect(suscripciones.cambiarAcceso).toHaveBeenCalledWith(
        2,
        { tipo: 'pago', plan: 'profesional' },
        'tok',
      ),
    )
    expect(await screen.findByText('Acceso actualizado.')).toBeInTheDocument()
    expect(suscripciones.obtenerSuscripcion).toHaveBeenCalledTimes(2) // recarga
    expect(onCambio).toHaveBeenCalled()
  })

  it('cambiar acceso a piloto pide fecha de fin y motivo', async () => {
    montar()
    await esperarSuscripcion()

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar acceso' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Cambiar acceso' })

    fireEvent.change(within(dialogo).getByLabelText('Tipo de acceso nuevo'), {
      target: { value: 'piloto' },
    })

    // Sin fecha ni motivo no llama al servicio.
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cambiar acceso' }))
    expect(await within(dialogo).findByText(/Elegí la fecha de fin/)).toBeInTheDocument()
    expect(await within(dialogo).findByText(/motivo del piloto/)).toBeInTheDocument()
    expect(suscripciones.cambiarAcceso).not.toHaveBeenCalled()

    fireEvent.change(within(dialogo).getByLabelText('Fin del piloto'), {
      target: { value: '2027-03-31' },
    })
    fireEvent.change(within(dialogo).getByLabelText('Motivo'), {
      target: { value: 'Piloto con taller recomendado' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cambiar acceso' }))

    await waitFor(() =>
      expect(suscripciones.cambiarAcceso).toHaveBeenCalledWith(
        2,
        {
          tipo: 'piloto',
          plan: 'pro',
          vence_en: '2027-03-31',
          motivo: 'Piloto con taller recomendado',
        },
        'tok',
      ),
    )
  })

  it('activa un adicional con fechas opcionales', async () => {
    montar()
    await esperarSuscripcion()

    fireEvent.click(screen.getByRole('button', { name: 'Activar adicional' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Activar adicional' })

    fireEvent.change(within(dialogo).getByLabelText('Vigente desde'), {
      target: { value: '2026-12-01' },
    })
    fireEvent.change(within(dialogo).getByLabelText('Vigente hasta'), {
      target: { value: '2026-12-31' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Activar' }))

    await waitFor(() =>
      expect(suscripciones.activarAdicional).toHaveBeenCalledWith(
        2,
        { codigo: 'arca', desde: '2026-12-01', hasta: '2026-12-31' },
        'tok',
      ),
    )
    expect(await screen.findByText('Adicional activado.')).toBeInTheDocument()
  })

  it('muestra el 409 cuando el plan ya incluye la función del adicional', async () => {
    suscripciones.activarAdicional.mockRejectedValue(
      new Error('El plan ya incluye esta función'),
    )
    montar()
    await esperarSuscripcion()

    fireEvent.click(screen.getByRole('button', { name: 'Activar adicional' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Activar adicional' })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Activar' }))

    expect(
      await within(dialogo).findByText('El plan ya incluye esta función'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Activar adicional' })).toBeInTheDocument()
  })

  it('lista los adicionales activos y los desactiva con confirmación', async () => {
    suscripciones.listarAdicionales.mockResolvedValue(ADICIONALES)
    montar()
    await esperarSuscripcion()

    // El rótulo aparece dos veces: chip de funciones efectivas y fila del adicional.
    expect(screen.getAllByText('Facturación electrónica ARCA').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/Desde 01\/11\/2026/)).toBeInTheDocument()
    // Con ARCA activo no se ofrece activarlo de nuevo.
    expect(screen.queryByRole('button', { name: 'Activar adicional' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }))
    const confirmacion = await screen.findByRole('dialog', { name: 'Desactivar adicional' })
    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Desactivar' }))

    await waitFor(() =>
      expect(suscripciones.desactivarAdicional).toHaveBeenCalledWith(2, 'arca', 'tok'),
    )
    expect(await screen.findByText('Adicional desactivado.')).toBeInTheDocument()
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

  it('con el personal por encima del cupo lo marca en alerta', async () => {
    suscripciones.obtenerSuscripcion.mockResolvedValue({
      ...SUSCRIPCION,
      plan: PLANES[0],
      personal_activo: 4,
      max_personal: 3,
    })
    montar()
    await esperarSuscripcion()

    expect(screen.getByText('4 de 3')).toHaveClass('text-danger')
    expect(screen.getByRole('alert')).toHaveTextContent('El personal activo supera el cupo del plan por 1')
  })

  it('muestra el chip Demo o Piloto según el tipo de acceso', () => {
    tarjetaDe({ ...BASE, tipo_acceso: 'demo', plan_codigo: 'pro' })
    expect(screen.getByText('Demo')).toBeInTheDocument()
  })

  it('con el personal por encima del cupo muestra "4 de 3" y un chip de alerta', () => {
    tarjetaDe({ ...BASE, personal: 4, max_personal: 3, plan_codigo: 'esencial' })

    expect(screen.getByText('4 de 3')).toHaveClass('text-danger')
    expect(screen.getByText('Personal por encima del plan')).toBeInTheDocument()
  })

  it('dentro del cupo o sin cupo informado no muestra el aviso de personal', () => {
    const { unmount } = tarjetaDe({ ...BASE, personal: 3, max_personal: 3 })
    expect(screen.getByText('3 de 3')).not.toHaveClass('text-danger')
    expect(screen.queryByText('Personal por encima del plan')).not.toBeInTheDocument()
    unmount()

    tarjetaDe({ ...BASE, personal: 4 })
    expect(screen.queryByText('Personal por encima del plan')).not.toBeInTheDocument()
  })

  it('pago no muestra chip de acceso', () => {
    tarjetaDe({ ...BASE, tipo_acceso: 'pago', plan_codigo: 'esencial' })
    expect(screen.queryByText('Demo')).not.toBeInTheDocument()
    expect(screen.queryByText('Piloto')).not.toBeInTheDocument()
  })

  it('avisa los días que quedan cuando quedan 3 o menos', () => {
    // Fecha local de hoy + 2 (el componente compara fechas sin zona horaria).
    const d = new Date()
    d.setDate(d.getDate() + 2)
    const enDosDias = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    tarjetaDe({ ...BASE, tipo_acceso: 'piloto', suscripcion_vence_en: enDosDias })

    expect(screen.getByText('Piloto · 2 días')).toBeInTheDocument()
  })

  it('con más de 3 días el chip no muestra la cuenta', () => {
    tarjetaDe({ ...BASE, tipo_acceso: 'demo', suscripcion_vence_en: '2099-01-01' })

    expect(screen.getByText('Demo')).toBeInTheDocument()
    // La cuenta solo aparece con el formato "Tipo · N días".
    expect(screen.queryByText(/^Demo ·/)).not.toBeInTheDocument()
  })
})
