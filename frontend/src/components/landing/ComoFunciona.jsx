import Icono from '@/components/ui/Icono'

// Del turno a la entrega: el recorrido real de una orden en Boxly
// (docs/Guia-de-uso.md, secciones 3, 4 y 6).
const PASOS_RECORRIDO = [
  {
    icono: 'turnos',
    titulo: 'Turno',
    texto: 'Recepción agenda día, horario y servicio. Cada horario admite un solo auto.',
  },
  {
    icono: 'ordenes',
    titulo: 'Recepción y orden',
    texto: 'Llega el auto: con "Recibir auto" o con la patente se abre la orden, con su cliente y su mecánico.',
  },
  {
    icono: 'herramienta',
    titulo: 'Diagnóstico y trabajo',
    texto: 'El mecánico avanza las etapas, carga trabajos y repuestos y suma fotos. Sin tocar precios.',
  },
  {
    icono: 'correo',
    titulo: 'Cotización y aviso',
    texto: 'Recepción cotiza las líneas pendientes. El cliente sigue cada etapa en su portal y recibe avisos por correo.',
  },
  {
    icono: 'dinero',
    titulo: 'Cobro',
    texto: 'Con la orden lista se emite el cobro. El cliente paga en el taller o, con el cobro online habilitado, con Mercado Pago.',
  },
  {
    icono: 'check',
    titulo: 'Entrega',
    texto: 'Con el pago acreditado entregás el auto: la orden pasa a Entregado y queda en el historial del vehículo.',
  },
]

export default function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-titulo"
      className="landing-seccion scroll-mt-20"
    >
      <div className="landing-caja">
        <p className="landing-chip">Cómo funciona</p>
        <h2 id="como-funciona-titulo" className="landing-titulo mt-3">
          Del turno a la entrega
        </h2>
        <p className="landing-bajada">
          El auto recorre el taller y la orden lo acompaña. Todos ven en qué etapa está, también el cliente.
        </p>

        <ol className="mt-10 grid gap-x-6 gap-y-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-8">
          {PASOS_RECORRIDO.map((paso, indice) => {
            const ultimo = indice === PASOS_RECORRIDO.length - 1
            return (
              <li key={paso.titulo} className="relative flex gap-4 pb-8 sm:pb-6 lg:pb-0">
                {/* Línea de la ruta entre pasos (solo en la columna del celular). */}
                {!ultimo && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-6 top-12 w-px -translate-x-1/2 border-l-2 border-dashed border-graphite-500 sm:hidden"
                  />
                )}
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-box border border-graphite-600 bg-graphite-900 text-amber-texto">
                  <Icono nombre={paso.icono} className="h-6 w-6" />
                  <span
                    aria-hidden="true"
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber font-mono text-xs font-bold text-sobre-amber"
                  >
                    {indice + 1}
                  </span>
                </div>
                <div className="min-w-0 pt-1">
                  <h3 className="text-base font-bold">
                    <span className="sr-only">Paso {indice + 1}: </span>
                    {paso.titulo}
                  </h3>
                  <p className="mt-1 text-sm text-muted">{paso.texto}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
