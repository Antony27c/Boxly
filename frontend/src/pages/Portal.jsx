import { useCallback, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import { Chip, Chips, Ficha, FichaCabecera, FichaLink, FichaPie, FichaSeccion } from '@/components/ui/Ficha'
import Loader from '@/components/ui/Loader'
import Patente from '@/components/ui/Patente'
import Vacio from '@/components/ui/Vacio'
import { pasosDesdeEstado } from '@/components/portal/pasosRuta'
import RutaSeguimiento from '@/components/portal/RutaSeguimiento'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { nombreEstado } from '@/services/ordenes'
import { pagosService, portalService, puedePagar } from '@/services/portal'
import { pesos } from '@/utils/formato'

const TONOS_ESTADO = { listo: 'ok', entregado: 'ok', cancelado: 'peligro', pendiente: 'neutro' }
const ACENTOS_ESTADO = { listo: 'ok', entregado: 'ok', cancelado: 'danger', pendiente: 'neutro' }

function fecha(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-AR') : '—'
}

function TarjetaOrden({ orden, pagando, onPagar }) {
  const pagable = puedePagar(orden)
  const pasos = pasosDesdeEstado(orden.estado)
  return (
    <Ficha acento={ACENTOS_ESTADO[orden.estado] ?? 'amber'} className={pagable ? '!border-amber/60' : ''}>
      <FichaCabecera
        antetitulo={orden.codigo}
        titulo={orden.vehiculo_modelo || 'Orden de trabajo'}
        aside={<Badge tono={TONOS_ESTADO[orden.estado] ?? 'ambar'}>{nombreEstado(orden.estado)}</Badge>}
      >
        <p className="relative mt-1 text-xs text-muted">
          {orden.vehiculo_marca && `${orden.vehiculo_marca} · `}Ingresó el {fecha(orden.fecha_ingreso)}
          {orden.fecha_estimada_entrega && ` · Entrega estimada ${fecha(orden.fecha_estimada_entrega)}`}
        </p>
        <Chips className="items-center">
          <Patente valor={orden.vehiculo_patente} tamano="sm" />
          <Chip>
            Total{' '}
            {orden.costo_final ? <span className="font-mono font-semibold">{pesos(orden.costo_final)}</span> : 'a confirmar'}
          </Chip>
          {orden.pagada ? (
            <Chip tono="ok">Pagada</Chip>
          ) : (
            pagable && <Chip tono="ambar">Lista para pagar</Chip>
          )}
        </Chips>
      </FichaCabecera>

      {pasos.length > 0 && (
        <FichaSeccion>
          <RutaSeguimiento pasos={pasos} compacta />
        </FichaSeccion>
      )}

      <FichaPie>
        <FichaLink to={`/portal/orden/${orden.id}`}>Ver seguimiento</FichaLink>
        {pagable ? (
          <Button cargando={pagando} onClick={() => onPagar(orden)} className="ml-auto !py-2">
            Pagar {pesos(orden.costo_final)}
          </Button>
        ) : (
          !orden.pagada && <span className="ml-auto px-3 text-xs text-muted">Se habilita el pago cuando esté lista</span>
        )}
      </FichaPie>
    </Ficha>
  )
}

function TarjetaVehiculo({ vehiculo }) {
  const activa = vehiculo.orden_activa
  return (
    <Ficha acento={activa ? 'amber' : 'ok'}>
      <FichaCabecera
        antetitulo={vehiculo.marca}
        titulo={vehiculo.modelo}
        aside={<Patente valor={vehiculo.patente} tamano="sm" className="mt-0.5" />}
        silueta
      >
        <Chips>
          {vehiculo.anio && <Chip mono>{vehiculo.anio}</Chip>}
          {vehiculo.color && <Chip color={vehiculo.color}>{vehiculo.color}</Chip>}
          {vehiculo.ordenes_total > 0 && (
            <Chip>
              {vehiculo.ordenes_total} {vehiculo.ordenes_total === 1 ? 'orden' : 'órdenes'} en el taller
            </Chip>
          )}
        </Chips>
      </FichaCabecera>

      {activa ? (
        <FichaSeccion className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted">Orden activa</p>
            <Badge tono={TONOS_ESTADO[activa.estado] ?? 'ambar'}>{nombreEstado(activa.estado)}</Badge>
          </div>
          <FichaLink to={`/portal/orden/${activa.id}`} className="-mr-3">
            {`Seguir ${activa.codigo}`}
          </FichaLink>
        </FichaSeccion>
      ) : (
        <FichaSeccion className="text-sm text-muted">Sin trabajos en curso</FichaSeccion>
      )}
    </Ficha>
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
            <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {vehiculos.map((vehiculo) => (
                <TarjetaVehiculo key={vehiculo.id} vehiculo={vehiculo} />
              ))}
            </ul>
          </section>
        )
      )}

      {cargando && !ordenes ? (
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
        <div className={cargando ? 'transition-opacity opacity-60' : 'transition-opacity'}>
          {paraPagar.length > 0 && (
            <section className="mt-6">
              <h2 className="font-semibold">Listas para pagar</h2>
              <p className="text-sm text-muted">El pago se hace de forma segura con Mercado Pago.</p>
              <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                {resto.map((orden) => (
                  <TarjetaOrden key={orden.id} orden={orden} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
