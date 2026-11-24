import { useEffect, useState } from 'react'
import Icono from '@/components/ui/Icono'
import {
  DETALLE_GESTION,
  PLANES_RESPALDO,
  esProximamente,
  etiquetaFuncion,
  funcionesDePlan,
} from '@/lib/funcionesPlan'
import { obtenerPlanesPublicos } from '@/services/publico'
import { pesos } from '@/utils/formato'

// Sección "planes" de la landing (docs/Landing.md y docs/Oferta.md). Nombres y precios
// salen de GET /api/v1/publico/planes (los edita el superadmin); lo que trae cada plan,
// de sus `funciones`. Si la API no responde se muestran los planes de respaldo sin
// precio y con "Consultanos".

function textoLimite(maxPersonal) {
  if (maxPersonal == null) return 'Equipo sin límite'
  return maxPersonal === 1 ? 'Hasta 1 persona del equipo' : `Hasta ${maxPersonal} personas del equipo`
}

function precioDe(plan) {
  const numero = Number(plan.precio_mensual)
  if (plan.precio_mensual == null || plan.precio_mensual === '' || !Number.isFinite(numero))
    return null
  return pesos(numero)
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

function ChipProximamente() {
  return (
    <span className="ml-1 inline-flex shrink-0 items-center rounded-full border border-graphite-500 bg-graphite-700 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
      Próximamente
    </span>
  )
}

function Item({ children, proximamente }) {
  return (
    <li className="flex items-start gap-2">
      <Icono nombre="check" className="mt-0.5 h-4 w-4 shrink-0 text-amber-texto" />
      <span>
        {children}
        {proximamente && <ChipProximamente />}
      </span>
    </li>
  )
}

/* Cada plan suma sobre el anterior: el primero cuenta la gestión diaria y los
   siguientes dicen "Todo <anterior>, más:" con lo que agregan. */
function contenidoPlan(plan, anterior) {
  const propias = funcionesDePlan(plan)
  if (!anterior) {
    return { titulo: 'Gestión diaria del taller:', funciones: propias, detalleGestion: true }
  }
  const previas = new Set(funcionesDePlan(anterior))
  return {
    titulo: `Todo ${anterior.nombre}, más:`,
    funciones: propias.filter((codigo) => !previas.has(codigo)),
    detalleGestion: false,
  }
}

function TarjetaPlan({ plan, anterior, destacado, sinPrecio, cargando }) {
  const precio = sinPrecio ? null : precioDe(plan)
  const contenido = contenidoPlan(plan, anterior)
  const sinArca = !funcionesDePlan(plan).includes('arca')
  return (
    <li
      className={`landing-tarjeta landing-revelar relative flex flex-col ${
        destacado ? '!border-amber shadow-lift md:-my-2 md:!py-8' : ''
      }`}
    >
      {destacado && (
        <p className="absolute -top-3 left-6 rounded-full bg-amber px-3 py-0.5 text-xs font-semibold text-sobre-amber">
          Recomendado
        </p>
      )}
      <h3 className="text-lg font-semibold text-ink">{plan.nombre}</h3>
      <p className="mt-1 text-sm text-muted">{textoLimite(plan.max_personal)}</p>

      <div className="mt-5 min-h-[3.5rem]">
        {cargando ? (
          <p className="text-sm text-muted">Cargando precio…</p>
        ) : precio ? (
          <p className="text-ink">
            <span className="text-3xl font-bold tracking-tight">{precio}</span>
            <span className="text-sm text-muted"> por mes</span>
          </p>
        ) : (
          <p className="text-2xl font-bold tracking-tight text-ink">Consultanos</p>
        )}
      </div>

      <ul className="mt-5 flex-1 space-y-2 border-t border-graphite-700 pt-5 text-sm text-muted">
        <li className="font-medium text-ink">{contenido.titulo}</li>
        {contenido.funciones.flatMap((codigo) =>
          codigo === 'gestion' && contenido.detalleGestion
            ? DETALLE_GESTION.map((texto) => <Item key={texto}>{texto}</Item>)
            : [
                <Item key={codigo} proximamente={esProximamente(codigo)}>
                  {etiquetaFuncion(codigo)}
                </Item>,
              ],
        )}
        {sinArca && (
          <Item proximamente={esProximamente('arca')}>
            Facturación ARCA disponible como adicional
          </Item>
        )}
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

export default function Planes() {
  const [planes, setPlanes] = useState(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    let vigente = true
    obtenerPlanesPublicos()
      .then((datos) => {
        if (!vigente) return
        if (Array.isArray(datos) && datos.length > 0) setPlanes(datos)
        else setFallo(true)
      })
      .catch(() => {
        if (vigente) setFallo(true)
      })
    return () => {
      vigente = false
    }
  }, [])

  const cargando = planes === null && !fallo
  const lista = planes ?? PLANES_RESPALDO
  // El plan del medio va destacado (con 3 planes, el segundo).
  const indiceDestacado = Math.floor((lista.length - 1) / 2)

  return (
    <section
      id="planes"
      aria-labelledby="planes-titulo"
      className="landing-seccion scroll-mt-20"
    >
      <div className="landing-caja">
        <p className="landing-chip">Planes</p>
        <h2 id="planes-titulo" className="landing-titulo mt-3 max-w-2xl">
          Un plan para cada etapa de tu taller
        </h2>
        <p className="landing-bajada">
          Todos traen la gestión diaria; los planes más grandes suman automatización. Los
          clientes que usan el portal no cuentan como personal. Pedí una demo: 14 días del
          plan Pro, previa aprobación.
        </p>

        <ul className="mt-12 grid gap-6 md:grid-cols-3 md:items-stretch" aria-busy={cargando}>
          {lista.map((plan, i) => (
            <TarjetaPlan
              key={plan.codigo}
              plan={plan}
              anterior={i > 0 ? lista[i - 1] : null}
              destacado={i === indiceDestacado}
              sinPrecio={fallo}
              cargando={cargando}
            />
          ))}
        </ul>

        <div className="mt-8 space-y-1 text-xs leading-relaxed text-muted">
          <p className="font-medium text-ink">Precios de referencia, sujetos a cambios.</p>
          <p>
            Precios finales en pesos argentinos. El pago es mensual, con débito automático de
            Mercado Pago. Los avisos automáticos por WhatsApp y las facturas ARCA tienen un cupo
            mensual según el plan. Podés cambiar de plan cuando quieras desde la app.
          </p>
        </div>
      </div>
    </section>
  )
}
