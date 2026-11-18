import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from '@/pages/Dashboard'
import { COLUMNAS_DASHBOARD } from '@/utils/exportarCsv'
import { aISO, sumarDias } from '@/utils/fechas'

const useDashboardMock = vi.hoisted(() => vi.fn())
const exportarCsvMock = vi.hoisted(() => vi.fn())
const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useDashboard', () => ({ default: useDashboardMock }))
vi.mock('@/utils/exportarCsv', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, exportarCsv: exportarCsvMock }
})
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Admin', apellido: 'Jefe', email: 'a@b.c', rol: 'admin' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => navigateMock }
})

const HOY = aISO(new Date())

const FINANZAS = {
  desde: '2026-11-01',
  hasta: HOY,
  ingresos: 100000,
  cobrado_online: 40000,
  egresos_repuestos: 20000,
  balance: 80000,
  mensual: [
    { mes: '2026-09', ingresos: 50000, egresos: 10000, balance: 40000 },
    { mes: '2026-10', ingresos: 70000, egresos: 15000, balance: 55000 },
    { mes: '2026-11', ingresos: 100000, egresos: 20000, balance: 80000 },
  ],
  diario: [],
}

const MECANICOS = [
  {
    mecanico_id: 1,
    nombre: 'Ana García',
    ordenes_cerradas: 5,
    ordenes_en_curso: 2,
    tiempo_promedio_horas: 10,
    facturado: 100000,
  },
  {
    mecanico_id: 2,
    nombre: 'Beto López',
    ordenes_cerradas: 2,
    ordenes_en_curso: 1,
    tiempo_promedio_horas: 4,
    facturado: 50000,
  },
]

const ORDENES = [
  { id: 1, estado: 'Ingresado', costo_final: null, vehiculo_id: 1 },
  { id: 2, estado: 'En diagnóstico', costo_final: null, vehiculo_id: 2 },
  { id: 3, estado: 'Esperando repuestos', costo_final: null, vehiculo_id: 3 },
  { id: 4, estado: 'Listo', costo_final: 30000, vehiculo_id: 4 },
]

function bloque(datos, extra = {}) {
  return { datos, cargando: false, error: '', recargar: vi.fn(), ...extra }
}

function hacerDashboard({ alertas, ordenesError = '' } = {}) {
  const finanzas = bloque(FINANZAS)
  return {
    bloques: {
      finanzas,
      finanzasAnterior: bloque({ ...FINANZAS, ingresos: 50000, balance: 40000 }),
      mecanicos: bloque(MECANICOS),
      mejor: bloque({
        trimestre: '2026-T4',
        mecanico: {
          mecanico_id: 9,
          nombre: 'Carla Díaz',
          ordenes_cerradas: 8,
          ordenes_en_curso: 0,
          tiempo_promedio_horas: 6,
          facturado: 200000,
        },
        criterio: 'Más facturado',
      }),
      ordenes: bloque(ORDENES, { error: ordenesError }),
      stockBajo: bloque([]),
      turnos: bloque([]),
    },
    derivados: {
      porCobrar: { monto: 30000, cantidad: 1 },
      abiertasPorEtapa: [
        { etapa: 'Ingresado', cantidad: 1 },
        { etapa: 'En diagnóstico', cantidad: 1 },
        { etapa: 'Esperando repuestos', cantidad: 1 },
        { etapa: 'Listo', cantidad: 1 },
      ],
      totalAbiertas: 4,
      porIngresar: 0,
      alertas: alertas ?? {
        cobrosPorAprobar: 3,
        stockBajo: 0,
        turnosSemana: 2,
        sinMecanico: 0,
      },
      totales: {
        cerradas: 7,
        enCurso: 3,
        tiempoPromedio: 8,
        facturado: 150000,
        ticket: 21428.57,
      },
      variaciones: { ingresos: 100, balance: 100, ticket: null },
      serieIngresos: [
        { etiqueta: '01 nov', valor: 40000 },
        { etiqueta: '02 nov', valor: 60000 },
      ],
      ultimos3Meses: [
        { etiqueta: 'sep 2026', valor: 50000, resaltado: false },
        { etiqueta: 'oct 2026', valor: 70000, resaltado: false },
        { etiqueta: 'nov 2026', valor: 100000, resaltado: true },
      ],
    },
    recargarTodo: vi.fn(),
    rango: { desde: '2026-11-01', hasta: HOY },
  }
}

function tarjeta(titulo) {
  return screen.getByText(titulo).closest('section')
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDashboardMock.mockImplementation(() => hacerDashboard())
  })

  it('muestra el saludo con el nombre y las tarjetas con los datos', async () => {
    renderDashboard()
    const hora = new Date().getHours()
    const saludo = hora < 13 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'
    expect(screen.getByRole('heading', { name: `${saludo}, Admin` })).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Balance del período')).toBeInTheDocument())
    expect(within(tarjeta('Balance del período')).getByText('80.000')).toBeInTheDocument()
    expect(within(tarjeta('Taller ahora')).getByText('autos en el taller')).toBeInTheDocument()
    expect(within(tarjeta('Taller ahora')).getByRole('img', { name: /: 4 autos en el taller/ })).toBeInTheDocument()
    expect(within(tarjeta('Ticket promedio')).getByText(/21\.429/)).toBeInTheDocument()
    expect(screen.getByText('Mejor mecánico del trimestre · 2026-T4')).toBeInTheDocument()
  })

  it('cambiar de preset vuelve a pedir los datos con el nuevo rango', async () => {
    renderDashboard()
    await waitFor(() => expect(useDashboardMock).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Últimos 30 días' }))

    await waitFor(() => {
      const ultimo = useDashboardMock.mock.calls.at(-1)[0]
      expect(ultimo).toEqual({ desde: sumarDias(HOY, -29), hasta: HOY })
    })
  })

  it('un error en un bloque muestra Reintentar en esa tarjeta y las demás siguen', async () => {
    useDashboardMock.mockImplementation(() =>
      hacerDashboard({ ordenesError: 'No se pudieron cargar las órdenes' }),
    )
    renderDashboard()

    await waitFor(() =>
      expect(screen.getByText('No se pudieron cargar las órdenes')).toBeInTheDocument(),
    )
    const reintentar = screen.getAllByRole('button', { name: 'Reintentar' })
    expect(reintentar).toHaveLength(1)

    // Las tarjetas que no dependen de órdenes siguen mostrando datos.
    expect(within(tarjeta('Balance del período')).getByText('80.000')).toBeInTheDocument()
    expect(within(tarjeta('Facturación')).getByText('100.000')).toBeInTheDocument()

    fireEvent.click(reintentar[0])
    const { bloques } = useDashboardMock.mock.results.at(-1).value
    expect(bloques.ordenes.recargar).toHaveBeenCalledTimes(1)
  })

  it('muestra solo los chips de alerta con valor y sus destinos', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('3 cobros por aprobar')).toBeInTheDocument())

    expect(screen.getByRole('link', { name: /3 cobros por aprobar/ })).toHaveAttribute(
      'href',
      '/ordenes?filtro=cobro_pendiente',
    )
    expect(screen.getByRole('link', { name: /2 turnos esta semana/ })).toHaveAttribute(
      'href',
      '/turnos',
    )
    expect(screen.queryByText(/repuesto con stock bajo/)).not.toBeInTheDocument()
    expect(screen.queryByText(/sin mecánico/)).not.toBeInTheDocument()
  })

  it('sin alertas muestra "Todo en orden"', async () => {
    useDashboardMock.mockImplementation(() =>
      hacerDashboard({
        alertas: { cobrosPorAprobar: 0, stockBajo: 0, turnosSemana: 0, sinMecanico: 0 },
      }),
    )
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Todo en orden')).toBeInTheDocument())
  })

  it('Exportar llama a exportarCsv con el nombre del período', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }))

    expect(exportarCsvMock).toHaveBeenCalledTimes(1)
    const [nombre, columnas, filas] = exportarCsvMock.mock.calls[0]
    expect(nombre).toMatch(/^boxly-resumen-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(columnas).toBe(COLUMNAS_DASHBOARD)
    expect(Array.isArray(filas)).toBe(true)
    expect(filas.length).toBeGreaterThan(0)
  })

  it('Equipo ordena por la métrica elegida', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Ana García')).toBeInTheDocument())

    const equipo = tarjeta('Equipo')
    const ordenInicial = within(equipo)
      .getAllByText(/Ana García|Beto López/)
      .map((el) => el.textContent)
    expect(ordenInicial).toEqual(['Ana García', 'Beto López'])

    fireEvent.click(screen.getByRole('button', { name: /Tiempo promedio/ }))

    await waitFor(() => {
      const ordenNuevo = within(equipo)
        .getAllByText(/Ana García|Beto López/)
        .map((el) => el.textContent)
      expect(ordenNuevo).toEqual(['Beto López', 'Ana García'])
    })
  })
})
