import { pesos } from '@/utils/formato'
import { fechaHora } from '../formatos'

// Helpers de presentación de la suscripción del taller (S5 + C3). Las fechas
// de suscripción y pagos llegan como YYYY-MM-DD: se muestran DD/MM/AAAA sin
// pasar por Date para no correr el día por la zona horaria.

export function fechaSuscripcion(fecha) {
  if (!fecha) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha))
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return fechaHora(fecha)
}

export function textoDias(dias) {
  if (dias == null) return '—'
  if (dias === 0) return 'Vence hoy'
  if (dias > 0) return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`
  const atraso = -dias
  return `Venció hace ${atraso} ${atraso === 1 ? 'día' : 'días'}`
}

// Opciones del selector de plan (cambio de plan y cambio de acceso): los
// inactivos se pueden ver pero van marcados.
export function opcionesDePlanes(planes) {
  return planes.map((p) => ({
    valor: p.codigo,
    texto: `${p.nombre} — ${pesos(p.precio_mensual)}${p.activo ? '' : ' (inactivo)'}`,
  }))
}
