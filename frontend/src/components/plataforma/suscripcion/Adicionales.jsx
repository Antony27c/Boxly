import Button from '@/components/ui/Button'
import { Chip } from '@/components/ui/Ficha'
import { etiquetaFuncion } from '../funciones'
import { fechaSuscripcion } from './formatos'

/* Adicionales del taller (docs/Oferta.md §4): hoy el único confirmado es
   ARCA. Muestra los vigentes con sus fechas y permite activar/desactivar;
   las mutaciones las maneja la página que compone esta sección. */
export default function Adicionales({ adicionales, onActivar, onDesactivar }) {
  // Un adicional está activo salvo que la API diga lo contrario; el botón de
  // activar solo se muestra si no hay uno vigente para ese código.
  const arcaActivo = adicionales.some((a) => a.codigo === 'arca' && a.activo !== false)

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Adicionales</h3>
        {!arcaActivo && (
          <Button variante="secundario" icono="mas_simple" onClick={onActivar}>
            Activar adicional
          </Button>
        )}
      </div>
      {adicionales.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No hay adicionales para este taller.</p>
      ) : (
        <ul className="mt-2 divide-y divide-graphite-700">
          {adicionales.map((adicional) => {
            const activo = adicional.activo !== false
            return (
              <li
                key={adicional.codigo}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="text-sm font-semibold text-ink">
                  {etiquetaFuncion(adicional.codigo)}
                </span>
                <Chip tono={activo ? 'ok' : 'neutro'}>{activo ? 'Activo' : 'Inactivo'}</Chip>
                <span className="text-xs text-muted">
                  {adicional.desde
                    ? `Desde ${fechaSuscripcion(adicional.desde)}`
                    : 'Sin fecha de inicio'}
                  {adicional.hasta ? ` · Hasta ${fechaSuscripcion(adicional.hasta)}` : ''}
                </span>
                {activo && (
                  <Button
                    variante="fantasma"
                    className="ml-auto !px-3 !py-1.5 text-xs"
                    onClick={() => onDesactivar(adicional.codigo)}
                  >
                    Desactivar
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
