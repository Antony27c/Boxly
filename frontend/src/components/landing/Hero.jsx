import Icono from '@/components/ui/Icono'

const BENEFICIOS = [
  {
    icono: 'ordenes',
    titulo: 'Órdenes y turnos en un solo lugar',
    texto: 'Del ingreso del auto a la entrega: etapas, comentarios y agenda.',
  },
  {
    icono: 'portal',
    titulo: 'Tu cliente sigue su auto desde el celular',
    texto: 'Ve cada etapa del trabajo con fotos, sin tener que llamar al taller.',
  },
  {
    icono: 'inventario',
    titulo: 'Repuestos y números bajo control',
    texto: 'Inventario con stock mínimo, cobros y métricas del taller.',
  },
]

const ETAPAS_ORDEN = ['Ingresado', 'En diagnóstico', 'Listo']

// Primera sección de la landing: propuesta, botones y una maqueta liviana de la
// app (tarjeta de orden con etapas + portal del cliente). Decorativa: el texto
// ya cuenta todo, por eso va con aria-hidden.
export default function Hero() {
  return (
    <section id="inicio" className="landing-seccion landing-seccion--hero">
      <div className="landing-caja grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="landing-chip">Para talleres mecánicos</p>

          <h1 className="mt-5 text-4xl font-bold leading-[1.06] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
            Todo el taller, de la recepción a la entrega.
          </h1>

          <p className="landing-bajada mt-5 text-lg">
            Órdenes de trabajo, turnos, repuestos, inventario y cobros en un solo
            lugar. Y un portal donde tu cliente sigue su auto desde el celular.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#contacto" className="landing-boton">
              Pedí una demo
              <Icono nombre="flecha" className="h-4 w-4" />
            </a>
            <a href="#planes" className="landing-boton landing-boton--secundario">
              Ver los planes
            </a>
          </div>

          <ul className="mt-10 space-y-3.5">
            {BENEFICIOS.map((beneficio) => (
              <li key={beneficio.titulo} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber/15 text-amber-texto">
                  <Icono nombre={beneficio.icono} className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">
                    {beneficio.titulo}
                  </span>
                  <span className="block text-sm text-muted">{beneficio.texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <MaquetaApp />
      </div>
    </section>
  )
}

// Maqueta de la app en HTML/CSS con los tokens del tema: ventana de órdenes a
// la izquierda y el portal del cliente asomando abajo a la derecha.
function MaquetaApp() {
  return (
    <div className="relative" aria-hidden="true">
      <div className="overflow-hidden rounded-2xl border border-graphite-600 bg-graphite-800 shadow-lift">
        {/* Barra de la ventana */}
        <div className="flex items-center gap-2 border-b border-graphite-600 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-graphite-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-graphite-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber" />
          <span className="ml-3 h-2 w-24 rounded-full bg-graphite-600" />
          <span className="ml-auto text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
            Órdenes
          </span>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          {/* Tarjeta de orden */}
          <div className="rounded-xl border border-graphite-600 bg-graphite-700/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-ink">Service menor</p>
                <p className="mt-0.5 text-xs text-muted">Fiat Cronos · AB 123 CD</p>
              </div>
              <span className="rounded-full bg-amber/15 px-2.5 py-1 text-[0.65rem] font-semibold text-amber-texto">
                En diagnóstico
              </span>
            </div>

            {/* Etapas de la orden */}
            <ol className="mt-4 flex items-center">
              {ETAPAS_ORDEN.map((etapa, indice) => (
                <li key={etapa} className="flex flex-1 items-center last:flex-none">
                  <span className="flex flex-col items-center gap-1.5">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full border-2 text-[0.6rem] font-bold ${
                        indice <= 1
                          ? 'border-amber bg-amber text-sobre-amber'
                          : 'border-graphite-500 text-muted'
                      }`}
                    >
                      {indice <= 1 ? <Icono nombre="check" className="h-3 w-3" /> : indice + 1}
                    </span>
                    <span className="whitespace-nowrap text-[0.6rem] text-muted">{etapa}</span>
                  </span>
                  {indice < ETAPAS_ORDEN.length - 1 && (
                    <span
                      className={`mx-1 mb-4 h-0.5 flex-1 rounded ${
                        indice === 0 ? 'bg-amber' : 'bg-graphite-600'
                      }`}
                    />
                  )}
                </li>
              ))}
            </ol>

            <div className="mt-4 flex items-center justify-between border-t border-graphite-600 pt-3">
              <span className="text-[0.65rem] text-muted">Entrega estimada: viernes</span>
              <span className="text-xs font-semibold text-ink">Ver orden</span>
            </div>
          </div>

          {/* Celular con el portal del cliente */}
          <div className="mx-auto w-32 shrink-0 rounded-[1.4rem] border-2 border-graphite-500 bg-graphite-900 p-2.5 sm:mx-0 sm:w-36">
            <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-graphite-600" />
            <p className="text-center text-[0.6rem] font-bold text-ink">Portal del cliente</p>
            <div className="mt-2 space-y-1.5">
              {['Turno confirmado', 'Auto en diagnóstico', 'Fotos del trabajo'].map((item) => (
                <p key={item} className="flex items-center gap-1.5 text-[0.55rem] text-muted">
                  <Icono nombre="check" className="h-2.5 w-2.5 shrink-0 text-ok" />
                  {item}
                </p>
              ))}
            </div>
            <span className="mt-2.5 block rounded-md bg-amber px-2 py-1 text-center text-[0.55rem] font-bold text-sobre-amber">
              Pagar
            </span>
          </div>
        </div>
      </div>

      {/* Chip flotante: agenda */}
      <div className="absolute -bottom-5 left-6 hidden items-center gap-2 rounded-full border border-graphite-600 bg-graphite-800 px-3.5 py-2 text-xs font-semibold text-ink shadow-lift sm:flex">
        <Icono nombre="turnos" className="h-4 w-4 text-amber-texto" />
        Turnos agendados
      </div>
    </div>
  )
}
