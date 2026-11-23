import { api } from '@/lib/api'

const RECURSO = '/api/v1/taller'

// Los datos del taller cambian muy de vez en cuando y los usan varias
// pantallas a la vez (panel de control, ticket de cobro, portal del cliente):
// se piden una sola vez por sesión y quedan en cache a nivel módulo.
// `actualizar` pisa el cache con la respuesta del servidor, así el resto de la
// app ve los datos nuevos sin otra llamada; `obtener(token, true)` fuerza una
// lectura nueva (lo usa `recargar` del hook useTaller).
let cache = null
let enCurso = null
let version = 0

function pedir(token) {
  const mia = ++version
  const promesa = api
    .get(RECURSO, token)
    .then((datos) => {
      // Si mientras tanto hubo una actualización o una lectura más nueva,
      // esta respuesta ya quedó vieja: no pisa el cache.
      if (mia === version) cache = datos
      return datos
    })
    .finally(() => {
      if (enCurso === promesa) enCurso = null
    })
  enCurso = promesa
  return promesa
}

export const tallerService = {
  obtener: (token, forzar = false) => {
    if (!forzar) {
      if (cache) return Promise.resolve(cache)
      if (enCurso) return enCurso
    }
    return pedir(token)
  },

  // Actualización parcial: el llamador manda solo los campos que cambiaron.
  // La respuesta ya es el TallerResponse completo, así que renueva el cache.
  actualizar: (datos, token) => {
    version += 1
    return api.put(RECURSO, datos, token).then((actualizado) => {
      cache = actualizado
      return actualizado
    })
  },
}
