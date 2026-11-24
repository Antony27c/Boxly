import { api } from '@/lib/api'

const RECURSO = '/api/v1/plataforma'

/* Planes y suscripciones del lado del superadmin (contrato en
   docs/Suscripciones.md, sección S1 → Plataforma). Montos en pesos con 2
   decimales; las fechas llegan como YYYY-MM-DD. */
export const suscripcionesPlataformaService = {
  // Planes: lista TODOS (activos e inactivos) para la página de edición.
  listarPlanes: (token) => api.get(`${RECURSO}/planes`, token),

  // Edita un plan: {nombre?, precio_mensual?, max_personal?, activo?,
  // funciones?}. El precio nuevo rige desde el próximo período de cada taller.
  actualizarPlan: (codigo, datos, token) => api.put(`${RECURSO}/planes/${codigo}`, datos, token),

  // Suscripción del taller: SuscripcionResponse + pagos (historial).
  obtenerSuscripcion: (tallerId, token) =>
    api.get(`${RECURSO}/talleres/${tallerId}/suscripcion`, token),

  // Cambio de plan: {plan: codigo}. 409 si el personal activo supera el límite.
  cambiarPlan: (tallerId, plan, token) =>
    api.put(`${RECURSO}/talleres/${tallerId}/plan`, { plan }, token),

  // Pago manual: {monto, meses (1-12, default 1), referencia?, fecha?}.
  registrarPago: (tallerId, datos, token) => api.post(`${RECURSO}/talleres/${tallerId}/pagos`, datos, token),

  // Ajuste manual del vencimiento (cortesía o corrección): {vence_en: YYYY-MM-DD}.
  ajustarVencimiento: (tallerId, vence_en, token) =>
    api.post(`${RECURSO}/talleres/${tallerId}/vencimiento`, { vence_en }, token),

  /* Tipo de acceso (C2, docs/Oferta.md): convierte demo/piloto en pago o
     pasa a piloto. Recibe {tipo: pago|piloto|demo, plan?, vence_en?,
     motivo?} según el destino; queda auditado. */
  cambiarAcceso: (tallerId, datos, token) =>
    api.post(`${RECURSO}/talleres/${tallerId}/acceso`, datos, token),

  /* Adicionales del taller (por ahora solo ARCA, docs/Oferta.md §4).
     Activar: {codigo, desde?, hasta?}; 409 si el plan ya incluye la función. */
  listarAdicionales: (tallerId, token) => api.get(`${RECURSO}/talleres/${tallerId}/adicionales`, token),

  activarAdicional: (tallerId, datos, token) =>
    api.post(`${RECURSO}/talleres/${tallerId}/adicionales`, datos, token),

  desactivarAdicional: (tallerId, codigo, token) =>
    api.del(`${RECURSO}/talleres/${tallerId}/adicionales/${codigo}`, token),
}
