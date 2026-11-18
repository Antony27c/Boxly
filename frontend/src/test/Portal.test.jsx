import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Portal from '@/pages/Portal'

const portal = vi.hoisted(() => ({
  misVehiculos: vi.fn(),
  misOrdenes: vi.fn(),
  miOrden: vi.fn(),
}))
const pagos = vi.hoisted(() => ({ crear: vi.fn() }))

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

const VEHICULO = {
  id: 10,
  marca: 'Ford',
  modelo: 'Focus',
  patente: 'ABC123',
  anio: 2019,
  color: 'Blanco',
  orden_activa: { id: 7, codigo: 'OR-007', estado: 'en_diagnostico' },
  ordenes_total: 3,
}

const ORDEN_PAGABLE = {
  id: 7,
  codigo: 'OR-007',
  estado: 'listo',
  vehiculo_marca: 'Ford',
  vehiculo_modelo: 'Focus',
  vehiculo_patente: 'ABC123',
  fecha_ingreso: '2024-05-01T10:00:00',
  fecha_estimada_entrega: '2024-05-10T10:00:00',
  costo_final: '15000.00',
  pagada: false,
}

const ORDEN_CURSO = {
  id: 8,
  codigo: 'OR-008',
  estado: 'en_diagnostico',
  vehiculo_marca: 'Fiat',
  vehiculo_modelo: 'Uno',
  vehiculo_patente: 'XYZ999',
  fecha_ingreso: '2024-05-03T10:00:00',
  costo_final: null,
  pagada: false,
}

function montar() {
  return render(
    <MemoryRouter>
      <Portal />
    </MemoryRouter>,
  )
}

describe('Portal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    portal.misVehiculos.mockResolvedValue([])
    portal.misOrdenes.mockResolvedValue([])
  })

  it('muestra las órdenes y los vehículos del cliente', async () => {
    portal.misOrdenes.mockResolvedValue([ORDEN_PAGABLE, ORDEN_CURSO])
    portal.misVehiculos.mockResolvedValue([VEHICULO])
    montar()

    expect(await screen.findByText('Hola, Ana')).toBeInTheDocument()
    // Órdenes y vehículos cargan por separado: esperar a que estén las dos listas.
    expect(await screen.findByText('OR-008')).toBeInTheDocument()
    expect(await screen.findByText('Mis vehículos')).toBeInTheDocument()
    expect(screen.getAllByText(/ABC123/).length).toBeGreaterThan(0)
    expect(screen.getByText('OR-007')).toBeInTheDocument()
    expect(screen.getByText('OR-008')).toBeInTheDocument()
    expect(screen.getByText('Listas para pagar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pagar/i })).toBeInTheDocument()
    expect(screen.getByText('Total a confirmar')).toBeInTheDocument()
    expect(screen.getAllByText(/Ver seguimiento/).length).toBe(2)
  })

  it('las tarjetas ficha llevan el modelo como título y la orden activa del vehículo', async () => {
    portal.misOrdenes.mockResolvedValue([ORDEN_PAGABLE, ORDEN_CURSO])
    portal.misVehiculos.mockResolvedValue([VEHICULO])
    montar()

    await screen.findByText('OR-008')
    await screen.findByText('Mis vehículos')

    const [listaVehiculos] = screen.getAllByRole('list').filter((lista) => within(lista).queryByText('Ford'))
    const tarjeta = within(listaVehiculos).getByRole('listitem')
    // Ficha del vehículo: marca de antetítulo, modelo de título y la orden activa abajo.
    expect(within(tarjeta).getByRole('heading', { level: 3, name: 'Focus' })).toBeInTheDocument()
    expect(within(tarjeta).getByText('Ford')).toBeInTheDocument()
    expect(within(tarjeta).getByText('2019')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Blanco')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Orden activa')).toBeInTheDocument()
    expect(within(tarjeta).getByText('En diagnóstico')).toBeInTheDocument()
    expect(within(tarjeta).getByRole('link', { name: /Seguir OR-007/ })).toHaveAttribute('href', '/portal/orden/7')

    // Fichas de las órdenes: código de antetítulo y modelo del auto de título.
    expect(screen.getByRole('heading', { level: 3, name: 'Uno' })).toBeInTheDocument()
    const fichaPagable = screen.getByText('OR-007').closest('li')
    expect(within(fichaPagable).getByRole('heading', { level: 3, name: 'Focus' })).toBeInTheDocument()
    expect(within(fichaPagable).getByText('Lista para pagar')).toBeInTheDocument()
    expect(within(fichaPagable).getByRole('link', { name: /Ver seguimiento/ })).toHaveAttribute('href', '/portal/orden/7')
  })

  it('un vehículo sin orden activa lo dice y no ofrece seguimiento', async () => {
    portal.misVehiculos.mockResolvedValue([{ ...VEHICULO, orden_activa: null }])
    montar()

    expect(await screen.findByText('Sin trabajos en curso')).toBeInTheDocument()
    expect(screen.queryByText('Orden activa')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Seguir/ })).not.toBeInTheDocument()
  })

  it('muestra las patentes como placa y la ruta compacta de cada orden', async () => {
    portal.misOrdenes.mockResolvedValue([ORDEN_PAGABLE, ORDEN_CURSO, { ...ORDEN_CURSO, id: 9, codigo: 'OR-009', estado: 'cancelado' }])
    portal.misVehiculos.mockResolvedValue([VEHICULO])
    montar()

    expect(await screen.findByText('OR-009')).toBeInTheDocument()
    await screen.findByText('Mis vehículos')
    // La patente va en una placa Mercosur (con la banda "República Argentina").
    const placas = screen.getAllByText('ABC123')
    expect(placas).toHaveLength(2)
    placas.forEach((placa) => expect(placa.previousSibling).toHaveTextContent('República Argentina'))

    expect(screen.getByRole('img', { name: 'Etapa 4 de 5: Listo' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Etapa 3 de 6: En diagnóstico' })).toBeInTheDocument()
    // Una orden cancelada no tiene ruta que seguir.
    expect(screen.getAllByRole('img', { name: /^Etapa/ })).toHaveLength(2)
  })

  it('muestra el estado vacío cuando no hay órdenes ni vehículos', async () => {
    montar()

    expect(await screen.findByText('Sin órdenes')).toBeInTheDocument()
    expect(
      screen.getByText('Todavía no tenés órdenes de trabajo en el taller.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Mis vehículos')).not.toBeInTheDocument()
  })

  it('muestra el error y reintenta la carga', async () => {
    portal.misOrdenes
      .mockRejectedValueOnce(new Error('No pudimos cargar tus órdenes.'))
      .mockResolvedValue([ORDEN_PAGABLE])
    montar()

    expect(await screen.findByText('No pudimos cargar tus órdenes.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }))

    await waitFor(() => expect(portal.misOrdenes).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('OR-007')).toBeInTheDocument()
  })
})
