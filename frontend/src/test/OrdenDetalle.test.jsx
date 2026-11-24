import { fireEvent, render, screen } from '@testing-library/react'
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
})
