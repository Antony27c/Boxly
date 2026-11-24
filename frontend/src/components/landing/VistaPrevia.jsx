import MaquetaHoy from '@/components/landing/maquetas/MaquetaHoy'
import MaquetaOrden from '@/components/landing/maquetas/MaquetaOrden'
import MaquetaPortal from '@/components/landing/maquetas/MaquetaPortal'

// Vista previa del producto: maquetas en HTML/CSS de pantallas reales (no
// capturas). Las maquetas son decorativas: van aria-hidden y cada una tiene su
// descripción visible en el figcaption. Los datos son de ejemplo.
const PANTALLAS = [
  {
    id: 'orden',
    titulo: 'La orden',
    texto: 'Una orden en diagnóstico con sus líneas: trabajos, repuestos y lo que falta cotizar.',
    Maqueta: MaquetaOrden,
  },
  {
    id: 'portal',
    titulo: 'El seguimiento del cliente',
    texto: 'Lo que ve tu cliente en el celular: la etapa, la entrega estimada y las novedades con fotos.',
    Maqueta: MaquetaPortal,
  },
  {
    id: 'hoy',
    titulo: 'El tablero de hoy',
    texto: 'Turnos del día, autos listos para entregar, cobros por aprobar y repuestos con stock bajo.',
    Maqueta: MaquetaHoy,
  },
]

export default function VistaPrevia() {
  return (
    <section id="producto" aria-labelledby="producto-titulo" className="landing-seccion scroll-mt-20 overflow-hidden">
      <div className="landing-caja">
        <p className="landing-chip">El producto</p>
        <h2 id="producto-titulo" className="landing-titulo mt-3">
          Así se ve Boxly
        </h2>
        <p className="landing-bajada">
          Pantallas del sistema, en la compu y en el celular. Los nombres, autos y montos son de ejemplo.
        </p>

        <div className="mt-10 grid items-start gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {PANTALLAS.map(({ id, titulo, texto, Maqueta }) => (
            <figure key={id} data-maqueta={id} className="min-w-0">
              <div aria-hidden="true" className="relative">
                <span className="absolute -top-3 right-3 z-30 rounded-full border border-graphite-600 bg-graphite-800 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
                  Ejemplo
                </span>
                <Maqueta />
              </div>
              <figcaption className="mt-4">
                <span className="block font-bold">{titulo}</span>
                <span className="mt-1 block text-sm text-muted">{texto}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
