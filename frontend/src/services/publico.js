import { api } from '@/lib/api'

// Rutas públicas de Boxly (sin sesión ni token). Contrato en docs/Landing.md.

// Planes activos ordenados por precio:
// [{codigo, nombre, precio_mensual, max_personal, funciones}].
export const obtenerPlanesPublicos = () => api.get('/api/v1/publico/planes')
