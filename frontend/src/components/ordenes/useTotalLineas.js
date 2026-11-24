import { useCallback } from 'react'
import useRecurso from '@/hooks/useRecurso'
import { lineaACotizar, ordenesService } from '@/services/ordenes'

/* Suma de los subtotales de las líneas ya cotizadas (las "a cotizar" no suman). */
export function sumarLineas(detalles) {
  return (detalles ?? [])
    .filter((detalle) => !lineaACotizar(detalle))
    .reduce((suma, detalle) => suma + (Number(detalle.subtotal) || 0), 0)
}

/* Total de las líneas de una orden, para precargar el monto del cobro cuando
   todavía no hay costo_final. Solo pide las líneas si `habilitado`; mientras
   cargan (o si falla) devuelve 0 y el campo queda como estaba. */
export default function useTotalLineas(ordenId, habilitado) {
  const cargar = useCallback(
    (t) => (habilitado && ordenId != null ? ordenesService.detalles(ordenId, t) : Promise.resolve([])),
    [ordenId, habilitado],
  )
  const { datos } = useRecurso(cargar)
  return sumarLineas(datos)
}
