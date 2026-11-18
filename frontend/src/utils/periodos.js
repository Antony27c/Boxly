import { aISO, sumarDias } from '@/utils/fechas'

function inicioDeMes(fecha, mesesAtras = 0) {
  const d = new Date(`${fecha}T12:00:00`)
  return aISO(new Date(d.getFullYear(), d.getMonth() - mesesAtras, 1, 12))
}

function inicioDeTrimestre(fecha) {
  const d = new Date(`${fecha}T12:00:00`)
  return aISO(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1, 12))
}

// Rangos predefinidos del Dashboard. `rango(hoy)` recibe la fecha de hoy en
// YYYY-MM-DD y devuelve { desde, hasta }, ambos extremos inclusive.
export const PRESETS = [
  {
    id: 'este_mes',
    texto: 'Este mes',
    rango: (hoy) => ({ desde: `${hoy.slice(0, 7)}-01`, hasta: hoy }),
  },
  {
    id: '30_dias',
    texto: 'Últimos 30 días',
    rango: (hoy) => ({ desde: sumarDias(hoy, -29), hasta: hoy }),
  },
  {
    id: 'trimestre',
    texto: 'Este trimestre',
    rango: (hoy) => ({ desde: inicioDeTrimestre(hoy), hasta: hoy }),
  },
  {
    id: '6_meses',
    texto: 'Últimos 6 meses',
    rango: (hoy) => ({ desde: inicioDeMes(hoy, 5), hasta: hoy }),
  },
]

// Días que abarca el rango contando ambos extremos (desde y hasta inclusive).
export function diasEntre(desde, hasta) {
  const ms = new Date(`${hasta}T12:00:00`) - new Date(`${desde}T12:00:00`)
  return Math.round(ms / 86400000) + 1
}

// Período de igual cantidad de días, inmediatamente antes del actual.
// Ej.: { 2026-11-01, 2026-11-17 } (17 días) -> { 2026-10-15, 2026-10-31 }.
export function rangoAnterior({ desde, hasta }) {
  const dias = diasEntre(desde, hasta)
  const hastaAnterior = sumarDias(desde, -1)
  return { desde: sumarDias(hastaAnterior, -(dias - 1)), hasta: hastaAnterior }
}

// Variación porcentual con 1 decimal. Si el período anterior fue 0 y el actual
// no, devuelve null (la pantalla muestra "nuevo"); si ambos son 0, devuelve 0.
export function variacion(actual, anterior) {
  const a = Number(actual ?? 0)
  const b = Number(anterior ?? 0)
  if (b === 0) return a > 0 ? null : 0
  return Math.round(((a - b) / Math.abs(b)) * 1000) / 10
}
