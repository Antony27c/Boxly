import { Link } from 'react-router-dom'
import Odometro from '@/components/graficos/Odometro'
import SelloService from '@/components/vehiculos/SelloService'
import TestigoService from '@/components/vehiculos/TestigoService'
import { formatearFechaLarga } from '@/lib/fechas'
import { pesos } from '@/utils/formato'

// Libreta de service del vehículo: arriba el testigo de próximo turno y los km
// (si se conocen); abajo cada orden como un renglón con su sello estampado.
// `vacio` se muestra en lugar de los renglones cuando todavía no hay órdenes.
export default function LibretaService({ ordenes = [], proximoTurno = null, kilometraje, vacio = null }) {
  const km = Number(kilometraje)
  const hayKm = Number.isFinite(km) && km > 0

  return (
    <div className="mt-4 overflow-hidden rounded-box border border-graphite-700 bg-graphite-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-graphite-700 px-4 py-3">
        <TestigoService turno={proximoTurno} />
        {hayKm && <Odometro valor={km} enteros={6} unidad="km" etiqueta="Kilometraje" />}
      </div>

      {ordenes.length === 0 ? (
        <div className="p-4">{vacio}</div>
      ) : (
        <ol className="divide-y divide-dashed divide-graphite-700">
          {ordenes.map((orden, indice) => (
            <li key={orden.id}>
              <Link
                to={`/ordenes/${orden.id}`}
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-graphite-700/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-muted">
                    {orden.fecha ? formatearFechaLarga(orden.fecha) : 'Sin fecha'}
                  </span>
                  <span className="mt-1 block break-words">{orden.descripcion || 'Sin detalle'}</span>
                  {orden.total > 0 && (
                    <span className="mt-1 block text-sm text-muted">Total: {pesos(orden.total)}</span>
                  )}
                </span>
                <SelloService
                  fecha={orden.fecha}
                  servicio={orden.descripcion}
                  estado={orden.estado}
                  indice={indice}
                />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
