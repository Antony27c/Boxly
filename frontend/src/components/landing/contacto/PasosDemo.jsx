import Icono from '@/components/ui/Icono'

// "Qué pasa después" del formulario de demo: la demo es del plan Pro, dura 14 días
// y se otorga a las solicitudes aprobadas (docs/Oferta.md).
const PASOS = [
  {
    icono: 'correo',
    titulo: 'Te contactamos',
    texto: 'Leemos tu solicitud y te escribimos para conocer cómo trabaja tu taller.',
  },
  {
    icono: 'herramienta',
    titulo: 'Armamos tu taller',
    texto: 'Si aprobamos la solicitud, damos de alta tu taller en Boxly y te pasamos el acceso del administrador.',
  },
  {
    icono: 'check',
    titulo: 'Usás el plan Pro 14 días',
    texto: 'Lo probás con tu equipo en el día a día y, al terminar, elegís el plan que te sirva.',
  },
]

export default function PasosDemo({ idTitulo }) {
  return (
    <aside aria-labelledby={idTitulo} className="min-w-0 lg:pt-24">
      <h3 id={idTitulo} className="text-lg font-semibold">
        Qué pasa después
      </h3>
      <ol className="mt-5 space-y-5">
        {PASOS.map((paso, indice) => (
          <li key={paso.titulo} className="flex gap-4">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber/40 bg-amber/10 text-amber-texto"
            >
              <Icono nombre={paso.icono} className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">
                <span className="sr-only">Paso {indice + 1}: </span>
                {paso.titulo}
              </p>
              <p className="mt-1 text-sm text-muted">{paso.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  )
}
