import { api } from '@/lib/api'

const RECURSO = '/api/v1/metricas'

// La API manda los montos como string decimal ("185000.00"): se pasan a número.
function normalizar(item) {
  return { ...item, facturado: Number(item.facturado ?? 0) }
}

function normalizarMes(mes) {
  return {
    mes: mes.mes,
    ingresos: Number(mes.ingresos ?? 0),
    egresos: Number(mes.egresos ?? 0),
    balance: Number(mes.balance ?? 0),
  }
}

export const metricasService = {
  mecanicos: ({ desde, hasta }, token) =>
    api
      .get(`${RECURSO}/mecanicos?${new URLSearchParams({ desde, hasta })}`, token)
      .then((lista) => lista.map(normalizar)),

  mejorMecanico: (trimestre, token) =>
    api
      .get(`${RECURSO}/mejor-mecanico${trimestre ? `?trimestre=${trimestre}` : ''}`, token)
      .then((datos) => ({ ...datos, mecanico: datos.mecanico ? normalizar(datos.mecanico) : null })),

  // Balance del período: ingresos, egresos por repuestos, cobrado online y detalle por mes.
  // `agrupar: 'dia'` (opcional) pide el detalle diario; si el backend todavía no
  // lo soporta, `diario` vuelve vacío y la pantalla usa la serie mensual.
  finanzas: ({ desde, hasta, agrupar }, token) => {
    const params = new URLSearchParams({ desde, hasta })
    if (agrupar) params.set('agrupar', agrupar)
    return api.get(`${RECURSO}/finanzas?${params}`, token).then((datos) => ({
      desde: datos.desde,
      hasta: datos.hasta,
      ingresos: Number(datos.ingresos ?? 0),
      cobrado_online: Number(datos.cobrado_online ?? 0),
      egresos_repuestos: Number(datos.egresos_repuestos ?? 0),
      balance: Number(datos.balance ?? 0),
      mensual: (datos.mensual ?? []).map(normalizarMes),
      diario: (datos.diario ?? []).map((dia) => ({
        fecha: dia.fecha,
        ingresos: Number(dia.ingresos ?? 0),
      })),
    }))
  },
}
