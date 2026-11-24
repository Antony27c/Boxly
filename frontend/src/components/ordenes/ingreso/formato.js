/* Constantes y formateos compartidos por las partes del ingreso rápido. */

export { PATENTE } from '@/utils/validation'

export const MENSAJE_FORMATO_PATENTE = 'Formato válido: AAA123 o AA123AA.'
export const COMENTARIO_INGRESO = 'Auto recibido en el taller.'
export const SUGERENCIAS_TRABAJO = [
  'Service',
  'Frenos',
  'Ruido en tren delantero',
  'No arranca',
  'Revisión general',
]

export function normalizarPatente(texto) {
  return String(texto ?? '')
    .toUpperCase()
    .replace(/[\s-]/g, '')
}

export function normalizarNombre(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function nombrePersona(persona) {
  if (!persona) return ''
  return [persona.apellido, persona.nombre].filter(Boolean).join(', ')
}

export function detalleVehiculo(vehiculo) {
  const base = `${vehiculo.marca ?? ''} ${vehiculo.modelo ?? ''}`.trim()
  return [base, vehiculo.anio].filter(Boolean).join(' · ')
}
