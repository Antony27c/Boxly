import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Loader from '@/components/ui/Loader'
import Vacio from '@/components/ui/Vacio'
import useRecurso from '@/hooks/useRecurso'
import { clientesService } from '@/services/clientes'
import { vehiculosService } from '@/services/vehiculos'

const TONOS = {
  Entregado: 'ok',
  Listo: 'ok',
  'En diagnóstico': 'ambar',
  'Esperando repuestos': 'ambar',
  Ingresado: 'neutro',
}

function formatearPesos(monto) {
  return monto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function formatearFecha(fecha) {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function VehiculoDetalle() {
  const { id } = useParams()

  const cargarVehiculo = useCallback((t) => vehiculosService.obtener(id, t), [id])
  const cargarHistorial = useCallback((t) => vehiculosService.historial(id, t), [id])
  const cargarClientes = useCallback((t) => clientesService.listar(t), [])

  const { datos: vehiculo, cargando, error, recargar } = useRecurso(cargarVehiculo, [id])
  const { datos: historial, cargando: cargandoHistorial } = useRecurso(cargarHistorial, [id])
  const { datos: clientes } = useRecurso(cargarClientes)

  if (cargando) return <Loader texto="Cargando ficha del vehículo…" />

  if (error) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <div className="flex gap-2">
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
          <Link to="/vehiculos">
            <Button variante="fantasma">Volver al listado</Button>
          </Link>
        </div>
      </div>
    )
  }

  const cliente = (clientes ?? []).find((item) => item.id === vehiculo.cliente_id)

  return (
    <div className="animate-bay-in">
      <Link to="/vehiculos" className="text-sm text-muted hover:text-ink">
        ← Volver a Vehículos
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-3xl font-bold tracking-widest text-amber">
            {vehiculo.patente}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {vehiculo.marca} {vehiculo.modelo}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {vehiculo.anio} · {vehiculo.combustible}
            {vehiculo.color ? ` · ${vehiculo.color}` : ''}
          </p>
        </div>
        <Link to={`/turnos?vehiculo=${vehiculo.id}`}>
          <Button>Pedir turno</Button>
        </Link>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-box border border-graphite-700 bg-graphite-800 p-5">
          <h2 className="font-semibold">Ficha técnica</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Kilometraje</dt>
              <dd>{vehiculo.kilometraje.toLocaleString('es-AR')} km</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Alta en el sistema</dt>
              <dd>{new Date(vehiculo.creado_en).toLocaleDateString('es-AR')}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Observaciones</dt>
              <dd className="text-right">{vehiculo.observaciones || '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-box border border-graphite-700 bg-graphite-800 p-5">
          <h2 className="font-semibold">Titular</h2>
          {cliente ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Nombre</dt>
                <dd>
                  {cliente.apellido}, {cliente.nombre}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Teléfono</dt>
                <dd>{cliente.telefono}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Correo</dt>
                <dd>{cliente.email || '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted">Cliente no encontrado.</p>
          )}
          <Link
            to={`/vehiculos?cliente=${vehiculo.cliente_id}`}
            className="mt-4 inline-block text-sm text-amber hover:underline"
          >
            Ver otros vehículos del cliente
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Historial de reparaciones</h2>
        {cargandoHistorial ? (
          <Loader texto="Cargando historial…" />
        ) : (historial ?? []).length === 0 ? (
          <div className="mt-4">
            <Vacio
              titulo="Sin reparaciones registradas"
              mensaje="Cuando el vehículo tenga órdenes de trabajo cerradas van a aparecer acá."
            />
          </div>
        ) : (
          <ol className="mt-4 space-y-3">
            {historial.map((orden) => (
              <li
                key={orden.id}
                className="rounded-box border border-graphite-700 bg-graphite-800 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted">{formatearFecha(orden.fecha)}</p>
                  <Badge tono={TONOS[orden.estado] ?? 'neutro'}>{orden.estado}</Badge>
                </div>
                <p className="mt-2">{orden.descripcion}</p>
                {orden.total > 0 && (
                  <p className="mt-1 text-sm text-muted">Total: {formatearPesos(orden.total)}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
