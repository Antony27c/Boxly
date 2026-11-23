import { api } from '@/lib/api'

// Rutas públicas de Boxly (sin sesión ni token). Contrato en docs/Landing.md.
export const publicoService = {
  // Planes activos ordenados por precio: [{codigo, nombre, precio_mensual, max_personal}].
  obtenerPlanesPublicos: () => api.get('/api/v1/publico/planes'),
}

export const obtenerPlanesPublicos = publicoService.obtenerPlanesPublicos
