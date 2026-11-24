import Alert from '@/components/ui/Alert'
import Autocomplete from '@/components/ui/Autocomplete'
import Button from '@/components/ui/Button'
import EncabezadoPaso from './EncabezadoPaso'
import { detalleVehiculo, nombrePersona } from './formato'

/* Paso 1: el auto elegido, o la patente a buscar. Con patente nueva muestra
   `children` (los bloques de cliente y vehículo nuevos). */
export default function PasoAuto({ patente, esPatenteNueva, errores, guardando, children }) {
  const { vehiculo, titular, busqueda, cargandoVehiculoTurno } = patente
  return (
    <section className="space-y-4">
      <EncabezadoPaso numero={1} texto="¿Qué auto es?" />
      {vehiculo ? (
        <div className="rounded-box border border-graphite-600 bg-graphite-700 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-lg font-semibold text-amber-texto">{vehiculo.patente}</p>
              <p className="mt-0.5 text-sm">{detalleVehiculo(vehiculo)}</p>
              <p className="mt-1 text-xs text-muted">
                Titular: {titular ? nombrePersona(titular) : 'Cargando…'}
                {titular?.dni ? ` · DNI ${titular.dni}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={patente.cambiarVehiculo}
              className="shrink-0 text-sm text-amber-texto transition-colors hover:underline"
            >
              Cambiar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="ingreso-patente" className="mb-1.5 block text-sm font-medium text-ink">
              Patente
            </label>
            <div className="flex items-start gap-2">
              <Autocomplete
                id="ingreso-patente"
                className="min-w-0 flex-1"
                value={patente.patente}
                onChange={patente.cambiar}
                onElegir={patente.elegirSugerencia}
                onEnter={patente.buscarAhora}
                onBlur={patente.salir}
                opciones={patente.opciones}
                minimo={2}
                error={errores.patente || patente.errorBusqueda}
                placeholder="Ej.: AB123CD"
                disabled={guardando || cargandoVehiculoTurno}
                sinResultados={
                  patente.catalogosListos ? 'Ningún auto coincide con eso.' : 'Cargando autos…'
                }
                flotante={false}
                opcionClassName="flex min-h-11 flex-col justify-center"
              />
              <Button
                type="button"
                variante="secundario"
                onClick={patente.buscarAhora}
                disabled={guardando || busqueda === 'buscando' || cargandoVehiculoTurno}
                className="h-11 shrink-0"
              >
                Buscar
              </Button>
            </div>
          </div>

          {busqueda === 'buscando' && <p className="text-sm text-muted">Buscando el auto…</p>}
          {cargandoVehiculoTurno && (
            <p className="text-sm text-muted">Cargando el vehículo del turno…</p>
          )}
          {esPatenteNueva && (
            <>
              <Alert tipo="info">Patente nueva, cargamos el auto.</Alert>
              {children}
            </>
          )}
        </div>
      )}
    </section>
  )
}
