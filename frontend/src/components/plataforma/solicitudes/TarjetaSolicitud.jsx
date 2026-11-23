import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Icono from '@/components/ui/Icono'
import { BOTON_PIE, Chip, Chips, Ficha, FichaCabecera, FichaPie, FichaSeccion } from '@/components/ui/Ficha'
import { fechaHora } from '../formatos'
import { estadoSolicitud } from './estados'

function DatoContacto({ etiqueta, href, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{etiqueta}</dt>
      <dd className="mt-0.5 min-w-0">
        <a
          href={href}
          className="inline-block max-w-full truncate rounded py-0.5 text-sm font-medium text-amber-texto underline-offset-2 hover:underline"
        >
          {children}
        </a>
      </dd>
    </div>
  )
}

// El tel: va sin espacios ni guiones para que el celular lo marque bien.
function hrefTelefono(telefono) {
  return `tel:${telefono.replace(/[^\d+]/g, '')}`
}

// Alta de taller precargada: /plataforma?nuevo=1&nombre=…&admin_nombre=…&admin_email=…
function urlCrearTaller(solicitud) {
  const partes = [
    ['nuevo', '1'],
    ['nombre', solicitud.taller ?? ''],
    ['admin_nombre', solicitud.nombre ?? ''],
    ['admin_email', solicitud.email ?? ''],
  ]
  const consulta = partes
    .map(([clave, valor]) => `${clave}=${encodeURIComponent(valor)}`)
    .join('&')
  return `/plataforma?${consulta}`
}

/* Tarjeta de una solicitud de demo: quién la manda, de qué taller, cómo
   contactarlo, el mensaje y el estado. Las acciones van en el pie. */
export default function TarjetaSolicitud({ solicitud, onCambiarEstado }) {
  const estado = estadoSolicitud(solicitud.estado)

  return (
    <Ficha as="article" acento={estado.acento} className="h-full">
      <FichaCabecera
        antetitulo={solicitud.taller}
        titulo={solicitud.nombre}
        aside={<Chip tono={estado.tono}>{estado.texto}</Chip>}
      >
        <Chips>
          <Chip icono="historial">
            <time dateTime={solicitud.creado_en}>{fechaHora(solicitud.creado_en)}</time>
          </Chip>
          {solicitud.ciudad && <Chip>{solicitud.ciudad}</Chip>}
        </Chips>
      </FichaCabecera>

      <FichaSeccion>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          <DatoContacto etiqueta="Correo" href={`mailto:${solicitud.email}`}>
            {solicitud.email}
          </DatoContacto>
          {solicitud.telefono && (
            <DatoContacto etiqueta="Teléfono" href={hrefTelefono(solicitud.telefono)}>
              {solicitud.telefono}
            </DatoContacto>
          )}
        </dl>
      </FichaSeccion>

      <FichaSeccion>
        <p className="text-xs text-muted">Mensaje</p>
        <p className="mt-1 whitespace-pre-line break-words text-sm">
          {solicitud.mensaje || <span className="text-muted">Sin mensaje.</span>}
        </p>
        {solicitud.nota && (
          <div className="mt-3 rounded-lg border border-graphite-600 bg-graphite-900 px-3 py-2">
            <p className="text-xs text-muted">Nota</p>
            <p className="mt-0.5 whitespace-pre-line break-words text-sm">{solicitud.nota}</p>
          </div>
        )}
      </FichaSeccion>

      <FichaPie>
        <Button variante="fantasma" className={BOTON_PIE} onClick={() => onCambiarEstado(solicitud)}>
          Cambiar estado
        </Button>
        {/* /plataforma abre el alta de taller precargada con estos datos. */}
        <Link
          to={urlCrearTaller(solicitud)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-amber-texto transition-colors hover:bg-amber/10"
        >
          Crear taller
          <Icono nombre="flecha" className="h-4 w-4" />
        </Link>
      </FichaPie>
    </Ficha>
  )
}
