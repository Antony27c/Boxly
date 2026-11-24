import Icono from '@/components/ui/Icono'
import { pesos } from '@/utils/formato'
import { precioAnual, precioMensual, textoPorDia } from './oferta'

/* Subtítulo de cada plan. Solo describe lo que trae: nada de "el más elegido"
   ni otras cifras que no tenemos. */
const SUBTITULOS = {
  esencial: 'Para ordenar la gestión diaria del taller',
  pro: 'Ideal para talleres que facturan y quieren avisar solos a sus clientes',
  profesional: 'El plan más completo, para talleres que crecen',
}

// El botón de cada plan lleva a "#contacto?plan=<codigo>". El navegador no encuentra
// un elemento con ese id, así que el desplazamiento hasta #contacto lo hacemos acá.
// El formulario lee el plan del hash y escucha "hashchange".
function hashContacto(codigo) {
  return `#contacto?plan=${encodeURIComponent(codigo)}`
}

function irAContacto(evento, codigo) {
  evento.preventDefault()
  // Asignar el hash dispara "hashchange", que es lo que escucha el formulario.
  window.location.hash = hashContacto(codigo)
  const destino = document.getElementById('contacto')
  if (!destino) return
  const reducir =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  destino.scrollIntoView?.({ behavior: reducir ? 'auto' : 'smooth', block: 'start' })
}

// Cruz fina: lo que el plan no trae.
function IconoNoIncluido() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      data-no-incluido=""
      className="mt-0.5 h-4 w-4 shrink-0 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </svg>
  )
}

/* Incluido: tilde dorado. No incluido: cruz fina, texto gris (muted, AA en los dos
   temas) con tachado suave y "(no incluido)" para lectores de pantalla. */
function Item({ texto, incluido }) {
  if (incluido) {
    return (
      <li className="flex items-start gap-2 text-ink">
        <Icono nombre="check" className="mt-0.5 h-4 w-4 shrink-0 text-amber-texto" />
        <span className="min-w-0">{texto}</span>
      </li>
    )
  }
  return (
    <li className="flex items-start gap-2 text-muted" data-no-incluido="">
      <IconoNoIncluido />
      <span className="min-w-0 line-through decoration-muted/50">
        {texto}
        <span className="sr-only"> (no incluido)</span>
      </span>
    </li>
  )
}

function Precio({ plan, cargando, sinPrecio, anual }) {
  if (cargando) return <p className="text-sm text-muted">Cargando precio…</p>
  const mensual = sinPrecio ? null : precioMensual(plan)
  if (mensual == null) {
    return <p className="text-2xl font-bold tracking-tight text-ink">Consultanos</p>
  }
  const delAnio = anual ? precioAnual(plan) : null
  if (delAnio) {
    return (
      <>
        <p className="text-ink">
          <span className="text-3xl font-bold tracking-tight">{delAnio.total}</span>
          <span className="text-sm text-muted"> por año (pago anual)</span>
        </p>
        <p className="mt-1 text-sm font-semibold text-ink">
          Ahorrás {delAnio.ahorro} ({delAnio.pct}% de descuento)
        </p>
      </>
    )
  }
  return (
    <>
      <p className="text-ink">
        <span className="text-3xl font-bold tracking-tight">{pesos(mensual)}</span>
        <span className="text-sm text-muted"> por mes</span>
      </p>
      {anual ? (
        <p className="mt-1 text-sm text-muted">Este plan se paga mes a mes.</p>
      ) : (
        <p className="mt-1 text-sm text-muted">{textoPorDia(mensual)}</p>
      )}
    </>
  )
}

export default function TarjetaPlan({ plan, items, destacado, completo, cargando, sinPrecio, anual }) {
  const subtitulo = SUBTITULOS[plan.codigo]
  return (
    <li
      className={`landing-tarjeta landing-revelar landing-plan relative flex flex-col ${
        destacado ? 'landing-plan--destacado' : ''
      } ${completo ? 'landing-plan--completo' : ''}`}
    >
      {destacado && (
        <p className="absolute -top-3 left-6 rounded-full bg-amber px-3 py-0.5 text-xs font-semibold text-sobre-amber">
          Recomendado
        </p>
      )}
      <h3 className="text-lg font-semibold text-ink">{plan.nombre}</h3>
      {subtitulo && <p className="mt-1 text-sm text-muted">{subtitulo}</p>}

      <div className="mt-5 min-h-[4.5rem]">
        <Precio plan={plan} cargando={cargando} sinPrecio={sinPrecio} anual={anual} />
      </div>

      <ul className="mt-5 flex-1 space-y-2 border-t border-graphite-700 pt-5 text-sm">
        {items.map((item) => (
          <Item key={item.clave} texto={item.texto} incluido={item.incluido} />
        ))}
      </ul>

      <a
        href={hashContacto(plan.codigo)}
        onClick={(evento) => irAContacto(evento, plan.codigo)}
        className={`landing-boton mt-6 min-h-[44px] ${destacado ? '' : 'landing-boton--secundario'}`}
      >
        Quiero el plan {plan.nombre}
      </a>
    </li>
  )
}
