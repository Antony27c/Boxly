import { api } from '@/lib/api'
import { historialDesdeApi, imagenDesdeApi, nombreEstado } from '@/services/ordenes'

export const ESTADOS_PAGABLES = ['listo', 'entregado']

export function puedePagar(orden) {
  return ESTADOS_PAGABLES.includes(orden.estado) && Number(orden.costo_final ?? 0) > 0 && !orden.pagada
}

// El detalle llega con estados en código; la línea de tiempo los espera con nombre.
function detalleDesdeApi(orden) {
  return {
    ...orden,
    historial: (orden.historial ?? []).map(historialDesdeApi),
    imagenes: (orden.imagenes ?? []).map(imagenDesdeApi),
    pasos: (orden.pasos ?? []).map((paso) => ({ ...paso, nombre: paso.nombre ?? nombreEstado(paso.codigo) })),
  }
}

export const portalService = {
  misVehiculos: (token) => api.get('/api/v1/mis-vehiculos', token),
  misOrdenes: (token) => api.get('/api/v1/mis-ordenes', token),
  miOrden: (id, token) => api.get(`/api/v1/mis-ordenes/${id}`, token).then(detalleDesdeApi),
}

export const pagosService = {
  crear: (ordenId, token) => api.post(`/api/v1/pagos/ordenes/${ordenId}`, undefined, token),
  obtener: (pagoId, token) => api.get(`/api/v1/pagos/${pagoId}`, token),
  confirmar: (pagoId, paymentId, token) =>
    api.post(`/api/v1/pagos/${pagoId}/confirmar`, { payment_id: paymentId }, token),
  simular: (pagoId, estado, token) => api.post(`/api/v1/pagos/${pagoId}/simular`, { estado }, token),
}
