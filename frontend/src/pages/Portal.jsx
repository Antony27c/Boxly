import { useCallback, useState } from 'react'
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

export default function Portal() {
  const { token, usuario } = useAuth()
  const [pagandoId, setPagandoId] = useState(null)
  const [errorPago, setErrorPago] = useState('')

  const cargar = useCallback((t) => portalService.misOrdenes(t), [])
  const { datos: ordenes, cargando, error, recargar } = useRecurso(cargar)

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
