// Fechas y horas que llegan del servidor. El backend guarda los datetime en
// UTC (SQLite, func.now()) y los serializa sin zona ("2026-11-23T21:30:00").
// `new Date()` los tomaría como hora local y los correría 3 horas en
// Argentina: acá se interpretan como UTC y se muestran en hora del taller.

export const ZONA_TALLER = 'America/Argentina/Buenos_Aires'

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/
const TIENE_ZONA = /(?:[zZ]|[+-]\d{2}:?\d{2})$/

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_TALLER,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_TALLER,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const FORMATO_HORA = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_TALLER,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const FORMATO_DIA_MES = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_TALLER,
  day: '2-digit',
  month: '2-digit',
})

const FORMATO_FECHA_CORTA = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_TALLER,
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

// Día calendario en hora del taller, "YYYY-MM-DD" (para comparar "es hoy").
const FORMATO_DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_TALLER,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/* Date del valor del servidor, o null si no se puede leer.
   - ISO sin zona al final → es UTC (así lo guarda el servidor).
   - ISO con Z u offset → se respeta la zona que trae.
   - Fecha sola (YYYY-MM-DD) → día calendario, sin conversión de zona. */
export function fechaServidor(valor) {
  if (valor == null) return null
  const texto = String(valor).trim()
  if (!texto) return null
  if (SOLO_FECHA.test(texto)) {
    const [anio, mes, dia] = texto.split('-').map(Number)
    return new Date(anio, mes - 1, dia, 12)
  }
  const iso = TIENE_ZONA.test(texto) ? texto : `${texto}Z`
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

// "23/11/2026, 18:30" — fecha y hora del instante en hora de Argentina.
export function formatearFechaHora(valor) {
  const fecha = fechaServidor(valor)
  return fecha ? FORMATO_FECHA_HORA.format(fecha) : '—'
}

/* "23/11/2026" — el día en hora de Argentina. Una fecha sola se muestra tal
   cual vino (sin correr de día); un datetime se corre a la fecha local. */
export function formatearFecha(valor) {
  const texto = valor == null ? '' : String(valor).trim()
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)
  if (soloFecha) return `${soloFecha[3]}/${soloFecha[2]}/${soloFecha[1]}`
  const fecha = fechaServidor(valor)
  return fecha ? FORMATO_FECHA.format(fecha) : '—'
}

// "18:30" — solo la hora del instante en hora de Argentina.
export function formatearHora(valor) {
  const fecha = fechaServidor(valor)
  return fecha ? FORMATO_HORA.format(fecha) : '—'
}

/* "Hoy" del taller, YYYY-MM-DD en hora de Argentina, sin importar la zona
   del navegador (un dueño de viaje en España a las 22:00 de acá sigue en el
   mismo día que el taller). Todo "hoy" de la app sale de acá. */
export function hoyAR(ahora = new Date()) {
  return FORMATO_DIA.format(ahora)
}

// ¿El instante del servidor cae en el día de hoy (hora de Argentina)?
export function esHoyEnTaller(valor) {
  const fecha = fechaServidor(valor)
  return fecha != null && FORMATO_DIA.format(fecha) === hoyAR()
}

// "23/11" — día y mes en hora de Argentina.
export function formatearDiaMes(valor) {
  const fecha = fechaServidor(valor)
  return fecha ? FORMATO_DIA_MES.format(fecha) : '—'
}

// "23/11/26" — fecha corta (sello de service de la libreta).
export function formatearFechaCorta(valor) {
  const fecha = fechaServidor(valor)
  return fecha ? FORMATO_FECHA_CORTA.format(fecha) : '—'
}

/* "3 de noviembre de 2026" — fecha larga en letra. Acepta un Date (por ej.
   "ahora") o un valor del servidor con las mismas reglas que fechaServidor.
   `diaSemana` agrega el día ("martes, 3 de …") y `anio: false` lo saca. */
const formatosLarga = {}
function formatoFechaLarga(diaSemana, anio) {
  const clave = `${diaSemana}-${anio}`
  formatosLarga[clave] ??= new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_TALLER,
    ...(diaSemana ? { weekday: 'long' } : {}),
    day: 'numeric',
    month: 'long',
    ...(anio ? { year: 'numeric' } : {}),
  })
  return formatosLarga[clave]
}

export function formatearFechaLarga(valor, { diaSemana = false, anio = true } = {}) {
  const fecha = valor instanceof Date ? valor : fechaServidor(valor)
  if (!fecha || Number.isNaN(fecha.getTime())) return '—'
  return formatoFechaLarga(diaSemana, anio).format(fecha)
}

/* "2026-11-23" — el día calendario del valor en hora de Argentina, o null.
   Sirve para campos que son un día (no un instante) y para ordenarlos. */
export function diaServidor(valor) {
  const fecha = fechaServidor(valor)
  return fecha ? FORMATO_DIA.format(fecha) : null
}

/* La API guarda algunos "días" como datetime (medianoche o mediodía). Para
   mostrarlos se toma la parte de fecha tal cual vino, sin conversión de zona:
   "2026-11-25T12:00:00" → "25/11/2026". */
export function formatearFechaDia(valor) {
  const texto = valor == null ? '' : String(valor).trim()
  return texto ? formatearFecha(texto.slice(0, 10)) : '—'
}
