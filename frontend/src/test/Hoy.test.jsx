import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Hoy from '@/pages/Hoy'
import { aISO } from '@/utils/fechas'

const HOY = aISO(new Date())

const auth = vi.hoisted(() => ({
  token: 'tok',
  usuario: { id: 1, nombre: 'Ana', apellido: 'Perez', rol: 'recepcion' },
}))

const ordenes = vi.hoisted(() => ({ listar: vi.fn() }))
const turnos = vi.hoisted(() => ({ listar: vi.fn() }))
const clientes = vi.hoisted(() => ({ listar: vi.fn() }))
const vehiculos = vi.hoisted(() => ({ listar: vi.fn() }))
const repuestos = vi.hoisted(() => ({ stockBajo: vi.fn() }))

vi.mock('@/services/ordenes', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, ordenesService: ordenes }
})
vi.mock('@/services/turnos', () => ({ turnosService: turnos }))
vi.mock('@/services/clientes', () => ({ clientesService: clientes }))
vi.mock('@/services/vehiculos', () => ({ vehiculosService: vehiculos }))
vi.mock('@/services/repuestos', () => ({ repuestosService: repuestos }))
// Primeros pasos tiene sus propios tests y consulta otros servicios: acá se reemplaza.
vi.mock('@/components/inicio/PrimerosPasos', () => ({ default: () => null }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: auth.token,
    usuario: auth.usuario,
    autenticado: true,
    cargandoSesion: false,
  }),
}))

function Ubicacion() {
  const lugar = useLocation()
  return <output data-testid="ubicacion">{lugar.pathname}{lugar.search}</output>
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/hoy']}>
      <Hoy />
      <Ubicacion />
    </MemoryRouter>,
  )
}

const ORDEN_LISTA = {
  id: 10,
  estado: 'Listo',
  mecanico_id: 5,
  mecanico: 'Mario',
  vehiculo_id: 2,
  vehiculo_patente: 'AA111BB',
  vehiculo_marca: 'Fiat',
  vehiculo_modelo: 'Cronos',
  cliente_nombre: 'Perez, Ana',
  descripcion: 'Service de 10.000 km',
  fecha: HOY,
  cobro_estado: 'aprobado',
  costo_final: 50000,
  pagada: false,
  total: 50000,
}

const ORDEN_SIN_MECANICO = {
  ...ORDEN_LISTA,
  id: 11,
  estado: 'Ingresado',
  mecanico_id: null,
  mecanico: '',
  vehiculo_patente: 'BB222CC',
  cobro_estado: null,
  costo_final: null,
}

const ORDEN_COBRO_PENDIENTE = {
  ...ORDEN_LISTA,
  id: 12,
  estado: 'Listo',
  cobro_estado: 'pendiente',
  monto_propuesto: 30000,
  costo_final: null,
  vehiculo_patente: 'CC333DD',
}

const TURNO_HOY = {
  id: 7,
  fecha: HOY,
  hora: '10:00',
  estado: 'confirmado',
  servicio: 'Service',
  cliente_id: 1,
  vehiculo_id: 2,
}

const TURNO_CANCELADO = { ...TURNO_HOY, id: 8, estado: 'cancelado', hora: '12:00' }
const TURNO_OTRO_DIA = { ...TURNO_HOY, id: 9, fecha: '2000-01-01', hora: '14:00' }

describe('Hoy — recepción y administración', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.usuario = { id: 1, nombre: 'Ana', apellido: 'Perez', rol: 'recepcion' }
    ordenes.listar.mockResolvedValue([ORDEN_LISTA, ORDEN_SIN_MECANICO, ORDEN_COBRO_PENDIENTE])
    turnos.listar.mockResolvedValue([TURNO_HOY, TURNO_CANCELADO, TURNO_OTRO_DIA])
    clientes.listar.mockResolvedValue([{ id: 1, nombre: 'Ana', apellido: 'Perez' }])
    vehiculos.listar.mockResolvedValue([{ id: 2, patente: 'AA111BB' }])
    repuestos.stockBajo.mockResolvedValue([
      { id: 3, codigo: 'FIL1', nombre: 'Filtro de aceite', stock: 1, stock_minimo: 2 },
    ])
  })

  it('muestra los bloques del día y "Recibir auto" del turno navega a /turnos', async () => {
    montar()

    expect(await screen.findByText('Turnos de hoy')).toBeInTheDocument()
    expect(screen.getByText('Listos para entregar')).toBeInTheDocument()
    expect(screen.getByText('Sin mecánico asignado')).toBeInTheDocument()
    expect(screen.getByText('Stock bajo')).toBeInTheDocument()
    // Solo admin ve cobros por aprobar.
    expect(screen.queryByText('Cobros por aprobar')).not.toBeInTheDocument()

    await waitFor(() =>
      expect(turnos.listar).toHaveBeenCalledWith({ desde: HOY, hasta: HOY }, 'tok'),
    )

    // El turno cancelado y el de otro día no aparecen; queda solo el de hoy.
    const botonRecibir = await screen.findByRole('button', { name: 'Recibir auto' })
    expect(screen.getAllByText('Perez, Ana').length).toBeGreaterThan(0)

    // Los "Ver todo" apuntan al tablero con el contrato ?filtro= de la tarea C.
    const destinos = screen
      .getAllByRole('link', { name: 'Ver todo' })
      .map((enlace) => enlace.getAttribute('href'))
    expect(destinos).toEqual(
      expect.arrayContaining([
        '/turnos',
        '/ordenes?filtro=listas',
        '/ordenes?filtro=sin_asignar',
        '/inventario',
      ]),
    )

    fireEvent.click(botonRecibir)
    await waitFor(() =>
      expect(screen.getByTestId('ubicacion')).toHaveTextContent('/turnos?recibir=7'),
    )
  })

  it('los botones grandes navegan al ingreso rápido y al alta de cliente', async () => {
    montar()
    await screen.findByText('Turnos de hoy')

    fireEvent.click(screen.getByRole('link', { name: 'Recibir un auto' }))
    await waitFor(() =>
      expect(screen.getByTestId('ubicacion')).toHaveTextContent('/ordenes?ingreso=1'),
    )

    fireEvent.click(screen.getByRole('link', { name: 'Cliente nuevo' }))
    await waitFor(() =>
      expect(screen.getByTestId('ubicacion')).toHaveTextContent('/clientes?nuevo=1'),
    )
  })

  it('administrador ve el bloque de cobros por aprobar con el monto', async () => {
    auth.usuario = { id: 2, nombre: 'Admin', apellido: 'Sistema', rol: 'administrador' }
    montar()

    expect(await screen.findByText('Cobros por aprobar')).toBeInTheDocument()
    // La misma orden también aparece en "Listos para entregar": hay más de una.
    expect((await screen.findAllByText('Aprobar cobro')).length).toBeGreaterThan(0)
    expect(screen.getByText(/30\.000/)).toBeInTheDocument()

    const destinos = screen
      .getAllByRole('link', { name: 'Ver todo' })
      .map((enlace) => enlace.getAttribute('href'))
    expect(destinos).toContain('/ordenes?filtro=cobro_pendiente')
  })

  it('las filas son fichas: modelo resaltado, marca chica, patente, hora y cliente con iniciales', async () => {
    ordenes.listar.mockResolvedValue([ORDEN_LISTA, { ...ORDEN_SIN_MECANICO, vehiculo_patente: '' }])
    vehiculos.listar.mockResolvedValue([{ id: 2, patente: 'AA111BB', marca: 'Peugeot', modelo: '208' }])
    montar()

    // Orden lista: el modelo es el título, la marca va arriba en dorado y la barra es verde.
    const [modelo] = await screen.findAllByText('Cronos', { selector: '.font-extrabold' })
    const filaLista = modelo.closest('li')
    expect(within(filaLista).getByText('Fiat')).toHaveClass('uppercase', 'text-amber-texto')
    expect(within(filaLista).getByText('AA111BB')).toBeInTheDocument()
    expect(filaLista.querySelector('.bg-ok')).toBeInTheDocument()
    expect(within(filaLista).getByText('PA')).toHaveAttribute('aria-hidden', 'true')
    expect(within(filaLista).getByRole('link', { name: /Cronos/ })).toHaveAttribute('href', '/ordenes/10')

    // Sin patente queda "Orden #id" y la barra marca que falta mecánico.
    const filaSinPatente = screen.getByText('Orden #11').closest('li')
    expect(filaSinPatente.querySelector('.bg-danger')).toBeInTheDocument()

    // Turno: la hora en mono y el modelo del auto que viene.
    const hora = screen.getByText('10:00')
    expect(hora).toHaveClass('font-mono', 'font-bold')
    const filaTurno = hora.closest('li')
    expect(within(filaTurno).getByText('208')).toHaveClass('font-extrabold')
    expect(within(filaTurno).getByText('Peugeot')).toBeInTheDocument()
    expect(within(filaTurno).getByText('Perez, Ana')).toBeInTheDocument()
    expect(filaTurno.querySelector('.bg-ok')).toBeInTheDocument()
    expect(filaTurno).toHaveClass('min-h-[56px]')
  })

  it('stock bajo y sin mecánico: fichas con link, "Ver todo" filtrado y como mucho 5 filas', async () => {
    const muchas = Array.from({ length: 7 }, (_, indice) => ({
      ...ORDEN_SIN_MECANICO,
      id: 100 + indice,
      vehiculo_patente: `AB${100 + indice}CD`,
    }))
    ordenes.listar.mockResolvedValue(muchas)
    montar()

    const bloqueStock = (await screen.findByRole('heading', { name: /Stock bajo/ })).closest('section')
    const filaStock = within(bloqueStock).getByText('Filtro de aceite').closest('a')
    expect(filaStock).toHaveAttribute('href', '/inventario')
    expect(filaStock).toHaveTextContent('stock 1 · mínimo 2')

    const bloqueSin = screen.getByRole('heading', { name: /Sin mecánico asignado/ }).closest('section')
    expect(within(bloqueSin).getByText('7')).toBeInTheDocument()
    expect(within(bloqueSin).getAllByRole('listitem')).toHaveLength(5)
    expect(within(bloqueSin).getByRole('link', { name: 'Ver todo' })).toHaveAttribute(
      'href',
      '/ordenes?filtro=sin_asignar',
    )
    // Recepción no ve el bloque de cobros por aprobar.
    expect(screen.queryByRole('heading', { name: /Cobros por aprobar/ })).not.toBeInTheDocument()
  })

  it('marca con "Pago duplicado" la orden con un pago online de más', async () => {
    ordenes.listar.mockResolvedValue([
      { ...ORDEN_LISTA, pagos: [{ id: 1, estado: 'duplicado', monto: '50000.00' }] },
      { ...ORDEN_SIN_MECANICO, tiene_pago_duplicado: true },
      { ...ORDEN_LISTA, id: 13, vehiculo_patente: 'EE555FF', pagos: [{ id: 2, estado: 'aprobado' }] },
    ])
    montar()

    const bloqueListos = (await screen.findByRole('heading', { name: /Listos para entregar/ })).closest('section')
    const duplicada = within(bloqueListos).getByText('AA111BB').closest('li')
    expect(within(duplicada).getByText('Pago duplicado')).toBeInTheDocument()
    const normal = within(bloqueListos).getByText('EE555FF').closest('li')
    expect(within(normal).queryByText('Pago duplicado')).not.toBeInTheDocument()

    const bloqueSin = screen.getByRole('heading', { name: /Sin mecánico asignado/ }).closest('section')
    expect(within(bloqueSin).getByText('Pago duplicado')).toBeInTheDocument()
  })

  it('si falla una carga muestra el error y el resto del día', async () => {
    turnos.listar.mockRejectedValue(new Error('No se pudieron cargar los turnos.'))
    montar()
    expect(await screen.findByText('No se pudieron cargar los turnos.')).toBeInTheDocument()
    expect(screen.getByText('Listos para entregar')).toBeInTheDocument()
  })

  it('explica los vacíos cuando no hay nada para hoy', async () => {
    ordenes.listar.mockResolvedValue([])
    turnos.listar.mockResolvedValue([])
    repuestos.stockBajo.mockResolvedValue([])
    montar()

    expect(await screen.findByText('No hay turnos para hoy.')).toBeInTheDocument()
    expect(screen.getByText('No hay autos listos para entregar o cobrar.')).toBeInTheDocument()
  })
})

describe('Hoy — mecánico', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.usuario = { id: 5, nombre: 'Mario', apellido: 'Sosa', rol: 'mecanico' }
    repuestos.stockBajo.mockResolvedValue([])
  })

  it('lista solo sus órdenes abiertas, ordenadas por prioridad, y navega a la orden', async () => {
    const diagnostico = {
      ...ORDEN_LISTA,
      id: 20,
      estado: 'En diagnóstico',
      mecanico_id: 5,
      vehiculo_patente: 'DD444EE',
      cobro_estado: null,
      costo_final: null,
    }
    const ingresado = {
      ...ORDEN_LISTA,
      id: 21,
      estado: 'Ingresado',
      mecanico_id: 5,
      vehiculo_patente: 'EE555FF',
      cobro_estado: null,
      costo_final: null,
    }
    const ajena = { ...ingresado, id: 22, mecanico_id: 9, vehiculo_patente: 'FF666GG' }
    const cerrada = { ...diagnostico, id: 23, estado: 'Entregado' }
    ordenes.listar.mockResolvedValue([ingresado, ajena, cerrada, diagnostico])

    montar()

    expect(await screen.findByText('Mi trabajo')).toBeInTheDocument()
    expect(screen.queryByText('Turnos de hoy')).not.toBeInTheDocument()

    // "Ver todas" lleva al tablero filtrado por las órdenes del mecánico.
    expect(screen.getByRole('link', { name: 'Ver todas' })).toHaveAttribute(
      'href',
      '/ordenes?filtro=mias',
    )

    const filaDiagnostico = await screen.findByRole('button', { name: /DD444EE/ })
    const filaIngresado = screen.getByRole('button', { name: /EE555FF/ })
    expect(screen.queryByText('FF666GG')).not.toBeInTheDocument()

    // En diagnóstico va antes que Ingresado.
    expect(
      filaDiagnostico.compareDocumentPosition(filaIngresado) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    // La acción principal del mecánico es un botón propio en cada fila.
    expect(screen.getByRole('button', { name: 'Marcar listo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Empezar diagnóstico' })).toBeInTheDocument()

    // La fila abre la orden; la acción la abre con el paso ya iniciado.
    fireEvent.click(screen.getByRole('button', { name: 'Marcar listo' }))
    await waitFor(() =>
      expect(screen.getByTestId('ubicacion')).toHaveTextContent('/ordenes/20?accion=1'),
    )
  })

  it('si falla la carga muestra el error y Reintentar vuelve a pedir', async () => {
    ordenes.listar.mockRejectedValueOnce(new Error('Sin conexión.')).mockResolvedValue([])
    montar()
    expect(await screen.findByText('Sin conexión.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No tenés órdenes asignadas')).toBeInTheDocument()
    expect(ordenes.listar).toHaveBeenCalledTimes(2)
  })

  it('sin campos de dinero (MC1) no aparece "$", NaN ni undefined y Listo va al final', async () => {
    const sinDinero = (extra) => ({
      id: 40,
      estado: 'En diagnóstico',
      mecanico_id: 5,
      vehiculo_patente: 'HH888II',
      vehiculo_marca: 'Fiat',
      vehiculo_modelo: 'Cronos',
      cliente_nombre: 'Perez, Ana',
      descripcion: 'Frenos',
      fecha: HOY,
      ...extra,
    })
    ordenes.listar.mockResolvedValue([
      sinDinero({ id: 41, estado: 'Listo', vehiculo_patente: 'JJ999KK' }),
      sinDinero({}),
    ])
    const { container } = montar()

    const listo = await screen.findByRole('button', { name: /JJ999KK/ })
    const diagnostico = screen.getByRole('button', { name: /HH888II/ })
    expect(diagnostico.compareDocumentPosition(listo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('button', { name: /cobro/i })).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\$|NaN|undefined/)
  })

  it('sin órdenes asignadas muestra un vacío que lo explica', async () => {
    ordenes.listar.mockResolvedValue([])
    montar()

    expect(await screen.findByText('No tenés órdenes asignadas')).toBeInTheDocument()
  })

  it('el mecánico no ve el botón de cobro en una orden lista sin cobro', async () => {
    ordenes.listar.mockResolvedValue([
      {
        ...ORDEN_LISTA,
        id: 30,
        estado: 'Listo',
        mecanico_id: 5,
        vehiculo_patente: 'GG777HH',
        cobro_estado: null,
        costo_final: null,
        pagada: false,
      },
    ])
    montar()

    expect(await screen.findByRole('button', { name: /GG777HH/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cobro/i })).not.toBeInTheDocument()
  })
})
