import { Link, useNavigate } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Ficha } from '@/components/ui/Ficha'
import { accionEjecutable, pagosDuplicados } from '@/services/ordenes'
import { DatoOrden, DatoVehiculo, LineaPersona } from './DatosFila'
import { ACENTO_TURNO, BOTON_FILA, FILA, acentoOrden } from './estilos'

// Pago online que entró con la orden ya pagada: hay que devolverlo. Lo marca
// el backend (`tiene_pago_duplicado`) o se deduce de los pagos de la orden.
function tienePagoDuplicado(orden) {
  return Boolean(orden.tiene_pago_duplicado) || pagosDuplicados(orden).length > 0
}

export function FilaOrden({ orden, rol, detalle = '' }) {
  const navigate = useNavigate()
  const accion = accionEjecutable(orden, rol)
  return (
    <Ficha acento={acentoOrden(orden)} className={FILA}>
      <Link to={`/ordenes/${orden.id}`} className="min-w-0 flex-1 py-2.5 pl-4 pr-1">
        <DatoOrden orden={orden} detalle={detalle} />
      </Link>
      {tienePagoDuplicado(orden) && (
        <span className="inline-flex max-sm:ml-4">
          <Badge tono="peligro">Pago duplicado</Badge>
        </span>
      )}
      <span className="hidden sm:inline-flex">
        <Badge tono="neutro">{orden.estado}</Badge>
      </span>
      {accion && (
        <Button
          variante="secundario"
          className={BOTON_FILA}
          onClick={() => navigate(`/ordenes/${orden.id}?accion=1`)}
        >
          {accion.texto}
        </Button>
      )}
    </Ficha>
  )
}

export function FilaTurno({ turno, cliente, vehiculo }) {
  const navigate = useNavigate()
  const nombreCliente = cliente ? `${cliente.apellido}, ${cliente.nombre}` : 'Cliente'
  const conVehiculo = Boolean(vehiculo?.modelo || vehiculo?.marca || vehiculo?.patente)
  return (
    <Ficha acento={ACENTO_TURNO[turno.estado] ?? 'neutro'} className={FILA}>
      <span className="flex w-16 shrink-0 justify-center self-stretch border-r border-graphite-700 py-2.5 pl-2">
        <span className="self-center font-mono text-lg font-bold tabular-nums text-ink">{turno.hora}</span>
      </span>
      <span className="min-w-0 flex-1 py-2.5 pl-1">
        <DatoVehiculo
          marca={vehiculo?.marca}
          modelo={vehiculo?.modelo}
          patente={vehiculo?.patente}
          sinPatente={
            !conVehiculo && (
              <span className="block truncate text-base font-extrabold tracking-tight text-ink">
                {turno.servicio || 'Turno'}
              </span>
            )
          }
        />
        <LineaPersona
          nombre={nombreCliente}
          persona={cliente ?? ''}
          detalle={conVehiculo ? turno.servicio : ''}
        />
      </span>
      <Button
        variante="secundario"
        className={BOTON_FILA}
        onClick={() => navigate(`/turnos?recibir=${turno.id}`)}
      >
        Recibir auto
      </Button>
    </Ficha>
  )
}

export function FilaRepuesto({ repuesto }) {
  return (
    <Ficha acento={Number(repuesto.stock) <= 0 ? 'danger' : 'amber'} className={FILA}>
      <Link to="/inventario" className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4">
        <span className="min-w-0 flex-1 leading-tight">
          {repuesto.codigo && (
            <span className="block truncate font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-texto">
              {repuesto.codigo}
            </span>
          )}
          <span className="block truncate text-base font-extrabold tracking-tight text-ink">{repuesto.nombre}</span>
          <span className="mt-1 block truncate text-xs text-muted">
            stock {repuesto.stock} · mínimo {repuesto.stock_minimo}
          </span>
        </span>
        <Badge tono="peligro">{repuesto.stock}</Badge>
      </Link>
    </Ficha>
  )
}

// Fila del mecánico: toda la fila abre la orden; la acción, con el paso ya iniciado.
export function FilaTrabajo({ orden, rol }) {
  const navigate = useNavigate()
  const accion = accionEjecutable(orden, rol)
  return (
    <Ficha acento={acentoOrden(orden)} className={FILA}>
      <button
        type="button"
        onClick={() => navigate(`/ordenes/${orden.id}`)}
        className="min-w-0 flex-1 py-3 pl-4 pr-1 text-left"
      >
        <DatoOrden orden={orden} />
      </button>
      {accion && (
        // ?accion=1: la orden se abre con el paso ya iniciado (un toque menos).
        <Button
          variante="primario"
          className={BOTON_FILA}
          onClick={() => navigate(`/ordenes/${orden.id}?accion=1`)}
        >
          {accion.texto}
        </Button>
      )}
    </Ficha>
  )
}
