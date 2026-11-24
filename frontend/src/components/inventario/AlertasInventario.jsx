import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import AvisosStock from './AvisosStock'

/* Indicador de avisos de stock sin leer (abre la lista) y alerta de
   repuestos en el stock mínimo, con "Ver cuáles" para filtrarlos. */
export default function AlertasInventario({ avisosStock, conStockBajo, onVerStockBajo }) {
  const [verAvisos, setVerAvisos] = useState(false)
  const cantidad = avisosStock.avisos.length
  return (
    <>
      {cantidad > 0 && (
        <div className="mt-4">
          {/* aria-expanded: abrir la lista es leer, sigue andando en solo lectura. */}
          <button
            type="button"
            aria-expanded={verAvisos}
            aria-controls="avisos-inventario"
            onClick={() => setVerAvisos((abierto) => !abierto)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber/50 bg-amber/10 px-3 py-2 text-sm font-semibold text-amber-texto transition-colors hover:bg-amber/20"
          >
            <Badge tono="ambar">{cantidad}</Badge>
            {cantidad === 1 ? 'aviso de stock sin leer' : 'avisos de stock sin leer'}
            <span aria-hidden="true">{verAvisos ? '▴' : '▾'}</span>
          </button>
        </div>
      )}
      {verAvisos && (
        <AvisosStock
          id="avisos-inventario"
          avisos={avisosStock.avisos}
          error={avisosStock.error}
          enCurso={avisosStock.enCurso}
          onEntendido={avisosStock.marcarLeido}
          className="mt-3"
        />
      )}

      {conStockBajo.length > 0 && (
        <div className="mt-4">
          <Alert>
            {conStockBajo.length === 1
              ? `"${conStockBajo[0].nombre}" está en el stock mínimo o por debajo.`
              : `${conStockBajo.length} repuestos están en el stock mínimo o por debajo.`}{' '}
            <button type="button" className="font-semibold underline" onClick={onVerStockBajo}>
              Ver cuáles
            </button>
          </Alert>
        </div>
      )}
    </>
  )
}
