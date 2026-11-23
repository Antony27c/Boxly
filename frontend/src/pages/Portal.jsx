import { useCallback, useMemo, useState } from 'react'
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
import useTaller from '@/hooks/useTaller'
import { nombreEstado } from '@/services/ordenes'
import { pagosService, portalService, puedePagar } from '@/services/portal'
import { pesos } from '@/utils/formato'

const TONOS_ESTADO = { listo: 'ok', entregado: 'ok', cancelado: 'peligro', pendiente: 'neutro' }
const ACENTOS_ESTADO = { listo: 'ok', entregado: 'ok', cancelado: 'danger', pendiente: 'neutro' }

function fecha(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-AR') : '—'
}

function TarjetaOrden({ orden, pagando, onPagar, pagoOnline }) {
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
          pagoOnline ? (
            <Button cargando={pagando} onClick={() => onPagar(orden)} className="ml-auto !py-2">
              Pagar {pesos(orden.costo_final)}
            </Button>
          ) : (
            <span className="ml-auto px-3 text-xs text-muted">Pagás en el taller</span>
          )
        ) : (
          !orden.pagada && <span className="ml-auto px-3 text-xs text-muted">Se habilita el pago cuando esté lista</span>
        )}
      </FichaPie>
    </Ficha>
  )
}

function TarjetaVehiculo({ vehiculo, seleccionado, onAlternar, ordenPagable, pagando, onPagar, pagoOnline }) {
  const activa = vehiculo.orden_activa
  const lista = activa?.estado === 'listo'
  return (
    <Ficha
      acento={lista ? 'ok' : activa ? 'amber' : 'ok'}
      className={seleccionado ? '!border-amber/60 ring-1 ring-amber/60' : ''}
    >
      <FichaCabecera
        antetitulo={vehiculo.marca}
        titulo={vehiculo.modelo}
        aside={<Patente valor={vehiculo.patente} tamano="sm" className="mt-0.5" />}
        silueta
      >
        <Chips>
          {vehiculo.anio && <Chip mono>{vehiculo.anio}</Chip>}
          {vehiculo.color && <Chip color={vehiculo.color}>{vehiculo.color}</Chip>}
          {lista && <Chip tono="ok">Lista para retirar</Chip>}
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

      <FichaPie>
        <Button
          variante="secundario"
          className="!py-2"
          aria-pressed={seleccionado}
          onClick={() => onAlternar(vehiculo.id)}
        >
          {seleccionado ? 'Ocultar órdenes' : 'Ver órdenes'}
        </Button>
        {ordenPagable &&
          (pagoOnline ? (
            <Button
              cargando={pagando}
              className="ml-auto !py-2"
              onClick={() => onPagar(ordenPagable)}
            >
              Pagar {pesos(ordenPagable.costo_final)}
            </Button>
          ) : (
            <span className="ml-auto px-3 text-xs text-muted">Pagás en el taller</span>
          ))}
      </FichaPie>
    </Ficha>
  )
}

// Las etapas del taller en orden de trabajo: las órdenes del vehículo
// elegido se agrupan bajo estos encabezados.
const ORDEN_ETAPAS = [
  'pendiente',
  'ingresado',
  'en_diagnostico',
  'esperando_repuestos',
  'listo',
  'entregado',
  'cancelado',
]

export default function Portal() {
  const { token, usuario } = useAuth()
  const { taller } = useTaller()
  // El cobro online depende del taller (docs/Plataforma.md, P3): si el dato
  // no está (cargando o error) se conserva el comportamiento de siempre.
  const pagoOnline = taller?.pago_online !== false
  const [pagandoId, setPagandoId] = useState(null)
  const [errorPago, setErrorPago] = useState('')
  const [vehiculoSelId, setVehiculoSelId] = useState(null)

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

  function alternarVehiculo(id) {
    setVehiculoSelId((actual) => (actual === id ? null : id))
  }

  // Primero los vehículos listos para retirar; después el resto del titular.
  const listos = (vehiculos ?? []).filter((v) => v.orden_activa?.estado === 'listo')
  const vehiculoSel = (vehiculos ?? []).find((v) => v.id === vehiculoSelId) ?? null

  // Órdenes pagables por vehículo: la tarjeta ofrece el pago directo.
  const pagablesPorVehiculo = useMemo(() => {
    const mapa = new Map()
    for (const orden of ordenes ?? []) {
      if (puedePagar(orden)) mapa.set(orden.vehiculo_id, orden)
    }
    return mapa
  }, [ordenes])

  // Órdenes del vehículo elegido, agrupadas por etapa del taller.
  const gruposPorEtapa = useMemo(() => {
    if (!vehiculoSelId) return []
    const propias = (ordenes ?? []).filter((o) => o.vehiculo_id === vehiculoSelId)
    return ORDEN_ETAPAS.map((estado) => ({
      estado,
      titulo: nombreEstado(estado),
      ordenes: propias
        .filter((o) => o.estado === estado)
        .sort((a, b) => (b.fecha_ingreso ?? '').localeCompare(a.fecha_ingreso ?? '')),
    })).filter((grupo) => grupo.ordenes.length > 0)
  }, [ordenes, vehiculoSelId])

  const tarjetaVehiculo = (vehiculo) => {
    const ordenPagable = pagablesPorVehiculo.get(vehiculo.id) ?? null
    return (
      <TarjetaVehiculo
        key={vehiculo.id}
        vehiculo={vehiculo}
        seleccionado={vehiculo.id === vehiculoSelId}
        onAlternar={alternarVehiculo}
        ordenPagable={ordenPagable}
        pagando={ordenPagable ? pagandoId === ordenPagable.id : false}
        onPagar={pagar}
        pagoOnline={pagoOnline}
      />
    )
  }

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo={`Hola, ${usuario?.nombre ?? 'cliente'}`}
        descripcion="Seguí el estado de tus vehículos en el taller y pagá online cuando estén listos."
      />

      {taller?.mensaje_portal?.trim() && (
        <div className="mt-4">
          <Alert tipo="info">{taller.mensaje_portal}</Alert>
        </div>
      )}

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
        <>
          {listos.length > 0 && (
            <section className="mt-6">
              <h2 className="font-semibold">Listos para retirar</h2>
              <p className="text-sm text-muted">
                Ya podés pasar a buscarlos
                {pagoOnline ? ' — o pagar online desde sus órdenes.' : '.'}
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {listos.map(tarjetaVehiculo)}
              </ul>
            </section>
          )}

          {vehiculos?.length > 0 && (
            <section className="mt-6">
              <h2 className="flex items-center gap-2 font-semibold">
                Mis vehículos
                <Badge tono="neutro">{vehiculos.length}</Badge>
              </h2>
              <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {vehiculos.map(tarjetaVehiculo)}
              </ul>
            </section>
          )}
        </>
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
      ) : vehiculoSel ? (
        <section
          className={`mt-8 ${cargando ? 'transition-opacity opacity-60' : 'transition-opacity'}`}
        >
          <h2 className="font-semibold">Órdenes de {vehiculoSel.patente}</h2>
          {gruposPorEtapa.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Este vehículo no tiene órdenes de trabajo.
            </p>
          ) : (
            gruposPorEtapa.map((grupo) => (
              <div key={grupo.estado} className="mt-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted">
                  {grupo.titulo}
                  <Badge tono="neutro">{grupo.ordenes.length}</Badge>
                </h3>
                <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {grupo.ordenes.map((orden) => (
                    <TarjetaOrden
                      key={orden.id}
                      orden={orden}
                      pagando={pagandoId === orden.id}
                      onPagar={pagar}
                      pagoOnline={pagoOnline}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      ) : (
        vehiculos?.length > 0 && (
          <p className="mt-8 text-sm text-muted">
            Tocá «Ver órdenes» en un vehículo para ver sus trabajos por etapa.
          </p>
        )
      )}

      {(taller?.telefono || (taller?.hora_apertura && taller?.hora_cierre)) && (
        <footer className="mt-10 border-t border-graphite-700 pt-4 text-sm text-muted">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {taller?.telefono && <span>Tel: {taller.telefono}</span>}
            {taller?.hora_apertura && taller?.hora_cierre && (
              <span>
                Horario de atención: {taller.hora_apertura} a {taller.hora_cierre}
              </span>
            )}
          </p>
        </footer>
      )}
    </div>
  )
}
