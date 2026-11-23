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
const taller = vi.hoisted(() => ({ datos: null }))

vi.mock('@/hooks/useTaller', () => ({
  default: () => ({ taller: taller.datos, cargando: false, error: '', recargar: vi.fn() }),
}))

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

const VEHICULO2 = {
  id: 11,
  marca: 'Fiat',
  modelo: 'Uno',
  patente: 'XYZ999',
  anio: 2015,
  color: 'Rojo',
  orden_activa: { id: 8, codigo: 'OR-008', estado: 'en_diagnostico' },
  ordenes_total: 2,
}

const ORDEN_PAGABLE = {
  id: 7,
  codigo: 'OR-007',
  estado: 'listo',
  vehiculo_id: 10,
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
  vehiculo_id: 11,
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
    taller.datos = null
    portal.misVehiculos.mockResolvedValue([])
    portal.misOrdenes.mockResolvedValue([])
  })

  it('al elegir un vehículo despliega sus órdenes agrupadas por etapa', async () => {
    portal.misOrdenes.mockResolvedValue([ORDEN_PAGABLE, ORDEN_CURSO])
    portal.misVehiculos.mockResolvedValue([VEHICULO, VEHICULO2])
    montar()

    expect(await screen.findByText('Hola, Ana')).toBeInTheDocument()
    expect(await screen.findByText('Mis vehículos')).toBeInTheDocument()
    expect(screen.getAllByText(/ABC123/).length).toBeGreaterThan(0)

    // Sin vehículo elegido no se ve ninguna orden.
    expect(screen.queryByText('OR-007')).not.toBeInTheDocument()

    // Elegir el Focus: despliega su orden; el pago se ofrece en la tarjeta del
    // vehículo y dentro de la orden.
    const tarjetaFocus = screen.getByText('Focus').closest('li')
    expect(within(tarjetaFocus).getByRole('button', { name: /pagar/i })).toBeInTheDocument()
    fireEvent.click(within(tarjetaFocus).getByRole('button', { name: 'Ver órdenes' }))
    expect(await screen.findByText('OR-007')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /pagar/i }).length).toBeGreaterThan(0)
    expect(screen.queryByText('OR-008')).not.toBeInTheDocument()

    // Elegir el Uno: despliega la otra orden.
    const tarjetaUno = screen.getByText('Uno').closest('li')
    fireEvent.click(within(tarjetaUno).getByRole('button', { name: 'Ver órdenes' }))
    expect(await screen.findByText('OR-008')).toBeInTheDocument()
    expect(screen.getByText('Total a confirmar')).toBeInTheDocument()
    expect(screen.getAllByText(/Ver seguimiento/).length).toBe(1)
  })

  it('muestra primero los listos para retirar y abajo todos los vehículos con su cantidad', async () => {
    portal.misOrdenes.mockResolvedValue([ORDEN_PAGABLE, ORDEN_CURSO])
    portal.misVehiculos.mockResolvedValue([
      { ...VEHICULO, orden_activa: { id: 7, codigo: 'OR-007', estado: 'listo' } },
      VEHICULO2,
    ])
    montar()

    // Arriba: solo el vehículo listo para retirar.
    const seccionListos = (await screen.findByText('Listos para retirar')).closest('section')
    expect(within(seccionListos).getByText('ABC123')).toBeInTheDocument()
    expect(within(seccionListos).queryByText('XYZ999')).not.toBeInTheDocument()

    // Abajo: todos los vehículos del titular con la cantidad en el encabezado.
    const seccionTodos = screen.getByText('Mis vehículos').closest('section')
    expect(within(seccionTodos).getAllByRole('listitem')).toHaveLength(2)
    const encabezado = seccionTodos.querySelector('h2')
    expect(within(encabezado).getByText('2')).toBeInTheDocument()
  })

  it('las tarjetas ficha llevan el modelo como título y la orden activa del vehículo', async () => {
    portal.misOrdenes.mockResolvedValue([ORDEN_PAGABLE, ORDEN_CURSO])
    portal.misVehiculos.mockResolvedValue([VEHICULO])
    montar()

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
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Ver órdenes' }))
    const fichaPagable = (await screen.findByText('OR-007')).closest('li')
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
    portal.misVehiculos.mockResolvedValue([VEHICULO, VEHICULO2])
    montar()

    await screen.findByText('Mis vehículos')

    // Seleccionar el Focus: la placa aparece en la ficha del auto y de la orden.
    const tarjetaFocus = screen.getByText('Focus').closest('li')
    fireEvent.click(within(tarjetaFocus).getByRole('button', { name: 'Ver órdenes' }))
    await screen.findByText('OR-007')
    const placas = screen.getAllByText('ABC123')
    expect(placas).toHaveLength(2)
    placas.forEach((placa) => expect(placa.previousSibling).toHaveTextContent('República Argentina'))
    expect(screen.getByRole('img', { name: 'Etapa 4 de 5: Listo' })).toBeInTheDocument()

    // Seleccionar el Uno: ruta de diagnóstico y la cancelada sin ruta.
    const tarjetaUno = screen.getByText('Uno').closest('li')
    fireEvent.click(within(tarjetaUno).getByRole('button', { name: 'Ver órdenes' }))
    await screen.findByText('OR-009')
    expect(screen.getByRole('img', { name: 'Etapa 3 de 6: En diagnóstico' })).toBeInTheDocument()
    // Una orden cancelada no tiene ruta que seguir.
    expect(screen.getAllByRole('img', { name: /^Etapa/ })).toHaveLength(1)
  })

  it('muestra el estado vacío cuando no hay órdenes ni vehículos', async () => {
    montar()

    expect(await screen.findByText('Sin órdenes')).toBeInTheDocument()
    expect(
      screen.getByText('Todavía no tenés órdenes de trabajo en el taller.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Mis vehículos')).not.toBeInTheDocument()
  })

  it('muestra el mensaje del taller como aviso y el contacto al pie', async () => {
    taller.datos = {
      nombre: 'Taller El Rayo',
      telefono: '11-5555-1234',
      hora_apertura: '08:00',
      hora_cierre: '18:00',
      mensaje_portal: 'Traé tu vehículo para una revisión gratis.',
    }
    portal.misVehiculos.mockResolvedValue([VEHICULO])
    portal.misOrdenes.mockResolvedValue([])
    montar()

    expect(
      await screen.findByText('Traé tu vehículo para una revisión gratis.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Tel: 11-5555-1234/)).toBeInTheDocument()
    expect(screen.getByText(/Horario de atención: 08:00 a 18:00/)).toBeInTheDocument()
  })

  it('sin datos del taller no muestra aviso ni pie de contacto', async () => {
    montar()

    expect(await screen.findByText('Sin órdenes')).toBeInTheDocument()
    expect(screen.queryByText(/Horario de atención/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Tel:/)).not.toBeInTheDocument()
  })

  it('muestra el error y reintenta la carga', async () => {
    portal.misOrdenes
      .mockRejectedValueOnce(new Error('No pudimos cargar tus órdenes.'))
      .mockResolvedValue([ORDEN_PAGABLE])
    portal.misVehiculos.mockResolvedValue([VEHICULO])
    montar()

    expect(await screen.findByText('No pudimos cargar tus órdenes.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }))

    await waitFor(() => expect(portal.misOrdenes).toHaveBeenCalledTimes(2))
    await screen.findByText('Mis vehículos')
    const tarjetaFocus = screen.getByText('Focus').closest('li')
    fireEvent.click(within(tarjetaFocus).getByRole('button', { name: 'Ver órdenes' }))
    expect(await screen.findByText('OR-007')).toBeInTheDocument()
  })
})
