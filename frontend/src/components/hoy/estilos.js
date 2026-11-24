import { formatearFechaLarga } from '@/lib/fechas'
import { estadoCobro } from '@/services/ordenes'

export const MAX_ITEMS = 5

// Filas tipo ficha en versión compacta: barra de acento, dato principal
// resaltado y sombra que se levanta al pasar el mouse (ver components/ui/Ficha).
export const FILA = '!flex-row flex-wrap sm:flex-nowrap min-h-[56px] items-center gap-x-2 sm:pr-3'
export const BOTON_FILA =
  'min-h-10 shrink-0 px-3 py-2 text-xs max-sm:mx-3 max-sm:mb-2.5 max-sm:w-[calc(100%-1.5rem)]'

export const ACENTO_TURNO = { pendiente: 'amber', confirmado: 'ok' }

// "Martes, 17 de noviembre": solo la primera letra en mayúscula.
export function fechaLarga() {
  const texto = formatearFechaLarga(new Date(), { diaSemana: true, anio: false })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// Barra de la fila según en qué está la orden.
export function acentoOrden(orden) {
  if (estadoCobro(orden) === 'pendiente') return 'amber'
  if (orden.estado === 'Listo') return 'ok'
  if (orden.estado === 'Esperando repuestos') return 'danger'
  if ((orden.estado === 'Ingresado' || orden.estado === 'Pendiente') && !orden.mecanico_id && !orden.mecanico) {
    return 'danger'
  }
  if (orden.estado === 'En diagnóstico' || orden.estado === 'Ingresado') return 'amber'
  return 'neutro'
}
