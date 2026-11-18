import { Link } from 'react-router-dom'
import Icono from '@/components/ui/Icono'

// Un ítem del acordeón de la ayuda. El contenido se anima con
// grid-template-rows (0fr → 1fr) y queda oculto (visibility) al cerrar para
// que sus links no reciban foco ni se lean con lectores de pantalla.
export default function PreguntaFrecuente({ pregunta, abierta, onAlternar }) {
  const idBoton = `ayuda-pregunta-${pregunta.id}`
  const idPanel = `ayuda-respuesta-${pregunta.id}`

  return (
    <div className="overflow-hidden rounded-box border border-graphite-700 bg-graphite-800">
      <h3>
        <button
          type="button"
          id={idBoton}
          aria-expanded={abierta}
          aria-controls={idPanel}
          onClick={onAlternar}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-graphite-700/60"
        >
          <span className="text-sm font-medium text-ink sm:text-base">
            {pregunta.pregunta}
          </span>
          <Icono
            nombre="abajo"
            className={`h-5 w-5 shrink-0 text-muted transition-transform duration-200 ${
              abierta ? 'rotate-180' : ''
            }`}
          />
        </button>
      </h3>
      <div
        id={idPanel}
        role="region"
        aria-labelledby={idBoton}
        className={`grid transition-all duration-300 ease-out ${
          abierta ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-3 px-4 pb-4 text-sm leading-relaxed text-muted">
            {pregunta.respuesta.map((parrafo, indice) => (
              <p key={indice}>{parrafo}</p>
            ))}
            {pregunta.enlace && (
              <Link
                to={pregunta.enlace.a}
                className="inline-flex items-center gap-1.5 font-semibold text-amber-texto hover:underline"
              >
                Ir a {pregunta.enlace.texto}
                <Icono nombre="flecha" className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
