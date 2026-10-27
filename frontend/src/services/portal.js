import { api } from '@/lib/api'

export const ESTADOS_PAGABLES = ['listo', 'entregado']

export function puedePagar(orden) {
  return ESTADOS_PAGABLES.includes(orden.estado) && Number(orden.costo_final ?? 0) > 0 && !orden.pagada
}

export const portalService = {
  misOrdenes: (token) => api.get('/api/v1/mis-ordenes', token),
}

export const pagosService = {
  crear: (ordenId, token) => api.post(`/api/v1/pagos/ordenes/${ordenId}`, undefined, token),
  obtener: (pagoId, token) => api.get(`/api/v1/pagos/${pagoId}`, token),
  confirmar: (pagoId, paymentId, token) =>
    api.post(`/api/v1/pagos/${pagoId}/confirmar`, { payment_id: paymentId }, token),
  simular: (pagoId, estado, token) => api.post(`/api/v1/pagos/${pagoId}/simular`, { estado }, token),
}
