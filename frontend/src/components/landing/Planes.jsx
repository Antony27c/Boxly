import { useEffect, useState } from 'react'
import Icono from '@/components/ui/Icono'
import { obtenerPlanesPublicos } from '@/services/publico'

// Sección "planes" de la landing (tarea L3, docs/Landing.md). Los precios salen de
// GET /api/v1/publico/planes (los edita el superadmin). Si la API no responde se
// muestran estos planes sin precio y con "Consultanos".
const PLANES_SIN_PRECIO = [
  { codigo: 'basico', nombre: 'Básico', precio_mensual: null, max_personal: 3 },
  { codigo: 'pro', nombre: 'Pro', precio_mensual: null, max_personal: 10 },
  { codigo: 'taller_plus', nombre: 'Taller+', precio_mensual: null, max_personal: null },
]

const INCLUYE = [
  'Órdenes, turnos, clientes y vehículos',
  'Inventario de repuestos y cobros',
  'Portal para tus clientes',
  'Métricas, auditoría y respaldo',
]

const DIAS_PRUEBA = 30

function formatoPrecio(valor) {
  const numero = Number(valor)
  if (valor == null || valor === '' || !Number.isFinite(numero)) return null
  const entero = Number.isInteger(numero)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: entero ? 0 : 2,
    maximumFractionDigits: entero ? 0 : 2,
  }).format(numero)
}

function textoLimite(maxPersonal) {
  if (maxPersonal == null) return 'Equipo sin límite'
  return maxPersonal === 1 ? 'Hasta 1 persona del equipo' : `Hasta ${maxPersonal} personas del equipo`
}

// El botón de cada plan lleva a "#contacto?plan=<codigo>". El navegador no encuentra
// un elemento con ese id, así que el desplazamiento hasta #contacto lo hacemos acá.
// El formulario (L4) lee el plan del hash y escucha "hashchange".
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

function TarjetaPlan({ plan, destacado, sinPrecio, cargando }) {
  const precio = sinPrecio ? null : formatoPrecio(plan.precio_mensual)
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

      <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-ink">
        <Icono nombre="check" className="h-4 w-4 text-ok" />
        {DIAS_PRUEBA} días de prueba
      </p>

      <ul className="mt-5 flex-1 space-y-2 border-t border-graphite-700 pt-5 text-sm text-muted">
        <li className="font-medium text-ink">Todas las funciones:</li>
        {INCLUYE.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Icono nombre="check" className="mt-0.5 h-4 w-4 text-amber-texto" />
            {item}
          </li>
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
  const lista = planes ?? PLANES_SIN_PRECIO
  // El plan del medio va destacado (con 3 planes, el segundo).
  const indiceDestacado = Math.floor((lista.length - 1) / 2)

  return (
    <section
      id="planes"
      aria-labelledby="planes-titulo"
      className="landing-seccion scroll-mt-20"
    >
      <div className="landing-caja">
        <p className="landing-chip">
          Planes
        </p>
        <h2
          id="planes-titulo"
          className="landing-titulo mt-3 max-w-2xl"
        >
          Todas las funciones en todos los planes
        </h2>
        <p className="landing-bajada">
          Lo único que cambia es el tamaño del equipo. Los clientes que usan el portal no
          cuentan. Probalo {DIAS_PRUEBA} días antes de pagar.
        </p>

        <ul className="mt-12 grid gap-6 md:grid-cols-3 md:items-stretch" aria-busy={cargando}>
          {lista.map((plan, i) => (
            <TarjetaPlan
              key={plan.codigo}
              plan={plan}
              destacado={i === indiceDestacado}
              sinPrecio={fallo}
              cargando={cargando}
            />
          ))}
        </ul>

        <p className="mt-8 text-xs leading-relaxed text-muted">
          Precios finales en pesos argentinos. El pago es mensual, por transferencia o con débito
          automático de Mercado Pago. Podés cambiar de plan cuando quieras desde la app.
        </p>
      </div>
    </section>
  )
}
