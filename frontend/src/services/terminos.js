import { api } from '@/lib/api'

const RECURSO = '/api/v1/terminos'

/* Estado de los términos una vez por sesión: el primero que pregunta (la
   guardia o la página) dispara el único GET y el resto recibe lo mismo.
   `aceptar` actualiza el estado con la respuesta del servidor, así la guardia
   deja de redirigir sin volver a pedir nada. El caché se indexa por token:
   si cambia el usuario logueado se vuelve a pedir. */
let estado = null
let estadoToken = null
const pendientes = new Map()

export const terminosService = {
  obtener: (token) => {
    if (estado && estadoToken === token) return Promise.resolve(estado)
    if (!pendientes.has(token)) {
      pendientes.set(
        token,
        api
          .get(RECURSO, token)
          .then((datos) => {
            estado = datos
            estadoToken = token
            return datos
          })
          .finally(() => pendientes.delete(token)),
      )
    }
    return pendientes.get(token)
  },

  aceptar: async (token) => {
    const datos = await api.post(`${RECURSO}/aceptar`, {}, token)
    estado = datos
    estadoToken = token
    return datos
  },

  // Última respuesta conocida de la sesión (null si todavía no se pidió).
  estado: () => estado,
}
