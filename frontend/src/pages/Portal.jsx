import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Loader from '@/components/ui/Loader'
import Vacio from '@/components/ui/Vacio'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { nombreEstado } from '@/services/ordenes'
import { pagosService, portalService, puedePagar } from '@/services/portal'

const TONOS_ESTADO = { listo: 'ok', entregado: 'ok', cancelado: 'peligro', pendiente: 'neutro' }

function pesos(valor) {
  return Number(valor ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

function fecha(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-AR') : '—'
}

function TarjetaOrden({ orden, pagando, onPagar }) {
  const pagable = puedePagar(orden)
  return (
    <li
      className={`rounded-box border bg-graphite-800 p-5 ${pagable ? 'border-amber/60 shadow-lift' : 'border-graphite-700'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold">{orden.codigo}</span>
        <Badge tono={TONOS_ESTADO[orden.estado] ?? 'ambar'}>{nombreEstado(orden.estado)}</Badge>
      </div>
      <p className="mt-2 font-medium">
        {orden.vehiculo_marca} {orden.vehiculo_modelo}
        <span className="text-muted"> · {orden.vehiculo_patente}</span>
      </p>
      <p className="mt-1 text-xs text-muted">
        Ingresó el {fecha(orden.fecha_ingreso)}
        {orden.fecha_estimada_entrega && ` · Entrega estimada ${fecha(orden.fecha_estimada_entrega)}`}
      </p>

      <Link to={`/portal/orden/${orden.id}`} className="mt-3 inline-block text-sm text-amber-deep hover:underline">
        Ver seguimiento →
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-graphite-700 pt-4">
        <div>
          <p className="text-xs text-muted">Total</p>
          <p className="text-lg font-semibold">
            {orden.costo_final ? pesos(orden.costo_final) : 'A confirmar'}
          </p>
        </div>
        {orden.pagada ? (
          <Badge tono="ok">Pagada</Badge>
        ) : pagable ? (
          <Button cargando={pagando} onClick={() => onPagar(orden)}>
            Pagar {pesos(orden.costo_final)}
          </Button>
        ) : (
          <span className="text-xs text-muted">Se habilita el pago cuando esté lista</span>
        )}
      </div>
    </li>
  )
}

function TarjetaVehiculo({ vehiculo }) {
  const activa = vehiculo.orden_activa
  return (
    <li className="rounded-box border border-graphite-700 bg-graphite-800 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {vehiculo.marca} {vehiculo.modelo}
          </p>
          <p className="text-sm text-muted">
            <span className="font-mono">{vehiculo.patente}</span>
            {vehiculo.anio && ` · ${vehiculo.anio}`}
            {vehiculo.color && ` · ${vehiculo.color}`}
          </p>
        </div>
        {activa ? (
          <Badge tono={TONOS_ESTADO[activa.estado] ?? 'ambar'}>{nombreEstado(activa.estado)}</Badge>
        ) : (
          <Badge>Sin trabajos en curso</Badge>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-graphite-700 pt-3 text-sm">
        <span className="text-muted">
          {vehiculo.ordenes_total} {vehiculo.ordenes_total === 1 ? 'orden' : 'órdenes'} en el taller
        </span>
        {activa && (
          <Link to={`/portal/orden/${activa.id}`} className="text-amber-deep hover:underline">
            Seguir {activa.codigo} →
          </Link>
        )}
      </div>
    </li>
  )
}

export default function Portal() {
  const { token, usuario } = useAuth()
  const [pagandoId, setPagandoId] = useState(null)
  const [errorPago, setErrorPago] = useState('')

  const cargar = useCallback((t) => portalService.misOrdenes(t), [])
  const cargarVehiculos = useCallback((t) => portalService.misVehiculos(t), [])
  const { datos: ordenes, cargando, error, recargar } = useRecurso(cargar)
  const { datos: vehiculos, error: errorVehiculos } = useRecurso(cargarVehiculos)

  async function pagar(orden) {
    setPagandoId(orden.id)
    setErrorPago('')
    try {
      const { url_pago } = await pagosService.crear(orden.id, token)
      window.location.assign(url_pago)
    } catch (problema) {
      setErrorPago(problema.message)
      setPagandoId(null)
    }
  }

  const paraPagar = (ordenes ?? []).filter(puedePagar)
  const resto = (ordenes ?? []).filter((orden) => !puedePagar(orden))

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo={`Hola, ${usuario?.nombre ?? 'cliente'}`}
        descripcion="Seguí el estado de tus vehículos en el taller y pagá online cuando estén listos."
      />

      {errorPago && (
        <div className="mt-4">
          <Alert>{errorPago}</Alert>
        </div>
      )}

      {errorVehiculos ? (
        <div className="mt-6">
          <Alert>{errorVehiculos}</Alert>
        </div>
      ) : (
        vehiculos?.length > 0 && (
          <section className="mt-6">
            <h2 className="font-semibold">Mis vehículos</h2>
            <ul className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {vehiculos.map((vehiculo) => (
                <TarjetaVehiculo key={vehiculo.id} vehiculo={vehiculo} />
              ))}
            </ul>
          </section>
        )
      )}

      {cargando ? (
        <Loader texto="Cargando tus órdenes…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : ordenes.length === 0 ? (
        <div className="mt-6">
          <Vacio titulo="Sin órdenes" mensaje="Todavía no tenés órdenes de trabajo en el taller." />
        </div>
      ) : (
        <>
          {paraPagar.length > 0 && (
            <section className="mt-6">
              <h2 className="font-semibold">Listas para pagar</h2>
              <p className="text-sm text-muted">El pago se hace de forma segura con Mercado Pago.</p>
              <ul className="mt-3 grid gap-4 md:grid-cols-2">
                {paraPagar.map((orden) => (
                  <TarjetaOrden
                    key={orden.id}
                    orden={orden}
                    pagando={pagandoId === orden.id}
                    onPagar={pagar}
                  />
                ))}
              </ul>
            </section>
          )}

          {resto.length > 0 && (
            <section className="mt-8">
              <h2 className="font-semibold">Mis órdenes</h2>
              <ul className="mt-3 grid gap-4 md:grid-cols-2">
                {resto.map((orden) => (
                  <TarjetaOrden key={orden.id} orden={orden} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
