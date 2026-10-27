import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Loader from '@/components/ui/Loader'
import LineaDeTiempo from '@/components/ordenes/LineaDeTiempo'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { nombreEstado } from '@/services/ordenes'
import { pagosService, portalService } from '@/services/portal'

function pesos(valor) {
  return Number(valor ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

function fecha(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-AR') : '—'
}

// Estilo de cada paso del recorrido. El texto del estado acompaña al color.
const PASOS = {
  completado: { marca: '✓', clase: 'border-ok bg-ok text-white', texto: 'Completado' },
  actual: { marca: '●', clase: 'border-amber bg-amber text-white ring-4 ring-amber/25', texto: 'Ahora' },
  pendiente: { marca: '', clase: 'border-graphite-600 bg-graphite-800 text-muted', texto: 'Pendiente' },
  omitido: { marca: '–', clase: 'border-graphite-600 bg-graphite-900 text-muted', texto: 'No hizo falta' },
}

function Recorrido({ pasos }) {
  return (
    <ol className="grid gap-3 sm:grid-flow-col sm:auto-cols-fr">
      {pasos.map((paso) => {
        const estilo = PASOS[paso.estado] ?? PASOS.pendiente
        return (
          <li key={paso.codigo} className="flex items-center gap-3 sm:flex-col sm:text-center">
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${estilo.clase}`}
            >
              {estilo.marca}
            </span>
            <span>
              <span className={`block text-sm ${paso.estado === 'actual' ? 'font-semibold' : ''}`}>
                {paso.nombre}
              </span>
              <span className="block text-xs text-muted">{estilo.texto}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function PortalOrden() {
  const { id } = useParams()
  const { token } = useAuth()
  const [pagando, setPagando] = useState(false)
  const [errorPago, setErrorPago] = useState('')

  const cargar = useCallback((t) => portalService.miOrden(id, t), [id])
  const { datos: orden, cargando, error, recargar } = useRecurso(cargar)

  async function pagar() {
    setPagando(true)
    setErrorPago('')
    try {
      const { url_pago } = await pagosService.crear(orden.id, token)
      window.location.assign(url_pago)
    } catch (problema) {
      setErrorPago(problema.message)
      setPagando(false)
    }
  }

  const volver = (
    <Link to="/portal" className="text-sm text-amber-deep hover:underline">
      ← Volver a mis órdenes
    </Link>
  )

  if (cargando && !orden) return <Loader texto="Cargando seguimiento…" />

  if (error) {
    return (
      <div className="animate-bay-in space-y-4">
        {volver}
        <Alert>{error}</Alert>
        <Button variante="secundario" onClick={recargar}>
          Reintentar
        </Button>
      </div>
    )
  }

  const detalles = orden.detalles ?? []

  return (
    <div className="animate-bay-in space-y-6">
      {volver}

      <EncabezadoPagina
        titulo={`${orden.vehiculo.marca} ${orden.vehiculo.modelo}`}
        descripcion={`Patente ${orden.vehiculo.patente} · Orden ${orden.codigo}`}
        acciones={<Badge tono={orden.pagada ? 'ok' : 'ambar'}>{nombreEstado(orden.estado)}</Badge>}
      />

      <section className="rounded-box border border-graphite-700 bg-graphite-800 p-5">
        <Recorrido pasos={orden.pasos} />
        {orden.etapa_actual && (
          <p className="mt-5 border-t border-graphite-700 pt-4 text-sm">
            <span className="font-semibold">{orden.etapa_actual.nombre}: </span>
            <span className="text-muted">{orden.etapa_actual.descripcion}</span>
          </p>
        )}
      </section>

      <section className="grid gap-4 rounded-box border border-graphite-700 bg-graphite-800 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-muted">Ingresó</p>
          <p className="mt-0.5">{fecha(orden.fecha_ingreso)}</p>
        </div>
        <div>
          <p className="text-muted">{orden.fecha_entrega ? 'Entregado' : 'Entrega estimada'}</p>
          <p className="mt-0.5">{fecha(orden.fecha_entrega ?? orden.fecha_estimada_entrega)}</p>
        </div>
        <div>
          <p className="text-muted">Mecánico a cargo</p>
          <p className="mt-0.5">{orden.mecanico_nombre ?? 'Sin asignar'}</p>
        </div>
        <div>
          <p className="text-muted">Motivo de ingreso</p>
          <p className="mt-0.5">{orden.descripcion_ingreso || '—'}</p>
        </div>
        {orden.diagnostico && (
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-muted">Diagnóstico</p>
            <p className="mt-0.5">{orden.diagnostico}</p>
          </div>
        )}
      </section>

      <section className="rounded-box border border-graphite-700 bg-graphite-800 p-5">
        <h2 className="font-semibold">Seguimiento</h2>
        <p className="mb-4 text-sm text-muted">Cada etapa que pasó tu vehículo, con las fotos que subió el taller.</p>
        <LineaDeTiempo historial={orden.historial} imagenes={orden.imagenes} />
      </section>

      <section className="rounded-box border border-graphite-700 bg-graphite-800 p-5">
        <h2 className="font-semibold">Trabajos y repuestos</h2>
        {detalles.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Todavía no se cargaron trabajos ni repuestos.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-graphite-700 text-left text-muted">
                <tr>
                  <th className="py-2 font-medium">Detalle</th>
                  <th className="py-2 text-right font-medium">Cant.</th>
                  <th className="py-2 text-right font-medium">Precio</th>
                  <th className="py-2 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detalles.map((detalle) => (
                  <tr key={detalle.id} className="border-b border-graphite-700 last:border-0">
                    <td className="py-2">{detalle.repuesto_nombre ?? detalle.descripcion}</td>
                    <td className="py-2 text-right font-mono">{detalle.cantidad}</td>
                    <td className="py-2 text-right font-mono">{pesos(detalle.precio_unitario)}</td>
                    <td className="py-2 text-right font-mono">{pesos(detalle.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-graphite-700 pt-4">
          <div>
            <p className="text-xs text-muted">{orden.costo_final ? 'Total' : 'Presupuesto estimado'}</p>
            <p className="text-xl font-semibold">
              {orden.costo_final || orden.costo_estimado ? pesos(orden.costo_final ?? orden.costo_estimado) : 'A confirmar'}
            </p>
          </div>
          {orden.pagada ? (
            <Badge tono="ok">Pagada</Badge>
          ) : orden.puede_pagar ? (
            <Button cargando={pagando} onClick={pagar}>
              Pagar {pesos(orden.costo_final)}
            </Button>
          ) : (
            <span className="text-xs text-muted">El pago se habilita cuando la orden esté lista.</span>
          )}
        </div>
        {orden.pago?.estado === 'rechazado' && !orden.pagada && (
          <div className="mt-3">
            <Alert>El último intento de pago fue rechazado. Podés intentarlo de nuevo.</Alert>
          </div>
        )}
        {errorPago && (
          <div className="mt-3">
            <Alert>{errorPago}</Alert>
          </div>
        )}
      </section>
    </div>
  )
}
