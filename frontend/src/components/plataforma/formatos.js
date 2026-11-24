// Formatos compartidos por las pantallas de plataforma (talleres).

import {
  esHoyEnTaller,
  fechaServidor,
  formatearFechaHora,
  formatearHora,
} from '@/lib/fechas'

export function numero(valor) {
  return Number(valor ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

// "hace 3 días" / "hace 2 horas" / "recién". Sin fecha devuelve "Nunca".
export function haceCuanto(fecha) {
  const entonces = fechaServidor(fecha)?.getTime()
  if (entonces == null) return fecha ? '—' : 'Nunca'
  const segundos = Math.max(0, Math.floor((Date.now() - entonces) / 1000))
  if (segundos < 60) return 'recién'
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const dias = Math.floor(horas / 24)
  if (dias < 30) return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`
  const anios = Math.floor(dias / 365)
  return `hace ${anios} ${anios === 1 ? 'año' : 'años'}`
}

// "17/11/2026, 18:30" para auditorías y vencimientos (hora de Argentina).
export function fechaHora(fecha) {
  return formatearFechaHora(fecha)
}

// Chip "Soporte hasta …": solo la hora si es hoy ("18:30"), fecha y hora si no.
export function etiquetaSoporte(hasta) {
  if (!fechaServidor(hasta)) return null
  return esHoyEnTaller(hasta) ? formatearHora(hasta) : formatearFechaHora(hasta)
}
