import { CODIGOS_ERROR, api, tieneCodigo } from '@/lib/api'

const RECURSO = '/api/v1/suscripcion'

/* Suscripción del taller (contrato en docs/Suscripciones.md, S1 y S2).
   El GET es visible para todo el personal (el aviso global lo usa);
   el resto de las acciones son del administrador. */
export const suscripcionService = {
  obtener: (token) => api.get(RECURSO, token),

  planes: (token) => api.get(`${RECURSO}/planes`, token),

  // { plan: codigo } → SuscripcionResponse. El precio nuevo rige desde el
  // próximo período; si el personal activo supera el límite del plan, 409.
  cambiarPlan: (plan, token) => api.put(`${RECURSO}/plan`, { plan }, token),

  pagos: (token) => api.get(`${RECURSO}/pagos`, token),

  // Devuelve { init_point } de Mercado Pago para redirigir al administrador.
  activarCobro: (token) => api.post(`${RECURSO}/cobro-automatico`, {}, token),

  cancelarCobro: (token) => api.del(`${RECURSO}/cobro-automatico`, token),
}

// 409 de /users al crear o reactivar personal por encima del plan. Otros 409
// de /users (correo repetido, cuenta ya activa) no traen este código.
export function esErrorDeLimite(problema) {
  return tieneCodigo(problema, CODIGOS_ERROR.limitePersonal)
}

// 409 de PUT /suscripcion/plan: el personal activo no entra en el plan elegido.
export function esErrorDePlanExcedido(problema) {
  return tieneCodigo(problema, CODIGOS_ERROR.planPersonalExcedido)
}
