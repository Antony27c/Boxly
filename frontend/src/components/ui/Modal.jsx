import { useEffect } from 'react'

export default function Modal({ titulo, descripcion, abierto, onCerrar, children, ancho = 'max-w-lg' }) {
  useEffect(() => {
    if (!abierto) return
    function alPresionar(evento) {
      if (evento.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alPresionar)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alPresionar)
      document.body.style.overflow = ''
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 cursor-default"
        onClick={onCerrar}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-box border border-graphite-600 bg-graphite-800 p-6 shadow-lift sm:rounded-box ${ancho} animate-bay-in`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
            {descripcion && <p className="mt-1 text-sm text-muted">{descripcion}</p>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-box px-2 py-1 text-muted transition-colors hover:bg-graphite-700 hover:text-ink"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
