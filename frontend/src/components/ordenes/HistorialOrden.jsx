import { useCallback } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Loader from '@/components/ui/Loader'
import useRecurso from '@/hooks/useRecurso'
import { ordenesService } from '@/services/ordenes'

function fechaHora(fecha) {
  return new Date(fecha).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HistorialOrden({ ordenId }) {
  const cargar = useCallback((t) => ordenesService.historial(ordenId, t), [ordenId])
  const { datos: historial, cargando, error, recargar } = useRecurso(cargar)

  if (cargando) return <Loader texto="Cargando historial…" />

  if (error) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Button variante="secundario" onClick={recargar}>
          Reintentar
        </Button>
      </div>
    )
  }

  if (historial.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay cambios de estado registrados.</p>
  }

  return (
    <ol className="space-y-3">
      {historial.map((item) => (
        <li key={item.id} className="rounded-box border border-graphite-700 p-3 text-sm">
          <p className="font-medium">
            {item.estado_anterior ? `${item.estado_anterior} → ${item.estado_nuevo}` : item.estado_nuevo}
          </p>
          <p className="mt-0.5 text-muted">
            {fechaHora(item.fecha)}
            {item.usuario_nombre ? ` · ${item.usuario_nombre}` : ''}
          </p>
          {item.comentario && <p className="mt-1">{item.comentario}</p>}
        </li>
      ))}
    </ol>
  )
}
