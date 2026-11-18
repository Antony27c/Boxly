import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useDashboard from '@/hooks/useDashboard'
import { diasEntre } from '@/utils/periodos'

const metricas = vi.hoisted(() => ({
  finanzas: vi.fn(),
  mecanicos: vi.fn(),
  mejorMecanico: vi.fn(),
}))
const ordenes = vi.hoisted(() => ({ listar: vi.fn() }))
const repuestos = vi.hoisted(() => ({ stockBajo: vi.fn() }))
const turnos = vi.hoisted(() => ({ listar: vi.fn() }))

vi.mock('@/services/metricas', () => ({ metricasService: metricas }))
vi.mock('@/services/ordenes', async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, ordenesService: { ...original.ordenesService, listar: ordenes.listar } }
})
vi.mock('@/services/repuestos', () => ({ repuestosService: repuestos }))
vi.mock('@/services/turnos', () => ({ turnosService: turnos }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: null, autenticado: true, cargandoSesion: false }),
}))

const RANGO = { desde: '2026-11-01', hasta: '2026-11-17' }
// rangoAnterior(RANGO) = { desde: '2026-10-15', hasta: '2026-10-31' }

const FINANZAS = {
  desde: RANGO.desde,
  hasta: RANGO.hasta,
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
    nombre: 'Pérez, Juan',
    ordenes_cerradas: 4,
    ordenes_en_curso: 1,
    tiempo_promedio_horas: 10,
    facturado: 90000,
  },
  {
    mecanico_id: 2,
    nombre: 'Gómez, Ana',
    ordenes_cerradas: 2,
    ordenes_en_curso: 0,
    tiempo_promedio_horas: 8,
    facturado: 50000,
  },
]

// Ya en el formato que devuelve ordenesService.listar (desdeApi aplicado).
const ORDENES = [
  { id: 1, estado: 'Listo', pagada: false, cobro_estado: 'aprobado', costo_final: 50000, mecanico_id: 1 },
  { id: 2, estado: 'Listo', pagada: false, cobro_estado: 'pendiente', costo_final: 30000, mecanico_id: 1 },
  { id: 3, estado: 'Ingresado', mecanico_id: null, mecanico: '' },
  { id: 4, estado: 'Pendiente', mecanico_id: null, mecanico: '' },
  { id: 5, estado: 'En diagnóstico', mecanico_id: 2, mecanico: 'Gómez, Ana' },
  { id: 6, estado: 'Esperando repuestos', mecanico_id: 2 },
  { id: 7, estado: 'Entregado', pagada: true, cobro_estado: 'aprobado', costo_final: 70000, mecanico_id: 1 },
]

function llamarFinanzas(rangoCallado) {
  return metricas.finanzas.mock.calls.find(
    ([params]) => params.desde === rangoCallado.desde && params.hasta === rangoCallado.hasta,
  )
}

describe('useDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    metricas.finanzas.mockResolvedValue(FINANZAS)
    metricas.mecanicos.mockResolvedValue(MECANICOS)
    metricas.mejorMecanico.mockResolvedValue({ mecanico: null })
    ordenes.listar.mockResolvedValue(ORDENES)
    repuestos.stockBajo.mockResolvedValue([{ id: 1 }, { id: 2 }])
    turnos.listar.mockResolvedValue([
      { id: 1, estado: 'confirmado' },
      { id: 2, estado: 'pendiente' },
      { id: 3, estado: 'cancelado' },
    ])
  })

  it('pide todos los bloques y calcula los derivados', async () => {
    const { result } = renderHook(() => useDashboard(RANGO))

    await waitFor(() => expect(result.current.bloques.finanzas.datos).not.toBeNull())
    await waitFor(() => expect(result.current.bloques.ordenes.datos).not.toBeNull())

    expect(metricas.mecanicos).toHaveBeenCalledWith(RANGO, 'tok')
    expect(metricas.mejorMecanico).toHaveBeenCalledWith(null, 'tok')
    expect(ordenes.listar).toHaveBeenCalledWith('tok')
    expect(repuestos.stockBajo).toHaveBeenCalledWith('tok')

    const { derivados } = result.current
    expect(derivados.porCobrar).toEqual({ monto: 50000, cantidad: 1 })
    expect(derivados.abiertasPorEtapa).toEqual([
      { etapa: 'Ingresado', cantidad: 1 },
      { etapa: 'En diagnóstico', cantidad: 1 },
      { etapa: 'Esperando repuestos', cantidad: 1 },
      { etapa: 'Listo', cantidad: 2 },
    ])
    expect(derivados.totalAbiertas).toBe(5)
    expect(derivados.porIngresar).toBe(1)
    expect(derivados.alertas).toEqual({
      cobrosPorAprobar: 1,
      stockBajo: 2,
      turnosSemana: 2,
      sinMecanico: 2,
    })
    expect(derivados.totales).toEqual({
      cerradas: 6,
      enCurso: 1,
      tiempoPromedio: 56 / 6,
      facturado: 140000,
      ticket: 140000 / 6,
    })
  })

  it('un error en stockBajo no afecta a finanzas ni a los derivados', async () => {
    repuestos.stockBajo.mockRejectedValue(new Error('falló stock'))
    const { result } = renderHook(() => useDashboard(RANGO))

    await waitFor(() => expect(result.current.bloques.stockBajo.error).toBe('falló stock'))
    await waitFor(() => expect(result.current.bloques.finanzas.datos).not.toBeNull())

    expect(result.current.derivados.porCobrar.cantidad).toBe(1)
    expect(result.current.derivados.alertas.stockBajo).toBe(0)
    expect(result.current.derivados.serieIngresos).toHaveLength(3)
  })

  it('pide finanzas con agrupar dia cuando el rango es de 31 días o menos', async () => {
    renderHook(() => useDashboard(RANGO))
    await waitFor(() => expect(metricas.finanzas).toHaveBeenCalledTimes(2))

    const actual = llamarFinanzas(RANGO)
    const anterior = llamarFinanzas({ desde: '2026-10-15', hasta: '2026-10-31' })
    expect(actual[0].agrupar).toBe('dia')
    expect(anterior[0].agrupar).toBeUndefined()
  })

  it('no pide agrupar cuando el rango supera los 31 días', async () => {
    const rangoLargo = { desde: '2026-06-01', hasta: '2026-11-17' }
    renderHook(() => useDashboard(rangoLargo))
    await waitFor(() => expect(metricas.finanzas).toHaveBeenCalled())

    const actual = llamarFinanzas(rangoLargo)
    expect(actual[0].agrupar).toBeUndefined()
  })

  it('usa la serie mensual cuando el backend no devuelve diario', async () => {
    const { result } = renderHook(() => useDashboard(RANGO))
    await waitFor(() => expect(result.current.derivados.serieIngresos).toHaveLength(3))

    expect(result.current.derivados.serieIngresos).toEqual([
      { etiqueta: 'sep', valor: 50000 },
      { etiqueta: 'oct', valor: 70000 },
      { etiqueta: 'nov', valor: 100000 },
    ])
    expect(result.current.derivados.ultimos3Meses).toHaveLength(3)
    expect(result.current.derivados.ultimos3Meses[2]).toEqual({
      etiqueta: 'nov 2026',
      valor: 100000,
      resaltado: true,
    })
  })

  it('usa la serie diaria cuando el backend la devuelve', async () => {
    metricas.finanzas.mockResolvedValue({
      ...FINANZAS,
      diario: [
        { fecha: '2026-11-05', ingresos: '1000.50' },
        { fecha: '2026-11-06', ingresos: 2000 },
      ],
    })
    const { result } = renderHook(() => useDashboard(RANGO))

    await waitFor(() => expect(result.current.derivados.serieIngresos).toHaveLength(2))
    expect(result.current.derivados.serieIngresos).toEqual([
      { etiqueta: '05 nov', valor: 1000.5 },
      { etiqueta: '06 nov', valor: 2000 },
    ])
  })

  it('pide los turnos de lunes a domingo de esta semana', async () => {
    renderHook(() => useDashboard(RANGO))
    await waitFor(() => expect(turnos.listar).toHaveBeenCalledTimes(1))

    const [rangoTurnos, token] = turnos.listar.mock.calls[0]
    expect(token).toBe('tok')
    expect(diasEntre(rangoTurnos.desde, rangoTurnos.hasta)).toBe(7)
    expect(new Date(`${rangoTurnos.desde}T12:00:00`).getDay()).toBe(1)
  })

  it('calcula variaciones contra el período anterior', async () => {
    metricas.finanzas.mockImplementation((params) =>
      Promise.resolve(
        params.desde === RANGO.desde
          ? { ...FINANZAS, ingresos: 120000, balance: 90000 }
          : { ...FINANZAS, ingresos: 100000, balance: 80000 },
      ),
    )
    const { result } = renderHook(() => useDashboard(RANGO))

    await waitFor(() => expect(result.current.derivados.variaciones.ingresos).toBe(20))
    expect(result.current.derivados.variaciones.balance).toBe(12.5)
    expect(result.current.derivados.variaciones.ticket).toBeNull()
  })

  it('recargarTodo vuelve a pedir todos los bloques', async () => {
    const { result } = renderHook(() => useDashboard(RANGO))
    await waitFor(() => expect(result.current.bloques.finanzas.datos).not.toBeNull())

    const llamadas = {
      finanzas: metricas.finanzas.mock.calls.length,
      mecanicos: metricas.mecanicos.mock.calls.length,
      ordenes: ordenes.listar.mock.calls.length,
    }
    await act(async () => {
      result.current.recargarTodo()
    })

    await waitFor(() =>
      expect(metricas.finanzas.mock.calls.length).toBeGreaterThan(llamadas.finanzas),
    )
    expect(metricas.mecanicos.mock.calls.length).toBeGreaterThan(llamadas.mecanicos)
    expect(ordenes.listar.mock.calls.length).toBeGreaterThan(llamadas.ordenes)
    expect(metricas.mejorMecanico.mock.calls.length).toBeGreaterThan(1)
  })
})
