import { useCallback, useMemo } from 'react'
import useRecurso from '@/hooks/useRecurso'
import { metricasService } from '@/services/metricas'
import { ordenesService, estadoCobro } from '@/services/ordenes'
import { repuestosService } from '@/services/repuestos'
import { turnosService } from '@/services/turnos'
import { aISO, lunesDe, sumarDias } from '@/utils/fechas'
import { nombreMes } from '@/utils/formato'
import { diasEntre, rangoAnterior, variacion } from '@/utils/periodos'

// Etapas en las que el vehículo está físicamente en el taller, en el orden en
// que se muestran en el tablero. "Pendiente" no entra: el auto todavía no ingresó.
const ETAPAS_ABIERTAS = ['Ingresado', 'En diagnóstico', 'Esperando repuestos', 'Listo']

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// "2026-11-05" -> "05 nov"
function etiquetaCortaDia(fecha) {
  const [, mes, dia] = String(fecha ?? '')
    .slice(0, 10)
    .split('-')
  const nombre = MESES_CORTOS[Number(mes) - 1]
  return nombre && dia ? `${dia} ${nombre}` : String(fecha ?? '')
}

// "2026-11" -> "nov"
function etiquetaCortaMes(mes) {
  const numero = Number(String(mes ?? '').split('-')[1])
  return MESES_CORTOS[numero - 1] ?? String(mes ?? '')
}

/**
 * Datos del Dashboard: un bloque independiente por consulta (un error en uno no
 * rompe los demás) y un objeto `derivados` con todo lo que la pantalla calcula:
 * por cobrar, órdenes abiertas por etapa, alertas, totales del equipo,
 * variaciones contra el período anterior y las series para los gráficos.
 *
 * @param {{ desde: string, hasta: string }} rango fechas ISO, extremos inclusive
 */
export default function useDashboard(rango) {
  const desde = rango?.desde
  const hasta = rango?.hasta
  const rangoValido = Boolean(desde && hasta && desde <= hasta)

  // Con 31 días o menos el detalle diario entra en la curva de ingresos; si el
  // backend todavía no lo soporta, `diario` vuelve vacío y se usa `mensual`.
  const cargarFinanzas = useCallback(
    (token) => {
      if (!rangoValido) return Promise.resolve(null)
      const parametros = { desde, hasta }
      if (diasEntre(desde, hasta) <= 31) parametros.agrupar = 'dia'
      return metricasService.finanzas(parametros, token)
    },
    [desde, hasta, rangoValido],
  )

  const cargarFinanzasAnterior = useCallback(
    (token) =>
      rangoValido
        ? metricasService.finanzas(rangoAnterior({ desde, hasta }), token)
        : Promise.resolve(null),
    [desde, hasta, rangoValido],
  )

  const cargarMecanicos = useCallback(
    (token) =>
      rangoValido ? metricasService.mecanicos({ desde, hasta }, token) : Promise.resolve(null),
    [desde, hasta, rangoValido],
  )

  const cargarMejor = useCallback((token) => metricasService.mejorMecanico(null, token), [])
  const cargarOrdenes = useCallback((token) => ordenesService.listar(token), [])
  const cargarStockBajo = useCallback((token) => repuestosService.stockBajo(token), [])

  // Semana en curso: de lunes a domingo. No depende del rango elegido.
  const cargarTurnos = useCallback((token) => {
    const lunes = lunesDe(aISO(new Date()))
    return turnosService.listar({ desde: lunes, hasta: sumarDias(lunes, 6) }, token)
  }, [])

  const finanzas = useRecurso(cargarFinanzas)
  const finanzasAnterior = useRecurso(cargarFinanzasAnterior)
  const mecanicos = useRecurso(cargarMecanicos)
  const mejor = useRecurso(cargarMejor)
  const ordenes = useRecurso(cargarOrdenes)
  const stockBajo = useRecurso(cargarStockBajo)
  const turnos = useRecurso(cargarTurnos)

  const bloques = { finanzas, finanzasAnterior, mecanicos, mejor, ordenes, stockBajo, turnos }

  const ordenesDatos = ordenes.datos
  const mecanicosDatos = mecanicos.datos
  const finanzasDatos = finanzas.datos
  const finanzasAnteriorDatos = finanzasAnterior.datos
  const stockBajoDatos = stockBajo.datos
  const turnosDatos = turnos.datos

  const derivados = useMemo(() => {
    const listaOrdenes = ordenesDatos ?? []
    const listaMecanicos = mecanicosDatos ?? []
    const finanzasActual = finanzasDatos ?? null
    const finanzasPrevio = finanzasAnteriorDatos ?? null

    const porCobrarLista = listaOrdenes.filter((o) => estadoCobro(o) === 'aprobado')
    const porCobrar = {
      monto: porCobrarLista.reduce((suma, o) => suma + Number(o.costo_final ?? 0), 0),
      cantidad: porCobrarLista.length,
    }

    const abiertasPorEtapa = ETAPAS_ABIERTAS.map((etapa) => ({
      etapa,
      cantidad: listaOrdenes.filter((o) => o.estado === etapa).length,
    }))

    const alertas = {
      cobrosPorAprobar: listaOrdenes.filter((o) => estadoCobro(o) === 'pendiente').length,
      stockBajo: Array.isArray(stockBajoDatos) ? stockBajoDatos.length : 0,
      turnosSemana: (turnosDatos ?? []).filter((t) => t.estado !== 'cancelado').length,
      sinMecanico: listaOrdenes.filter(
        (o) =>
          (o.estado === 'Ingresado' || o.estado === 'Pendiente') &&
          !(o.mecanico_id || o.mecanico),
      ).length,
    }

    const cerradas = listaMecanicos.reduce((s, m) => s + (m.ordenes_cerradas ?? 0), 0)
    const horasTotales = listaMecanicos.reduce(
      (s, m) => s + (m.tiempo_promedio_horas ?? 0) * (m.ordenes_cerradas ?? 0),
      0,
    )
    const facturado = listaMecanicos.reduce((s, m) => s + (m.facturado ?? 0), 0)
    const totales = {
      cerradas,
      enCurso: listaMecanicos.reduce((s, m) => s + (m.ordenes_en_curso ?? 0), 0),
      tiempoPromedio: cerradas ? horasTotales / cerradas : null,
      facturado,
      ticket: cerradas ? facturado / cerradas : 0,
    }

    const variaciones = {
      ingresos:
        finanzasActual && finanzasPrevio
          ? variacion(finanzasActual.ingresos, finanzasPrevio.ingresos)
          : null,
      balance:
        finanzasActual && finanzasPrevio
          ? variacion(finanzasActual.balance, finanzasPrevio.balance)
          : null,
      // No se piden métricas de mecánicos del período anterior: sin la cantidad
      // de órdenes cerradas de ese período no hay ticket comparable.
      ticket: null,
    }

    let serieIngresos = []
    if (finanzasActual) {
      const diario = Array.isArray(finanzasActual.diario) ? finanzasActual.diario : []
      serieIngresos = diario.length
        ? diario.map((d) => ({ etiqueta: etiquetaCortaDia(d.fecha), valor: Number(d.ingresos ?? 0) }))
        : (finanzasActual.mensual ?? []).map((m) => ({
            etiqueta: etiquetaCortaMes(m.mes),
            valor: Number(m.ingresos ?? 0),
          }))
    }

    const ultimos3Meses = (finanzasActual?.mensual ?? [])
      .slice(-3)
      .map((m, indice, lista) => ({
        etiqueta: nombreMes(m.mes),
        valor: Number(m.ingresos ?? 0),
        resaltado: indice === lista.length - 1,
      }))

    return {
      porCobrar,
      abiertasPorEtapa,
      totalAbiertas: abiertasPorEtapa.reduce((s, e) => s + e.cantidad, 0),
      porIngresar: listaOrdenes.filter((o) => o.estado === 'Pendiente').length,
      alertas,
      totales,
      variaciones,
      serieIngresos,
      ultimos3Meses,
    }
  }, [
    ordenesDatos,
    mecanicosDatos,
    finanzasDatos,
    finanzasAnteriorDatos,
    stockBajoDatos,
    turnosDatos,
  ])

  function recargarTodo() {
    finanzas.recargar()
    finanzasAnterior.recargar()
    mecanicos.recargar()
    mejor.recargar()
    ordenes.recargar()
    stockBajo.recargar()
    turnos.recargar()
  }

  return {
    bloques,
    derivados,
    recargarTodo,
    rango: rangoValido ? { desde, hasta } : null,
  }
}
