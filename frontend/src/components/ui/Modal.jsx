import { useEffect, useId, useRef } from 'react'
import Icono from '@/components/ui/Icono'

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Con modales apilados el scroll se libera recién cuando se cierra el último.
let modalesAbiertos = 0
let overflowPrevio = ''
const pilaModales = []

export default function Modal({ titulo, descripcion, abierto, onCerrar, children, ancho = 'max-w-lg' }) {
  const idTitulo = useId()
  const idDescripcion = useId()
  const dialogoRef = useRef(null)
  const cerrarRef = useRef(onCerrar)

  useEffect(() => {
    cerrarRef.current = onCerrar
  })

  useEffect(() => {
    if (!abierto) return
    const dialogo = dialogoRef.current
    const focoPrevio = document.activeElement
    const yo = {}
    pilaModales.push(yo)

    if (modalesAbiertos === 0) {
      overflowPrevio = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    modalesAbiertos += 1

    function enfocables() {
      return [...dialogo.querySelectorAll(ENFOCABLES)].filter((el) => el.offsetParent !== null)
    }

    function alPresionar(evento) {
      const esTope = pilaModales[pilaModales.length - 1] === yo
      if (evento.key === 'Escape') {
        if (esTope) cerrarRef.current()
        return
      }
      if (evento.key !== 'Tab') return
      const lista = enfocables()
      if (lista.length === 0) {
        evento.preventDefault()
        dialogo.focus()
        return
      }
      const primero = lista[0]
      const ultimo = lista[lista.length - 1]
      const activo = document.activeElement
      if (evento.shiftKey ? activo === primero || activo === dialogo : activo === ultimo) {
        evento.preventDefault()
        const destino = evento.shiftKey ? ultimo : primero
        destino.focus()
      } else if (!dialogo.contains(activo)) {
        evento.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alPresionar)
    dialogo.focus()

    return () => {
      document.removeEventListener('keydown', alPresionar)
      const indice = pilaModales.indexOf(yo)
      if (indice !== -1) pilaModales.splice(indice, 1)
      modalesAbiertos -= 1
      if (modalesAbiertos === 0) document.body.style.overflow = overflowPrevio
      if (focoPrevio instanceof HTMLElement && document.contains(focoPrevio)) focoPrevio.focus()
    }
  }, [abierto])

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 animate-fade-in cursor-default bg-black/40"
        onClick={onCerrar}
      />
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descripcion ? idDescripcion : undefined}
        tabIndex={-1}
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-box border border-graphite-600 bg-graphite-800 p-6 shadow-lift sm:rounded-box ${ancho} animate-sheet-up sm:animate-pop-in`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={idTitulo} className="text-lg font-semibold tracking-tight">
              {titulo}
            </h2>
            {descripcion && (
              <p id={idDescripcion} className="mt-1 text-sm text-muted">
                {descripcion}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-graphite-700 hover:text-ink"
          >
            <Icono nombre="cerrar" className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
