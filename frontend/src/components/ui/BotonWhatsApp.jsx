import { useId } from 'react'
import { linkWhatsApp } from '@/lib/whatsapp'

// Mismo aspecto que <Button variante="secundario">, pero es un link: abre
// WhatsApp (web o la app) en una pestaña nueva con el mensaje ya escrito.
const CLASE_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold tracking-wide transition'
const CLASE_ACTIVO = 'bg-graphite-600 text-ink hover:bg-graphite-500 motion-safe:active:scale-[0.98]'
const CLASE_INACTIVO = 'cursor-not-allowed bg-graphite-600 text-ink opacity-50'

// Globo de chat con un tubo adentro, en trazo como el resto de los íconos.
function IconoWhatsApp({ className = 'h-4 w-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.5 20.5 5 16.2A8.5 8.5 0 1 1 8 19.2l-4.5 1.3Z" />
      <path d="M9 8.5c0 3.6 2.9 6.5 6.5 6.5l1-1.6-2-1-1 .9a4.5 4.5 0 0 1-2.3-2.3l.9-1-1-2L9 8.5Z" />
    </svg>
  )
}

function motivoSinLink(telefono) {
  if (!String(telefono ?? '').trim()) return 'El cliente no tiene un teléfono cargado.'
  return 'El teléfono del cliente no es válido: revisá que tenga el código de área.'
}

/**
 * Botón "WhatsApp" con un mensaje armado. Si el teléfono falta o no se puede
 * normalizar, queda deshabilitado y explica por qué (title + texto accesible).
 * Quien lo monta decide si el rol lo puede ver (ver `puedeUsarWhatsApp`).
 */
export default function BotonWhatsApp({ telefono, mensaje = '', texto = 'WhatsApp', className = '' }) {
  const idMotivo = useId()
  const href = linkWhatsApp(telefono, mensaje)

  if (!href) {
    const motivo = motivoSinLink(telefono)
    return (
      <>
        <button
          type="button"
          disabled
          title={motivo}
          aria-describedby={idMotivo}
          className={`${CLASE_BASE} ${CLASE_INACTIVO} ${className}`}
        >
          <IconoWhatsApp />
          {texto}
        </button>
        <span id={idMotivo} className="sr-only">
          {motivo}
        </span>
      </>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir WhatsApp con el mensaje armado"
      className={`${CLASE_BASE} ${CLASE_ACTIVO} ${className}`}
    >
      <IconoWhatsApp />
      {texto}
      <span className="sr-only"> (se abre en una pestaña nueva)</span>
    </a>
  )
}
