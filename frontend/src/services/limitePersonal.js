import { api } from '@/lib/api'

const RECURSO = '/api/v1/suscripcion'

/* Lo mínimo que necesita Usuarios del contrato de suscripciones
   (docs/Suscripciones.md): el estado del plan para el contador de personal.
   Va aparte del servicio de suscripción (S6) para no pisar ese trabajo. */
export const limitePersonalService = {
  obtener: (token) => api.get(RECURSO, token),
}

// El 409 del tope de personal llega con este texto del contrato; otros 409 de
// /users (correo repetido, cuenta ya activa) tienen otro mensaje.
export function esErrorDeLimite(problema) {
  return problema?.status === 409 && /plan permite hasta/i.test(problema?.message ?? '')
}
