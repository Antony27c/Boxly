import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import { Chip, Chips, Ficha, FichaCabecera, FichaLink, FichaPersona, FichaPie } from '@/components/ui/Ficha'
import Loader from '@/components/ui/Loader'
import Patente from '@/components/ui/Patente'
import Vacio from '@/components/ui/Vacio'
import LibretaService from '@/components/vehiculos/LibretaService'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { ROLES_MOSTRADOR, tieneAcceso } from '@/routes/navegacion'
import { clientesService } from '@/services/clientes'
import { turnosService } from '@/services/turnos'
import { vehiculosService } from '@/services/vehiculos'
import { aISO } from '@/utils/fechas'

// Turnos que todavía cuentan como "próximo service" en la libreta.
const TURNOS_VIGENTES = ['pendiente', 'confirmado']

function proximoTurnoDe(turnos, vehiculoId, hoy) {
  return (
    (turnos ?? [])
      .filter(
        (turno) =>
          Number(turno.vehiculo_id) === Number(vehiculoId) &&
          TURNOS_VIGENTES.includes(turno.estado) &&
          turno.fecha >= hoy,
      )
      .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))[0] ?? null
  )
}

const BASE_BOTON =
  'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold tracking-wide transition-colors'
const BOTON_PRIMARIO = `${BASE_BOTON} bg-amber text-sobre-amber hover:bg-amber-soft`
const BOTON_SECUNDARIO = `${BASE_BOTON} bg-graphite-600 text-ink hover:bg-graphite-500`
const BOTON_FANTASMA = `${BASE_BOTON} bg-transparent text-muted hover:text-ink hover:bg-graphite-700`

// Las fichas de esta página no son links: conservan la barra y la sombra, pero no se levantan.
const FICHA_QUIETA = 'motion-safe:hover:!translate-y-0'

function Panel({ titulo, children }) {
  return (
    <Ficha as="section" acento="neutro" className={FICHA_QUIETA}>
      <div className="px-5 pb-5 pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-texto">{titulo}</h2>
        {children}
      </div>
    </Ficha>
  )
}

function textoDueno({ cliente, cargando, error }) {
  if (cliente) return undefined
  if (error) return 'No se pudo cargar el cliente'
  return cargando ? 'Cargando…' : 'Cliente no encontrado'
}

export default function VehiculoDetalle() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const hoy = aISO(new Date())
  // "Pedir turno" y "Nueva orden" son para mostrador: los mecánicos no
  // tienen acceso a /turnos y el backend no los deja crear órdenes.
  const esMostrador = tieneAcceso(ROLES_MOSTRADOR, usuario?.rol)

  const cargarVehiculo = useCallback((t) => vehiculosService.obtener(id, t), [id])
  const cargarHistorial = useCallback((t) => vehiculosService.historial(id, t), [id])
  const cargarClientes = useCallback((t) => clientesService.listar(t), [])
  const cargarTurnos = useCallback((t) => turnosService.listar({ desde: hoy }, t), [hoy])

  const { datos: vehiculo, cargando, error, recargar } = useRecurso(cargarVehiculo)
  const {
    datos: historial,
    cargando: cargandoHistorial,
    error: errorHistorial,
  } = useRecurso(cargarHistorial)
  const {
    datos: clientes,
    cargando: cargandoClientes,
    error: errorClientes,
  } = useRecurso(cargarClientes)
  // Si los turnos no cargan (p. ej. sin permiso), el testigo queda apagado.
  const { datos: turnos } = useRecurso(cargarTurnos)

  if (cargando && !vehiculo) return <Loader texto="Cargando ficha del vehículo…" />

  if (error) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <div className="flex gap-2">
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
          <Link to="/vehiculos" className={BOTON_FANTASMA}>
            Volver al listado
          </Link>
        </div>
      </div>
    )
  }

  const cliente = (clientes ?? []).find((item) => item.id === vehiculo.cliente_id)
  // Los km se muestran solo si el dato existe (en el vehículo o en su última orden).
  const kilometraje =
    vehiculo.kilometraje ?? vehiculo.km ?? (historial ?? []).find((orden) => orden.kilometraje)?.kilometraje
  const km = Number(kilometraje) || 0

  return (
    <div className="animate-bay-in">
      <Link to="/vehiculos" className="text-sm text-muted hover:text-ink">
        ← Volver a Vehículos
      </Link>

      <Ficha as="header" className={`mt-4 ${FICHA_QUIETA}`}>
        <FichaCabecera
          antetitulo={vehiculo.marca}
          titulo={vehiculo.modelo}
          nivel="h1"
          silueta
          className="sm:px-6 sm:pt-6 sm:[&_h1]:text-3xl"
        >
          <div className="relative mt-3">
            <Patente valor={vehiculo.patente} tamano="lg" />
          </div>
          {(vehiculo.anio || vehiculo.color || km > 0) && (
            <Chips>
              {vehiculo.anio && <Chip mono>{vehiculo.anio}</Chip>}
              {vehiculo.color && <Chip color={vehiculo.color}>{vehiculo.color}</Chip>}
              {km > 0 && <Chip mono>{km.toLocaleString('es-AR')} km</Chip>}
            </Chips>
          )}
        </FichaCabecera>

        <FichaPersona
          etiqueta="Dueño"
          persona={cliente}
          texto={textoDueno({ cliente, cargando: cargandoClientes, error: errorClientes })}
          destacado={Boolean(cliente)}
          className="sm:px-6"
          aside={
            cliente && (
              <FichaLink to={`/vehiculos?cliente=${vehiculo.cliente_id}`}>Sus vehículos</FichaLink>
            )
          }
        />

        {esMostrador && (
          <FichaPie className="gap-2 px-4 py-3 sm:px-6">
            <Link
              to={`/ordenes?nuevo=1&vehiculo=${vehiculo.id}`}
              className={BOTON_SECUNDARIO}
            >
              Nueva orden
            </Link>
            <Link to={`/turnos?vehiculo=${vehiculo.id}`} className={BOTON_PRIMARIO}>
              Pedir turno
            </Link>
          </FichaPie>
        )}
      </Ficha>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel titulo="Ficha técnica">
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">VIN / chasis</dt>
              <dd className="min-w-0 break-words text-right font-mono">{vehiculo.vin || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Observaciones</dt>
              <dd className="min-w-0 break-words text-right">{vehiculo.observaciones || '—'}</dd>
            </div>
          </dl>
        </Panel>

        <Panel titulo="Titular">
          {errorClientes ? (
            <div className="mt-4">
              <Alert>{errorClientes}</Alert>
            </div>
          ) : cargandoClientes ? (
            <p className="mt-4 text-sm text-muted">Cargando…</p>
          ) : cliente ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Nombre</dt>
                <dd className="min-w-0 break-words text-right">
                  {cliente.apellido}, {cliente.nombre}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Teléfono</dt>
                <dd className="text-right">{cliente.telefono}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Correo</dt>
                <dd className="min-w-0 break-all text-right">{cliente.email || '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted">Cliente no encontrado.</p>
          )}
        </Panel>
      </div>

      <section className="mt-8">
        <h2 className="font-semibold">Libreta de service</h2>
        <p className="mt-1 text-sm text-muted">Historial de reparaciones del vehículo.</p>
        {cargandoHistorial && !historial ? (
          <Loader texto="Cargando historial…" />
        ) : errorHistorial ? (
          <div className="mt-4">
            <Alert>{errorHistorial}</Alert>
          </div>
        ) : (
          <LibretaService
            ordenes={historial ?? []}
            proximoTurno={proximoTurnoDe(turnos, vehiculo.id, hoy)}
            kilometraje={kilometraje}
            vacio={
              <Vacio
                titulo="Sin reparaciones registradas"
                mensaje="Cuando el vehículo tenga órdenes de trabajo cerradas van a aparecer acá."
              />
            }
          />
        )}
      </section>
    </div>
  )
}
