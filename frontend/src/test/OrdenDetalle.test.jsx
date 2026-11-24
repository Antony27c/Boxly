import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrdenDetalle from '@/pages/OrdenDetalle'

const ordenes = vi.hoisted(() => ({
  obtener: vi.fn(),
  historial: vi.fn(),
  imagenes: vi.fn(),
  avisos: vi.fn(),
  detalles: vi.fn(),
  mecanicos: vi.fn(),
  cambiarEstado: vi.fn(),
  emitirCobro: vi.fn(),
  anularCobro: vi.fn(),
  aprobarCobro: vi.fn(),
  actualizar: vi.fn(),
  subirImagen: vi.fn(),
  quitarImagen: vi.fn(),
  agregarDetalle: vi.fn(),
  quitarDetalle: vi.fn(),
  enviarAviso: vi.fn(),
  eliminar: vi.fn(),
  listar: vi.fn(),
  crear: vi.fn(),
}))
const repuestos = vi.hoisted(() => ({ listar: vi.fn() }))
const sesion = vi.hoisted(() => ({ rol: 'mecanico' }))

vi.mock('@/services/ordenes', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, ordenesService: ordenes }
})
vi.mock('@/services/repuestos', () => ({ repuestosService: repuestos }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 9, nombre: 'Mario', apellido: 'Pérez', rol: sesion.rol },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

const ORDEN = {
  id: 7,
  codigo: 'ORD-0007',
  estado: 'En diagnóstico',
  vehiculo_id: 3,
  vehiculo_patente: 'AB123CD',
  vehiculo_marca: 'Fiat',
  vehiculo_modelo: 'Cronos',
  cliente_nombre: 'García, Ana',
  mecanico_id: 9,
  mecanico: 'Pérez, Mario',
  descripcion: 'Service completo',
  fecha: '2026-11-10',
  fecha_estimada_entrega: null,
  total: 0,
  costo_estimado: 0,
  costo_final: null,
  cobro_estado: null,
  monto_propuesto: null,
  pagada: false,
}

function montar(url = '/ordenes/7') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/ordenes/:id" element={<OrdenDetalle />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('OrdenDetalle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sesion.rol = 'mecanico'
    ordenes.obtener.mockResolvedValue(ORDEN)
    ordenes.historial.mockResolvedValue([])
    ordenes.imagenes.mockResolvedValue([])
    ordenes.avisos.mockResolvedValue([])
    ordenes.detalles.mockResolvedValue([])
    repuestos.listar.mockResolvedValue([])
  })

  it('el mecánico no ve el botón de WhatsApp al cliente', async () => {
    ordenes.obtener.mockResolvedValue({ ...ORDEN, cliente_id: 4 })
    montar()

    expect((await screen.findAllByRole('button', { name: 'Marcar listo' })).length).toBeGreaterThan(0)
    expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument()
  })

  it('muestra el botón principal del mecánico en diagnóstico', async () => {
    montar()

    expect((await screen.findAllByRole('button', { name: 'Marcar listo' })).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Esperando repuestos' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Cargar trabajo' }).length).toBeGreaterThan(0)
    expect(screen.getByText('AB123CD')).toBeInTheDocument()
    expect(screen.getByText('En diagnóstico')).toBeInTheDocument()
  })

  it('el bloque del vehículo es una ficha con el modelo como título y las personas con iniciales', async () => {
    montar()

    expect(await screen.findByRole('heading', { level: 2, name: 'Cronos' })).toBeInTheDocument()
    expect(screen.getByText('Fiat')).toBeInTheDocument()
    expect(screen.getByText('Orden ORD-0007')).toBeInTheDocument()
    expect(screen.getByText('Cliente')).toBeInTheDocument()
    expect(screen.getByText('García, Ana')).toBeInTheDocument()
    expect(screen.getByText('GA')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Mecánico')).toBeInTheDocument()
    expect(screen.getByText('Pérez, Mario')).toBeInTheDocument()
  })

  it('el botón principal abre el cambio de etapa con el destino preseleccionado', async () => {
    montar()

    const [boton] = await screen.findAllByRole('button', { name: 'Marcar listo' })
    fireEvent.click(boton)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Listo/ })).toBeChecked()
  })

  it('cambia de pestaña y la pestaña activa queda en la URL', async () => {
    montar()

    expect(await screen.findByText(/no hay trabajos ni repuestos/i)).toBeInTheDocument()
    const tabTrabajo = screen.getByRole('tab', { name: 'Trabajo' })
    expect(tabTrabajo).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: 'Cobro' })).not.toBeInTheDocument()

    const tabFotos = screen.getByRole('tab', { name: 'Fotos' })
    fireEvent.click(tabFotos)

    expect(tabFotos).toHaveAttribute('aria-selected', 'true')
    expect(tabTrabajo).toHaveAttribute('aria-selected', 'false')
    expect(await screen.findByText(/no hay fotos cargadas/i)).toBeInTheDocument()
  })

  it('abre directo en la pestaña pedida por la URL', async () => {
    montar('/ordenes/7?tab=fotos')

    expect(await screen.findByRole('tab', { name: 'Fotos' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(await screen.findByText(/no hay fotos cargadas/i)).toBeInTheDocument()
  })

  it('el mecánico no ve la pestaña ni las acciones de cobro en una orden lista', async () => {
    ordenes.obtener.mockResolvedValue({ ...ORDEN, estado: 'Listo' })
    montar()

    expect(await screen.findByRole('tab', { name: 'Trabajo' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Cobro' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cobro/i })).not.toBeInTheDocument()
  })

  it('la pestaña Cobro de una orden pagada dice cómo y cuándo se pagó', async () => {
    sesion.rol = 'recepcion'
    ordenes.obtener.mockResolvedValue({
      ...ORDEN,
      estado: 'Listo',
      costo_final: 185000,
      cobro_estado: 'aprobado',
      pagada: true,
      pago_medio: 'efectivo',
      pago_fecha: '2026-11-23T21:30:00',
    })
    montar('/ordenes/7?tab=cobro')

    expect(await screen.findByText(/^Pagada en el taller \(efectivo\):/)).toHaveTextContent(
      /23\/11\/2026, 18:30$/,
    )
  })

  it('avisa al mostrador cuando un pago online quedó duplicado', async () => {
    sesion.rol = 'recepcion'
    ordenes.obtener.mockResolvedValue({
      ...ORDEN,
      estado: 'Listo',
      pagada: true,
      pagos: [
        {
          id: 11,
          orden_id: 7,
          monto: '185000.00',
          estado: 'aprobado',
          medio: 'efectivo',
          payment_id: null,
          creado_en: '2026-11-20T15:00:00',
          fecha_pago: '2026-11-20T15:00:00',
        },
        {
          id: 12,
          orden_id: 7,
          monto: '185000.00',
          estado: 'duplicado',
          medio: 'mercadopago',
          payment_id: '1319283712',
          creado_en: '2026-11-23T21:30:00',
          fecha_pago: '2026-11-23T21:30:00',
        },
      ],
    })
    montar()

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent(
      'Esta orden recibió un pago online de $ 185.000 el 23/11/2026, 18:30 cuando ya estaba pagada. Devolvelo desde tu cuenta de Mercado Pago. Referencia del pago: 1319283712.',
    )
  })

  it('el administrador también ve el aviso de pago duplicado', async () => {
    sesion.rol = 'administrador'
    ordenes.obtener.mockResolvedValue({
      ...ORDEN,
      pagos: [{ id: 12, estado: 'duplicado', monto: 50000, creado_en: '2026-11-23T21:30:00' }],
    })
    montar()

    expect(await screen.findByRole('alert')).toHaveTextContent(/pago online de \$ 50\.000/)
  })

  it('con la orden pagada el encabezado dice "Pagada" con el medio, no "A cobrar"', async () => {
    sesion.rol = 'recepcion'
    ordenes.obtener.mockResolvedValue({
      ...ORDEN,
      estado: 'Listo',
      cobro_estado: 'aprobado',
      costo_final: 15000,
      total: 15000,
      pagada: true,
      pago_medio: 'efectivo',
    })
    montar()

    expect((await screen.findAllByText(/Pagada en el taller \(efectivo\)/)).length).toBeGreaterThan(0)
    expect(screen.queryByText('A cobrar')).not.toBeInTheDocument()
  })

  it('recepción anula el cobro emitido desde la pestaña Cobro', async () => {
    sesion.rol = 'recepcion'
    const emitida = { ...ORDEN, estado: 'Listo', cobro_estado: 'aprobado', costo_final: 15000, total: 15000 }
    ordenes.obtener.mockResolvedValue(emitida)
    ordenes.anularCobro.mockResolvedValue({ ...emitida, cobro_estado: null, costo_final: null })
    montar('/ordenes/7?tab=cobro')

    fireEvent.click(await screen.findByRole('button', { name: 'Anular cobro' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Anular el cobro' })
    expect(dialogo).toHaveTextContent(/el link de pago que tenga el cliente deja de servir/)
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Anular cobro' }))

    await waitFor(() => expect(ordenes.anularCobro).toHaveBeenCalledWith(7, 'tok'))
    await waitFor(() => expect(ordenes.obtener).toHaveBeenCalledTimes(2))
  })

  it('el mecánico no ve el aviso de pago duplicado', async () => {
    sesion.rol = 'mecanico'
    ordenes.obtener.mockResolvedValue({
      ...ORDEN,
      pagos: [{ id: 12, estado: 'duplicado', monto: 50000, creado_en: '2026-11-23T21:30:00' }],
    })
    montar()

    expect(await screen.findByText('En diagnóstico')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/pago online/)).not.toBeInTheDocument()
  })

  it('sin pagos duplicados no muestra el aviso', async () => {
    sesion.rol = 'recepcion'
    ordenes.obtener.mockResolvedValue({
      ...ORDEN,
      pagos: [{ id: 11, estado: 'aprobado', monto: 50000, creado_en: '2026-11-23T21:30:00' }],
    })
    montar()

    expect(await screen.findByText('En diagnóstico')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each(['En diagnóstico', 'Listo'])(
    'sin campos de dinero (MC1) el mecánico no ve "$", NaN ni undefined (%s)',
    async (estado) => {
      // Como la manda el backend al mecánico: sin total, costos, cobro ni pagos.
      const sinDinero = Object.fromEntries(
        Object.entries({ ...ORDEN, estado }).filter(
          ([campo]) =>
            !['total', 'costo_estimado', 'costo_final', 'cobro_estado', 'monto_propuesto', 'pagada'].includes(campo),
        ),
      )
      ordenes.obtener.mockResolvedValue(sinDinero)
      ordenes.detalles.mockResolvedValue([{ id: 1, descripcion: 'Filtro', repuesto_id: 2, cantidad: 1 }])
      const { container } = montar()

      expect(await screen.findByText(estado)).toBeInTheDocument()
      expect(screen.queryByText(/Presupuesto|A presupuestar|A cobrar|Pagada/)).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: 'Cobro' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /cobro/i })).not.toBeInTheDocument()
      expect(container.textContent).not.toMatch(/\$|NaN|undefined/)
    },
  )
})
