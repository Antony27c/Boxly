import { useState } from 'react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

/* Muestra una contraseña temporal UNA sola vez (la genera el servidor y no
   se puede volver a consultar): código grande en mono, botón Copiar con
   fallback para contextos sin Clipboard API y el aviso de pasarla por un
   medio seguro. La usan el alta de taller y el restablecer del personal. */
export default function PasswordTemporal({
  abierto,
  titulo = 'Contraseña temporal',
  descripcion,
  password,
  onCerrar,
}) {
  // Se guarda qué contraseña se copió: al llegar una nueva el tilde se apaga solo.
  const [copiadoDe, setCopiadoDe] = useState(null)
  const copiado = Boolean(password) && copiadoDe === password

  async function copiar() {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      setCopiadoDe(password)
      return
    } catch {
      // Sin Clipboard API (contexto no seguro o jsdom): campo temporal.
    }
    try {
      const campo = document.createElement('textarea')
      campo.value = password
      campo.style.position = 'fixed'
      campo.style.opacity = '0'
      document.body.appendChild(campo)
      campo.select()
      document.execCommand('copy')
      campo.remove()
      setCopiadoDe(password)
    } catch {
      setCopiadoDe(null)
    }
  }

  return (
    <Modal abierto={abierto} titulo={titulo} descripcion={descripcion} onCerrar={onCerrar} ancho="max-w-md">
      <p className="text-sm text-muted">
        Anotala o copiala ahora: es la única vez que se muestra.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <code className="min-w-0 flex-1 select-all rounded-box border border-graphite-600 bg-graphite-900 px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.2em] text-ink">
          {password}
        </code>
        <Button onClick={copiar} icono={copiado ? 'check' : undefined}>
          {copiado ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      <p className="mt-4 text-sm text-muted">
        Pasásela por un medio seguro; no se vuelve a mostrar.
      </p>
      <div className="mt-6 flex justify-end">
        <Button variante="secundario" onClick={onCerrar}>
          Listo
        </Button>
      </div>
    </Modal>
  )
}
