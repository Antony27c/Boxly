// Fin de la demo (docs/Oferta.md): al vencer no hay gracia; quedan 3 días en
// solo lectura para elegir un plan y después el acceso se suspende.
export const DIAS_PARA_ELEGIR = 3

export function esDemo(suscripcion) {
  return suscripcion?.tipo_acceso === 'demo'
}

// "23/12" a partir de "2026-12-23" (sin pasar por la zona horaria).
function diaMes(fecha) {
  return `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

function aFecha(iso) {
  if (!iso) return null
  const fecha = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

// Día en que terminó la demo (el vencimiento) y último día para elegir un plan.
export function fechasFinDemo(venceEn) {
  const fin = aFecha(venceEn)
  if (!fin) return null
  const limite = new Date(fin)
  limite.setDate(limite.getDate() + DIAS_PARA_ELEGIR)
  return { termino: diaMes(fin), limite: diaMes(limite) }
}

/* Texto corto de la franja global para una demo vencida (sin "falta de pago":
   una demo no se paga); null si no es demo o todavía no venció. */
export function avisoDemoVencida(suscripcion) {
  if (!esDemo(suscripcion)) return null
  if (suscripcion.estado === 'suspendida') return 'Tu demo terminó. Elegí un plan para volver a usar Boxly.'
  if (suscripcion.estado !== 'solo_lectura') return null
  const fechas = fechasFinDemo(suscripcion.vence_en)
  return fechas
    ? `Tu demo terminó. Tenés hasta el ${fechas.limite} para elegir un plan.`
    : 'Tu demo terminó. Elegí un plan para seguir usando Boxly.'
}

/* Frase de /suscripcion para una demo vencida; null si no es demo o si
   todavía no venció (entonces rige el texto de siempre). */
export function fraseDemoVencida(suscripcion) {
  if (!esDemo(suscripcion)) return null
  if (suscripcion.estado !== 'solo_lectura' && suscripcion.estado !== 'suspendida') return null
  const fechas = fechasFinDemo(suscripcion.vence_en)
  if (!fechas) return null
  if (suscripcion.estado === 'suspendida') {
    return `Tu demo terminó el ${fechas.termino} y el acceso quedó suspendido. Elegí un plan para volver a usar Boxly.`
  }
  return `Tu demo terminó el ${fechas.termino}. Tenés hasta el ${fechas.limite} para elegir un plan.`
}
