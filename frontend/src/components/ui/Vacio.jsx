import Icono from '@/components/ui/Icono'
import BoxVacio from '@/components/ilustraciones/BoxVacio'
import Elevador from '@/components/ilustraciones/Elevador'
import Estante from '@/components/ilustraciones/Estante'
import Portapapeles from '@/components/ilustraciones/Portapapeles'

const ILUSTRACIONES = {
  elevador: Elevador,
  estante: Estante,
  portapapeles: Portapapeles,
  box: BoxVacio,
}

// Dibujo que corresponde a cada icono cuando no se pide uno explícito.
const ILUSTRACION_POR_ICONO = {
  ordenes: 'elevador',
  inventario: 'estante',
  turnos: 'portapapeles',
  vehiculos: 'box',
}

// `ilustracion` acepta una clave de ILUSTRACIONES; con `false` queda el círculo.
export default function Vacio({ titulo, mensaje, accion, icono = 'info', ilustracion }) {
  const clave = ilustracion ?? ILUSTRACION_POR_ICONO[icono]
  const Dibujo = ILUSTRACIONES[clave]

  return (
    <div className="rounded-box border border-dashed border-graphite-600 px-6 py-12 text-center">
      {Dibujo ? (
        <div className="relative mx-auto h-20 w-28" data-ilustracion={clave} aria-hidden="true">
          {/* El icono va primero en el DOM y se ve como insignia sobre el dibujo. */}
          <span className="absolute -bottom-1 right-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-graphite-600 bg-graphite-800 text-amber-texto">
            <Icono nombre={icono} className="h-4 w-4" />
          </span>
          <Dibujo className="h-20 w-28" />
        </div>
      ) : (
        <span
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber/10 text-amber-texto"
          aria-hidden="true"
        >
          <Icono nombre={icono} className="h-6 w-6" />
        </span>
      )}
      <h3 className="mt-4 font-semibold">{titulo}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{mensaje}</p>
      {accion && <div className="mt-5 flex justify-center">{accion}</div>}
    </div>
  )
}
