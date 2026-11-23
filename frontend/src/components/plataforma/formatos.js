// Formatos compartidos por las pantallas de plataforma (talleres).

export function numero(valor) {
  return Number(valor ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

// "hace 3 días" / "hace 2 horas" / "recién". Sin fecha devuelve "Nunca".
export function haceCuanto(fecha) {
  if (!fecha) return 'Nunca'
  const entonces = new Date(fecha).getTime()
  if (Number.isNaN(entonces)) return '—'
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

// "17/11/2026 14:30" para auditorías y vencimientos.
export function fechaHora(fecha) {
  if (!fecha) return '—'
  const fecha_ = new Date(fecha)
  if (Number.isNaN(fecha_.getTime())) return '—'
  return fecha_.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Chip "Soporte hasta …": solo la hora si es hoy ("18:30"), fecha y hora si no.
export function etiquetaSoporte(hasta) {
  const fecha_ = new Date(hasta)
  if (Number.isNaN(fecha_.getTime())) return null
  const hora = fecha_.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const esHoy = fecha_.toDateString() === new Date().toDateString()
  if (esHoy) return hora
  const dia = fecha_.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
  return `${dia} ${hora}`
}
