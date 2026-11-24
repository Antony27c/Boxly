// Elección de plan del taller (/suscripcion y fin de la demo).
import { esErrorDePlanExcedido } from '@/services/suscripcion'
import { funcionesDePlan, ordenar } from '@/lib/funcionesPlan'
import { personalExcedido } from './estados'

// El plan que se recomienda y el de la demo (docs/Oferta.md: la demo es de Pro).
export const PLAN_RECOMENDADO = 'pro'
export const DIAS_DEMO = 14

// Las del taller: las del plan más los adicionales (funciones_efectivas), o las del plan.
export function funcionesDelTaller(suscripcion) {
  if (Array.isArray(suscripcion?.funciones_efectivas)) return ordenar(suscripcion.funciones_efectivas)
  return funcionesDePlan(suscripcion?.plan)
}

/* Qué deja de tener el taller si pasa a `plan`: las funciones que usa hoy
   (funciones_efectivas) que el plan nuevo no trae, sin contar los adicionales
   (siguen aunque cambie el plan), y cuántos del personal le sobran. Nada de
   listas fijas: sale de las funciones de la API. */
export function loQueSePierde(suscripcion, plan) {
  const adicionales = new Set((suscripcion?.adicionales ?? []).map((a) => a.codigo))
  const delPlanNuevo = new Set(funcionesDePlan(plan))
  const funciones = funcionesDelTaller(suscripcion).filter(
    (codigo) => !delPlanNuevo.has(codigo) && !adicionales.has(codigo),
  )
  const sobran = personalExcedido(suscripcion?.personal_activo, plan?.max_personal)
  return { funciones, sobran, hayPerdida: funciones.length > 0 || sobran > 0 }
}

/* El 409 del servidor ("Tu personal activo supera el límite de ese plan") no dice
   cuántos son ni qué hacer: con la suscripción a mano lo explicamos. */
export function mensajeErrorPlan(problema, plan, suscripcion) {
  if (!esErrorDePlanExcedido(problema)) return problema?.message
  const activos = suscripcion?.personal_activo
  if (activos == null || !plan?.max_personal) return problema.message
  return (
    `Tenés ${activos} personas activas en el personal y el plan ${plan.nombre} permite ` +
    `hasta ${plan.max_personal}. Desactivá a quien ya no trabaje en el taller desde ` +
    'Usuarios, o elegí un plan más grande.'
  )
}

export const AVISO_COBRO_NO_HABILITADO =
  'El débito automático todavía no está habilitado. Escribinos y te ayudamos.'
