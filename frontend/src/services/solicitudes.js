import { api } from '@/lib/api'

// Solicitudes de demo de la landing (docs/Landing.md, "Backend público").
const CONTACTO = '/api/v1/publico/contacto'
const RECURSO = '/api/v1/plataforma/solicitudes'

export const POR_PAGINA = 20

/* Formulario público "Pedí una demo": va sin token. El backend responde
   201 { ok: true }, o 429 si la misma IP mandó demasiadas en la hora. */
export function enviarContacto(datos) {
  return api.post(CONTACTO, datos)
}

/* Listado del superadmin: filtro por estado y página (1 en adelante).
   Devuelve { items, total } con el total del header X-Total-Count. */
export function listarSolicitudes({ estado, pagina = 1, porPagina = POR_PAGINA } = {}, token) {
  const params = new URLSearchParams()
  params.set('limit', porPagina)
  params.set('offset', (Math.max(1, pagina) - 1) * porPagina)
  if (estado) params.set('estado', estado)
  return api.getConTotal(`${RECURSO}?${params.toString()}`, token)
}

// Cambio de estado (nueva | contactada | convertida | descartada) con nota opcional.
export function actualizarSolicitud(id, { estado, nota }, token) {
  const cuerpo = { estado }
  if (nota !== undefined) cuerpo.nota = nota
  return api.patch(`${RECURSO}/${id}`, cuerpo, token)
}

export const solicitudesService = { enviarContacto, listarSolicitudes, actualizarSolicitud }
