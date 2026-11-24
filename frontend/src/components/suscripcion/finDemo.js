// Fin de la demo (docs/Oferta.md): al vencer no hay gracia; quedan 3 días en
// solo lectura para elegir un plan y después el acceso se suspende.
import { diaMes, finAcceso } from './estados'

export const DIAS_PARA_ELEGIR = 3

export function esDemo(suscripcion) {
  return suscripcion?.tipo_acceso === 'demo'
}

/* Día en que terminó la demo (el vencimiento) y último día para elegir un plan
   (`fin_acceso` del backend, o el vencimiento + 3 mientras no venga). Recibe la
   suscripción; con solo el vencimiento (texto) usa el cálculo de respaldo. */
export function fechasFinDemo(suscripcionOVencimiento) {
  const suscripcion =
    typeof suscripcionOVencimiento === 'object' && suscripcionOVencimiento !== null
      ? { ...suscripcionOVencimiento, tipo_acceso: 'demo' }
      : { vence_en: suscripcionOVencimiento, tipo_acceso: 'demo' }
  const termino = diaMes(suscripcion.vence_en)
  if (termino === '—') return null
  return { termino, limite: diaMes(finAcceso(suscripcion)) }
}

/* Texto corto de la franja global para una demo vencida (sin "falta de pago":
   una demo no se paga); null si no es demo o todavía no venció. */
export function avisoDemoVencida(suscripcion) {
  if (!esDemo(suscripcion)) return null
  if (suscripcion.estado === 'suspendida') return 'Tu demo terminó. Elegí un plan para volver a usar Boxly.'
  if (suscripcion.estado !== 'solo_lectura') return null
  const fechas = fechasFinDemo(suscripcion)
  return fechas
    ? `Tu demo terminó. Tenés hasta el ${fechas.limite} para elegir un plan.`
    : 'Tu demo terminó. Elegí un plan para seguir usando Boxly.'
}

/* Frase de /suscripcion para una demo vencida; null si no es demo o si
   todavía no venció (entonces rige el texto de siempre). */
export function fraseDemoVencida(suscripcion) {
  if (!esDemo(suscripcion)) return null
  if (suscripcion.estado !== 'solo_lectura' && suscripcion.estado !== 'suspendida') return null
  const fechas = fechasFinDemo(suscripcion)
  if (!fechas) return null
  if (suscripcion.estado === 'suspendida') {
    return `Tu demo terminó el ${fechas.termino} y el acceso quedó suspendido. Elegí un plan para volver a usar Boxly.`
  }
  return `Tu demo terminó el ${fechas.termino}. Tenés hasta el ${fechas.limite} para elegir un plan.`
}
