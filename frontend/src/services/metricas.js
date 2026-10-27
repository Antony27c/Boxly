import { api } from '@/lib/api'

const RECURSO = '/api/v1/metricas'

function normalizar(item) {
  return { ...item, facturado: Number(item.facturado ?? 0) }
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
}
