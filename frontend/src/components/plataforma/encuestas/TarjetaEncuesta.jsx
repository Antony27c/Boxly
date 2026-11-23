import { Link } from 'react-router-dom'
import { Chip, Chips, Ficha, FichaCabecera, FichaSeccion } from '@/components/ui/Ficha'
import { fechaHora } from '../formatos'
import { intencionDe, tallerDe } from './intenciones'

function Estrellas({ puntaje }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden="true" className="tracking-tight text-amber-texto">
        {'★'.repeat(puntaje)}
        <span className="text-graphite-500">{'★'.repeat(5 - puntaje)}</span>
      </span>
      <span className="sr-only">{`Puntaje ${puntaje} de 5`}</span>
    </span>
  )
}

function Respuesta({ pregunta, texto }) {
  return (
    <div>
      <p className="text-xs text-muted">{pregunta}</p>
      <p className="mt-0.5 whitespace-pre-line break-words text-sm">
        {texto || <span className="text-muted">Sin respuesta.</span>}
      </p>
    </div>
  )
}

/* Una encuesta de fin de demo: el taller, la fecha, la intención, el puntaje y
   las tres respuestas abiertas. Solo datos del taller sobre Boxly, sin clientes. */
export default function TarjetaEncuesta({ encuesta }) {
  const taller = tallerDe(encuesta)
  const intencion = intencionDe(encuesta.intencion)
  const nombre = taller.nombre ?? (taller.id ? `Taller #${taller.id}` : 'Taller')

  return (
    <Ficha as="article" acento={encuesta.salteada ? 'neutro' : 'amber'} className="h-full">
      <FichaCabecera
        antetitulo="Encuesta de fin de demo"
        titulo={
          taller.id ? (
            <Link to={`/plataforma/talleres/${taller.id}`} className="hover:underline">
              {nombre}
            </Link>
          ) : (
            nombre
          )
        }
        aside={
          encuesta.salteada ? (
            <Chip>Salteada</Chip>
          ) : intencion ? (
            <Chip tono={intencion.tono}>{intencion.texto}</Chip>
          ) : (
            <Chip>Sin intención</Chip>
          )
        }
      >
        <Chips>
          <Chip icono="historial">
            <time dateTime={encuesta.creado_en}>{fechaHora(encuesta.creado_en)}</time>
          </Chip>
          {encuesta.puntaje ? (
            <Chip>
              <Estrellas puntaje={encuesta.puntaje} />
            </Chip>
          ) : (
            !encuesta.salteada && <Chip>Sin puntaje</Chip>
          )}
        </Chips>
      </FichaCabecera>

      <FichaSeccion className="space-y-3">
        {encuesta.salteada ? (
          <p className="text-sm text-muted">El administrador salteó la encuesta.</p>
        ) : (
          <>
            <Respuesta pregunta="Qué le gustó" texto={encuesta.gusto} />
            <Respuesta pregunta="Qué mejoraría" texto={encuesta.mejoras} />
            <Respuesta pregunta="Sugerencias" texto={encuesta.sugerencias} />
          </>
        )}
      </FichaSeccion>
    </Ficha>
  )
}
