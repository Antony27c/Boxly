export function aISO(fecha) {
  const copia = new Date(fecha)
  copia.setMinutes(copia.getMinutes() - copia.getTimezoneOffset())
  return copia.toISOString().slice(0, 10)
}

export function lunesDe(fecha) {
  const copia = new Date(`${fecha}T12:00:00`)
  const dia = copia.getDay()
  const corrimiento = dia === 0 ? -6 : 1 - dia
  copia.setDate(copia.getDate() + corrimiento)
  return aISO(copia)
}

export function sumarDias(fecha, dias) {
  const copia = new Date(`${fecha}T12:00:00`)
  copia.setDate(copia.getDate() + dias)
  return aISO(copia)
}

export function etiquetaDia(fecha) {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  })
}
