// Textos de los mensajes de WhatsApp que manda el taller, todos en un solo
// lugar. Cada función recibe los datos que tenga a mano y arma un mensaje
// corto; si falta algún dato (vehículo, fecha, portal) la frase se acomoda.
//
// Datos que entienden:
//   cliente:  nombre de pila del cliente
//   vehiculo: marca y modelo ("Ford Fiesta")
//   patente:  patente del vehículo
//   fecha:    día del turno, YYYY-MM-DD
//   hora:     hora del turno, HH:MM
//   taller:   nombre del taller
//   portal:   link al portal del cliente

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function limpio(valor) {
  return String(valor ?? '').trim()
}

function hola(cliente) {
  const nombre = limpio(cliente)
  return nombre ? `¡Hola, ${nombre}!` : '¡Hola!'
}

function deTaller(taller) {
  const nombre = limpio(taller)
  return nombre ? `Te escribimos de ${nombre}.` : ''
}

// "tu Ford Fiesta (AB 123 CD)", "tu vehículo (AB123CD)" o "tu vehículo".
function tuVehiculo({ vehiculo, patente }) {
  const nombre = limpio(vehiculo) || 'vehículo'
  const chapa = limpio(patente)
  return chapa ? `tu ${nombre} (${chapa})` : `tu ${nombre}`
}

// "el martes 24/11 a las 10:00". El día de la semana se saca del calendario,
// sin pasar por zonas horarias: la fecha del turno ya es un día del taller.
export function cuandoTurno(fecha, hora) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(limpio(fecha))
  const horario = limpio(hora).slice(0, 5)
  let texto = ''
  if (partes) {
    const [, anio, mes, dia] = partes
    const diaSemana = DIAS[new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia))).getUTCDay()]
    texto = `el ${diaSemana} ${dia}/${mes}`
  }
  if (horario) texto = `${texto} a las ${horario}`.trim()
  return texto
}

function enPortal(portal, frase) {
  const link = limpio(portal)
  return link ? `${frase} ${link}` : ''
}

function unir(...frases) {
  return frases.filter(Boolean).join(' ')
}

export function turnoConfirmado(datos = {}) {
  const cuando = cuandoTurno(datos.fecha, datos.hora)
  return unir(
    hola(datos.cliente),
    deTaller(datos.taller),
    `Te confirmamos el turno para ${tuVehiculo(datos)}${cuando ? ` ${cuando}` : ''}.`,
    'Si no podés venir, avisanos por acá. ¡Gracias!',
  )
}

export function recordatorioTurno(datos = {}) {
  const cuando = cuandoTurno(datos.fecha, datos.hora)
  return unir(
    hola(datos.cliente),
    deTaller(datos.taller),
    `Te recordamos el turno para ${tuVehiculo(datos)}${cuando ? ` ${cuando}` : ''}.`,
    '¡Te esperamos!',
  )
}

export function autoRecibido(datos = {}) {
  return unir(
    hola(datos.cliente),
    deTaller(datos.taller),
    `Ya recibimos ${tuVehiculo(datos)} en el taller.`,
    enPortal(datos.portal, 'Podés seguir cómo va el trabajo en'),
  )
}

export function trabajosACotizar(datos = {}) {
  return unir(
    hola(datos.cliente),
    deTaller(datos.taller),
    `Revisamos ${tuVehiculo(datos)} y tenemos trabajos para cotizarte.`,
    enPortal(datos.portal, 'Te pasamos el detalle por acá y también lo ves en'),
  )
}

export function autoListo(datos = {}) {
  return unir(
    hola(datos.cliente),
    deTaller(datos.taller),
    `${tuVehiculo(datos).replace(/^tu/, 'Tu')} ya está listo para retirar.`,
    enPortal(datos.portal, 'El detalle del trabajo está en'),
  )
}

export function saludo(datos = {}) {
  return unir(hola(datos.cliente), deTaller(datos.taller))
}

/** Mensaje para una orden según su estado (y si tiene trabajos a cotizar). */
export function mensajeOrden(orden, datos = {}) {
  const estado = orden?.estado
  if (estado === 'Listo') return autoListo(datos)
  if (estado === 'Entregado' || estado === 'Cancelado' || estado === 'Pendiente') return saludo(datos)
  if (Number(orden?.lineas_a_cotizar) > 0 || estado === 'En diagnóstico') return trabajosACotizar(datos)
  return autoRecibido(datos)
}

/**
 * Mensaje para un turno según su estado: pendiente → se confirma,
 * confirmado → recordatorio. Para el resto no hay mensaje (null).
 */
export function mensajeTurno(turno, datos = {}) {
  if (turno?.estado === 'pendiente') return turnoConfirmado(datos)
  if (turno?.estado === 'confirmado') return recordatorioTurno(datos)
  return null
}

/** Link al portal del cliente en este mismo sitio. */
export function urlPortal() {
  if (typeof window === 'undefined' || !window.location?.origin) return '/portal'
  return `${window.location.origin}/portal`
}
