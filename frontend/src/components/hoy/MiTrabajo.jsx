import { Link } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Loader from '@/components/ui/Loader'
import Vacio from '@/components/ui/Vacio'
import { fechaLarga } from './estilos'
import { FilaTrabajo } from './Filas'
import { useMiTrabajo } from './useHoy'

/* Hoy del mecánico: sus órdenes abiertas, primero lo que hay que hacer ya. */
export default function MiTrabajo({ usuario }) {
  const { ordenes, mias, cargando, error, recargar } = useMiTrabajo(usuario)

  return (
    <div className="animate-bay-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mi trabajo</h1>
          <p className="mt-1.5 text-sm text-muted">
            Hola, {usuario?.nombre ?? 'usuario'} · {fechaLarga()}
          </p>
        </div>
        <Link
          to="/ordenes?filtro=mias"
          className="mt-1 shrink-0 text-sm font-medium text-amber-texto hover:underline"
        >
          Ver todas
        </Link>
      </div>

      {error && (
        <div className="mt-4 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      )}

      {cargando && !ordenes ? (
        <Loader texto="Cargando tus órdenes…" />
      ) : !error && mias.length === 0 ? (
        <div className="mt-6">
          <Vacio
            titulo="No tenés órdenes asignadas"
            mensaje="Cuando recepción te asigne un auto, va a aparecer acá con lo que tenés que hacer."
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {mias.map((orden) => (
            <FilaTrabajo key={orden.id} orden={orden} rol={usuario?.rol} />
          ))}
        </ul>
      )}
    </div>
  )
}
