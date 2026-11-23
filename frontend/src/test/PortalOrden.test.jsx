import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PortalOrden from '@/pages/PortalOrden'
import { puedePagar } from '@/services/portal'

const portal = vi.hoisted(() => ({
  misVehiculos: vi.fn(),
  misOrdenes: vi.fn(),
  miOrden: vi.fn(),
}))
const pagos = vi.hoisted(() => ({
  crear: vi.fn(),
  obtener: vi.fn(),
  confirmar: vi.fn(),
  simular: vi.fn(),
}))
const tallerHook = vi.hoisted(() => ({ datos: null }))

vi.mock('@/services/portal', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, portalService: portal, pagosService: pagos }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Ana', apellido: 'Paz', rol: 'cliente' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

vi.mock('@/hooks/useTaller', () => ({
  default: () => ({ taller: tallerHook.datos, cargando: false, error: '', recargar: vi.fn() }),
}))

function ordenBase(extra = {}) {
  return {
    id: 7,
    codigo: 'OR-007',
    estado: 'listo',
    pagada: false,
    puede_pagar: true,
    vehiculo: { marca: 'Ford', modelo: 'Focus', patente: 'ABC123' },
    fecha_ingreso: '2024-05-01T10:00:00',
    fecha_estimada_entrega: '2024-05-10T10:00:00',
    mecanico_nombre: 'Juan Pérez',
    descripcion_ingreso: 'Ruido al frenar',
    diagnostico: 'Pastillas gastadas',
    detalles: [],
    historial: [],
    imagenes: [],
    pasos: [],
    costo_final: '15000.00',
    costo_estimado: null,
    pago: null,
    ...extra,
  }
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/portal/orden/7']}>
      <Routes>
        <Route path="/portal/orden/:id" element={<PortalOrden />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PortalOrden', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tallerHook.datos = null
    portal.miOrden.mockResolvedValue(ordenBase())
  })

  it('muestra el detalle de la orden', async () => {
    montar()

    expect(await screen.findByText(/Orden OR-007/)).toBeInTheDocument()
    // Encabezado tipo ficha: modelo como título grande y marca de antetítulo.
    expect(screen.getByRole('heading', { level: 1, name: 'Focus' })).toBeInTheDocument()
    expect(screen.getByText('Ford')).toBeInTheDocument()
    expect(screen.getByText('Trabajos y repuestos')).toBeInTheDocument()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('Pastillas gastadas')).toBeInTheDocument()
    expect(
      screen.getByText('Todavía no se cargaron trabajos ni repuestos.'),
    ).toBeInTheDocument()
  })

  it('muestra la patente como placa y la ruta con la etapa actual', async () => {
    portal.miOrden.mockResolvedValue(
      ordenBase({
        estado: 'en_diagnostico',
        pasos: [
          { codigo: 'pendiente', nombre: 'Pendiente', estado: 'completado' },
          { codigo: 'ingresado', nombre: 'Ingresado', estado: 'completado' },
          { codigo: 'en_diagnostico', nombre: 'En diagnóstico', estado: 'actual' },
          { codigo: 'esperando_repuestos', nombre: 'Esperando repuestos', estado: 'pendiente' },
          { codigo: 'listo', nombre: 'Listo', estado: 'pendiente' },
          { codigo: 'entregado', nombre: 'Entregado', estado: 'pendiente' },
        ],
      }),
    )
    montar()

    const placa = await screen.findByText('ABC123')
    expect(placa.previousSibling).toHaveTextContent('República Argentina')
    expect(screen.getByText('Patente')).toHaveClass('sr-only')
    expect(screen.getByRole('img', { name: 'Etapa 3 de 6: En diagnóstico' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Llegada: Entregado' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('En diagnóstico')
  })

  it('muestra el botón de pagar cuando la orden es pagable', async () => {
    portal.miOrden.mockResolvedValue(ordenBase({ puede_pagar: true, pagada: false }))
    montar()

    expect(await screen.findByRole('button', { name: /pagar/i })).toBeInTheDocument()
  })

  it('no muestra el botón de pagar cuando la orden no es pagable', async () => {
    portal.miOrden.mockResolvedValue(ordenBase({ puede_pagar: false }))
    montar()

    expect(
      await screen.findByText('El pago se habilita cuando la orden esté lista.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pagar/i })).not.toBeInTheDocument()
  })

  it('muestra Pagada y no el botón cuando la orden ya está paga', async () => {
    portal.miOrden.mockResolvedValue(ordenBase({ pagada: true, puede_pagar: false }))
    montar()

    expect((await screen.findAllByText('Pagada')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /pagar/i })).not.toBeInTheDocument()
  })

  it('sin datos del taller conserva el botón de pagar', async () => {
    tallerHook.datos = null
    portal.miOrden.mockResolvedValue(ordenBase({ puede_pagar: true }))
    montar()

    expect(await screen.findByRole('button', { name: /pagar/i })).toBeInTheDocument()
  })

  it('con pago_online muestra el botón de pagar', async () => {
    tallerHook.datos = { pago_online: true }
    portal.miOrden.mockResolvedValue(ordenBase({ puede_pagar: true }))
    montar()

    expect(await screen.findByRole('button', { name: /pagar/i })).toBeInTheDocument()
  })

  it('sin pago_online muestra "Pagás en el taller" en lugar del botón', async () => {
    tallerHook.datos = { pago_online: false }
    portal.miOrden.mockResolvedValue(ordenBase({ puede_pagar: true }))
    montar()

    expect(await screen.findByText('Pagás en el taller')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pagar/i })).not.toBeInTheDocument()
  })

  it('al pagar crea el pago y redirige a url_pago', async () => {
    // jsdom no deja espiar window.location.assign ni navegar a URLs reales;
    // un fragmento (#…) sí es observable a través de location.hash.
    pagos.crear.mockResolvedValue({ url_pago: '#pago-exitoso' })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /pagar/i }))

    await waitFor(() => expect(pagos.crear).toHaveBeenCalledWith(7, 'tok'))
    await waitFor(() => expect(window.location.hash).toBe('#pago-exitoso'))
  })
})

describe('puedePagar', () => {
  it('es true solo con estado pagable, costo_final > 0 y sin pagar', () => {
    expect(puedePagar({ estado: 'listo', costo_final: 100, pagada: false })).toBe(true)
    expect(puedePagar({ estado: 'entregado', costo_final: '200.50', pagada: false })).toBe(true)
    expect(puedePagar({ estado: 'en_diagnostico', costo_final: 100, pagada: false })).toBe(false)
    expect(puedePagar({ estado: 'pendiente', costo_final: 100, pagada: false })).toBe(false)
    expect(puedePagar({ estado: 'listo', costo_final: 0, pagada: false })).toBe(false)
    expect(puedePagar({ estado: 'listo', costo_final: null, pagada: false })).toBe(false)
    expect(puedePagar({ estado: 'listo', costo_final: 100, pagada: true })).toBe(false)
  })
})
