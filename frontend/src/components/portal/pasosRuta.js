import { nombreEstado } from '@/services/ordenes'

// Mismo camino que arma el backend para el detalle de la orden (portal/service.py).
const CAMINO = ['pendiente', 'ingresado', 'en_diagnostico', 'esperando_repuestos', 'listo', 'entregado']
const OPCIONALES = ['esperando_repuestos']

// Pasos de la ruta a partir del estado solo (las tarjetas del portal no traen
// el historial). Sin historial no se sabe si se esperaron repuestos: si ya se
// pasó esa etapa se toma como salteada, igual que hace el backend.
export function pasosDesdeEstado(estado) {
  const hasta = CAMINO.indexOf(estado)
  if (hasta < 0) return []
  return CAMINO.map((codigo, indice) => {
    let paso = 'pendiente'
    if (indice < hasta) paso = OPCIONALES.includes(codigo) ? 'omitido' : 'completado'
    else if (indice === hasta) paso = 'actual'
    return { codigo, nombre: nombreEstado(codigo), estado: paso }
  })
}
