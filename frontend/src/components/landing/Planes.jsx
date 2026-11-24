import { useEffect, useState } from 'react'
import { PLANES_RESPALDO } from '@/lib/funcionesPlan'
import { obtenerPlanesPublicos } from '@/services/publico'
import TarjetaPlan from './planes/TarjetaPlan'
import { hayPagoAnual, itemsComparables } from './planes/oferta'

// Sección "planes" de la landing (docs/Landing.md y docs/Oferta.md). Nombres, precios,
// cupos y descuento anual salen de GET /api/v1/publico/planes (los edita el
// superadmin). Las tres tarjetas muestran la misma lista, con lo que cada plan trae
// y lo que no, para que se vea la diferencia. Si la API no responde se muestran los
// planes de respaldo sin precio y con "Consultanos".

function SelectorPeriodo({ anual, onCambiar }) {
  const opciones = [
    { valor: false, texto: 'Mensual' },
    { valor: true, texto: 'Anual' },
  ]
  return (
    <div
      role="group"
      aria-label="Período de pago"
      className="mt-8 inline-flex rounded-full border border-graphite-600 bg-graphite-800 p-1"
    >
      {opciones.map((opcion) => (
        <button
          key={opcion.texto}
          type="button"
          aria-pressed={anual === opcion.valor}
          onClick={() => onCambiar(opcion.valor)}
          className={`min-h-[40px] rounded-full px-5 text-sm font-semibold transition ${
            anual === opcion.valor ? 'bg-amber text-sobre-amber' : 'text-muted hover:text-ink'
          }`}
        >
          {opcion.texto}
        </button>
      ))}
    </div>
  )
}

export default function Planes() {
  const [planes, setPlanes] = useState(null)
  const [fallo, setFallo] = useState(false)
  const [anual, setAnual] = useState(false)

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
  // El plan del medio va destacado (con 3 planes, el segundo) y el último es el ancla.
  const indiceDestacado = Math.floor((lista.length - 1) / 2)
  const conAnual = !fallo && hayPagoAnual(lista)

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
          Todos traen la gestión diaria; Pro y Profesional suman los avisos automáticos, la
          facturación ARCA y más personal. Los clientes que usan el portal no cuentan como
          personal. Pedí una demo: 14 días del plan Pro, previa aprobación.
        </p>

        {conAnual && <SelectorPeriodo anual={anual} onCambiar={setAnual} />}

        <ul
          className="mt-12 grid gap-6 md:grid-cols-3 md:items-stretch"
          aria-busy={cargando}
        >
          {lista.map((plan, i) => (
            <TarjetaPlan
              key={plan.codigo}
              plan={plan}
              items={itemsComparables(lista, i)}
              destacado={i === indiceDestacado}
              completo={lista.length > 1 && i === lista.length - 1}
              sinPrecio={fallo}
              cargando={cargando}
              anual={conAnual && anual}
            />
          ))}
        </ul>

        <div className="mt-8 space-y-1 text-xs leading-relaxed text-muted">
          <p className="font-medium text-ink">Precios de referencia, sujetos a cambios.</p>
          <p>
            Precios finales en pesos argentinos. El pago es{' '}
            {conAnual ? 'mensual, o anual en los planes que lo ofrecen,' : 'mensual,'} con
            débito automático de Mercado Pago. Podés cambiar de plan cuando quieras desde la app.
          </p>
        </div>
      </div>
    </section>
  )
}
