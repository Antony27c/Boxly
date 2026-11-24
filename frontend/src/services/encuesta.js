import { api } from '@/lib/api'

// Encuesta de fin de demo (docs/Oferta.md, "Encuesta de fin de demo").
const RECURSO = '/api/v1/suscripcion/encuesta'
const PLATAFORMA = '/api/v1/plataforma/encuestas'

export const POR_PAGINA = 20

/* Estado de la encuesta del taller: { corresponde, respondida }. `corresponde`
   es true si el taller es demo, ya venció y todavía no respondió ni salteó. */
export function obtenerEstadoEncuesta(token) {
  return api.get(RECURSO, token)
}

/* Respuestas (todas opcionales): { gusto, mejoras, sugerencias, puntaje (1-5),
   intencion (contratar | tal_vez | no) }. Una sola vez por taller: 409 si ya
   respondió o salteó. */
export function responderEncuesta(datos, token) {
  return api.post(RECURSO, datos, token)
}

// "Ahora no": queda registrada como salteada y no se vuelve a mostrar.
export function saltearEncuesta(token) {
  return api.post(RECURSO, { salteada: true }, token)
}

// Filtros del listado y el nombre del parámetro que espera el servidor.
const PARAMETROS_FILTRO = {
  intencion: 'intencion',
  tallerId: 'taller_id',
  puntajeMin: 'puntaje_min',
  desde: 'desde', // AAAA-MM-DD, inclusive
  hasta: 'hasta', // AAAA-MM-DD, inclusive
}

/* Listado del superadmin: todos los filtros van al servidor y la página
   arranca en 1. Devuelve { items, total } con el total de X-Total-Count. */
export function listarEncuestas({ pagina = 1, porPagina = POR_PAGINA, ...filtros } = {}, token) {
  const params = new URLSearchParams()
  params.set('limit', porPagina)
  params.set('offset', (Math.max(1, pagina) - 1) * porPagina)
  for (const [clave, parametro] of Object.entries(PARAMETROS_FILTRO)) {
    const valor = filtros[clave]
    if (valor !== undefined && valor !== null && valor !== '') params.set(parametro, valor)
  }
  return api.getConTotal(`${PLATAFORMA}?${params.toString()}`, token)
}

/* Lo que decidió la guardia en esta sesión, indexado por token: la redirección
   a /gracias pasa una sola vez aunque la persona salga sin responder. */
const redirigidos = new Set()
const consultas = new Map()

export function yaRedirigido(token) {
  return redirigidos.has(token)
}

export function marcarRedirigido(token) {
  redirigidos.add(token)
}

// Un solo GET por sesión para la guardia; si falla se puede volver a pedir.
export function estadoEncuestaDeLaSesion(token) {
  if (!consultas.has(token)) {
    consultas.set(
      token,
      obtenerEstadoEncuesta(token).catch((error) => {
        consultas.delete(token)
        throw error
      }),
    )
  }
  return consultas.get(token)
}

// Respondida o salteada: la guardia ya no tiene nada que hacer en esta sesión.
export function marcarEncuestaResuelta(token) {
  redirigidos.add(token)
  consultas.set(token, Promise.resolve({ corresponde: false, respondida: true }))
}

// Para los tests.
export function reiniciarEncuesta() {
  redirigidos.clear()
  consultas.clear()
}

export const encuestaService = {
  obtenerEstadoEncuesta,
  responderEncuesta,
  saltearEncuesta,
  listarEncuestas,
}
