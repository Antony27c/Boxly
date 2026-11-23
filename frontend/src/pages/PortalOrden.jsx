import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Chip, Chips, Ficha, FichaCabecera } from '@/components/ui/Ficha'
import Loader from '@/components/ui/Loader'
import Patente from '@/components/ui/Patente'
import LineaDeTiempo from '@/components/ordenes/LineaDeTiempo'
import RutaSeguimiento from '@/components/portal/RutaSeguimiento'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import useTaller from '@/hooks/useTaller'
import { nombreEstado } from '@/services/ordenes'
import { pagosService, portalService } from '@/services/portal'
import { pesos } from '@/utils/formato'

const ACENTOS_ESTADO = { listo: 'ok', entregado: 'ok', cancelado: 'danger', pendiente: 'neutro' }
// El encabezado usa el lenguaje de ficha pero no es una tarjeta clickeable: no se levanta.
const FICHA_QUIETA =
  'hover:!border-graphite-700 hover:!shadow-[0_1px_2px_rgba(16,18,22,0.06)] motion-safe:hover:!translate-y-0'

function fecha(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-AR') : '—'
}

export default function PortalOrden() {
  const { id } = useParams()
  const { token } = useAuth()
  const { taller } = useTaller()
  const [pagando, setPagando] = useState(false)
  const [errorPago, setErrorPago] = useState('')

  // El cobro online depende del taller (docs/Plataforma.md, P3): si el dato
  // no está (cargando o error) se conserva el comportamiento de siempre.
  const pagoOnline = taller?.pago_online !== false

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

      <Ficha as="header" acento={ACENTOS_ESTADO[orden.estado] ?? 'amber'} className={FICHA_QUIETA}>
        <FichaCabecera
          nivel="h1"
          antetitulo={orden.vehiculo.marca}
          titulo={orden.vehiculo.modelo}
          aside={
            <>
              <span className="sr-only">Patente</span>
              <Patente valor={orden.vehiculo.patente} tamano="md" className="mt-0.5" />
            </>
          }
          silueta
          className="sm:[&_h1]:text-3xl"
        >
          <Chips className="items-center">
            <Badge tono={orden.pagada ? 'ok' : 'ambar'}>{nombreEstado(orden.estado)}</Badge>
            <Chip mono>Orden {orden.codigo}</Chip>
          </Chips>
        </FichaCabecera>
      </Ficha>

      <section className="rounded-box border border-graphite-700 bg-graphite-800 p-5">
        <RutaSeguimiento pasos={orden.pasos} />
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
          ) : orden.puede_pagar && !pagoOnline ? (
            <span className="text-xs text-muted">Pagás en el taller</span>
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
