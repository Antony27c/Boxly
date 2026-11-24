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
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center rounded-full border border-graphite-500 bg-graphite-700 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted"
    >
      Próximamente
    </span>
  )
}

// Círculo punteado: lo que todavía no existe no lleva el tilde de lo incluido.
function IconoProximamente() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="mt-0.5 h-4 w-4 shrink-0 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeDasharray="2.5 2"
    >
      <circle cx="8" cy="8" r="6" />
    </svg>
  )
}

/* Disponible: tilde dorado. Próximamente: círculo punteado, texto atenuado, la
   etiqueta visible y "(próximamente)" para lectores de pantalla. */
function Item({ children, proximamente }) {
  if (!proximamente) {
    return (
      <li className="flex items-start gap-2 text-ink/90">
        <Icono nombre="check" className="mt-0.5 h-4 w-4 shrink-0 text-amber-texto" />
        <span className="min-w-0">{children}</span>
      </li>
    )
  }
  return (
    <li className="flex items-start gap-2" data-proximamente="">
      <IconoProximamente />
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted">
        <span className="min-w-0">
          {children}
          <span className="sr-only"> (próximamente)</span>
        </span>
        <ChipProximamente />
      </span>
    </li>
  )
}

function textoCupo(cupo) {
  const numero = Number(cupo)
  if (cupo == null || cupo === '' || !Number.isInteger(numero) || numero < 0) return null
  return `hasta ${numero.toLocaleString('es-AR')} facturas por mes`
}

/* Lo que muestra cada tarjeta. El primer plan cuenta la gestión diaria; los
   siguientes dicen "Todo <anterior>, más:" con lo que de verdad suman: más
   personal, avisos automáticos, ARCA incluida o con más facturas, etc.
   Los cupos salen de la API (cupo_facturas_arca); si vienen null, sin número. */
function itemsPlan(plan, anterior) {
  const propias = funcionesDePlan(plan)
  const items = []
  const agregar = (texto, codigos = []) =>
    items.push({ texto, proximamente: codigos.some((codigo) => esProximamente(codigo)) })

  if (!anterior) {
    agregar(textoLimite(plan.max_personal))
    for (const codigo of propias) {
      if (codigo === 'gestion') DETALLE_GESTION.forEach((texto) => agregar(texto))
      else agregar(etiquetaFuncion(codigo), [codigo])
    }
    if (!propias.includes('arca')) {
      agregar('Facturación ARCA como pack aparte: se paga por separado, solo si lo necesitás', [
        'arca',
      ])
    }
    return { titulo: 'Gestión diaria del taller:', items }
  }

  const previas = new Set(funcionesDePlan(anterior))
  const nuevas = propias.filter((codigo) => !previas.has(codigo))
  if (plan.max_personal !== anterior.max_personal) agregar(textoLimite(plan.max_personal))

  const avisos = ['whatsapp_automatico', 'telegram_automatico'].filter((c) => nuevas.includes(c))
  if (avisos.length === 2) agregar('Avisos automáticos por WhatsApp y Telegram', avisos)
  else avisos.forEach((codigo) => agregar(etiquetaFuncion(codigo), [codigo]))

  const cupo = textoCupo(plan.cupo_facturas_arca)
  if (nuevas.includes('arca')) {
    agregar(`Facturación electrónica ARCA incluida${cupo ? `, ${cupo}` : ''}`, ['arca'])
  } else if (propias.includes('arca') && previas.has('arca')) {
    agregar(`Facturación ARCA con más facturas por mes${cupo ? `: ${cupo}` : ''}`, ['arca'])
  }

  for (const codigo of nuevas) {
    if (avisos.includes(codigo) || codigo === 'arca') continue
    agregar(etiquetaFuncion(codigo), [codigo])
  }
  return { titulo: `Todo ${anterior.nombre}, más:`, items }
}

function TarjetaPlan({ plan, anterior, destacado, sinPrecio, cargando }) {
  const precio = sinPrecio ? null : precioDe(plan)
  const contenido = itemsPlan(plan, anterior)
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
        {contenido.items.map((item) => (
          <Item key={item.texto} proximamente={item.proximamente}>
            {item.texto}
          </Item>
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
            Mercado Pago. Podés cambiar de plan cuando quieras desde la app.
          </p>
        </div>
      </div>
    </section>
  )
}
