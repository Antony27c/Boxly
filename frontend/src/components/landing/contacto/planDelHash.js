import { nombreDePlan } from '@/lib/funcionesPlan'

/* La sección Planes manda a "#contacto?plan=<codigo>": de ahí sale el plan
   para precargar el mensaje del formulario. */
export function planDelHash(hash) {
  const consulta = (hash ?? '').split('?')[1]
  if (!consulta) return null
  const plan = new URLSearchParams(consulta).get('plan')?.trim()
  return plan || null
}

export function mensajeDePlan(codigo) {
  return `Me interesa el plan ${nombreDePlan(codigo)}.`
}
