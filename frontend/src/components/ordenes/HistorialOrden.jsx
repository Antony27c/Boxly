import { useCallback, useState } from 'react'
import LineaDeTiempo from '@/components/ordenes/LineaDeTiempo'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Loader from '@/components/ui/Loader'
import useRecurso from '@/hooks/useRecurso'
import { ordenesService } from '@/services/ordenes'

export default function HistorialOrden({ ordenId }) {
  const [foto, setFoto] = useState(null)
  const cargar = useCallback(
    (t) =>
      Promise.all([
        ordenesService.historial(ordenId, t),
        ordenesService.imagenes(ordenId, t).catch(() => []),
      ]).then(([historial, imagenes]) => ({ historial, imagenes })),
    [ordenId],
  )
  const { datos, cargando, error, recargar } = useRecurso(cargar)

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

  return (
    <div className="space-y-4">
      <LineaDeTiempo historial={datos.historial} imagenes={datos.imagenes} onVerFoto={setFoto} />
      {foto && (
        <div className="space-y-2 border-t border-graphite-700 pt-4">
          <img
            src={foto.url}
            alt={`Foto de la etapa ${foto.etapa ?? ''}`}
            className="max-h-[60vh] w-full rounded-box object-contain"
          />
          <div className="flex justify-end">
            <Button variante="fantasma" onClick={() => setFoto(null)}>
              Cerrar foto
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
