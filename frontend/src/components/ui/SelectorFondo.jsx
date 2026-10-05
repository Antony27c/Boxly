import { useEffect, useRef, useState } from 'react'
import { FONDOS, aplicarFondo, fondoGuardado } from '@/utils/fondo'

export default function SelectorFondo() {
  const [abierto, setAbierto] = useState(false)
  const [actual, setActual] = useState(fondoGuardado)
  const contenedor = useRef(null)

  useEffect(() => {
    if (!abierto) return
    function cerrarAfuera(evento) {
      if (!contenedor.current?.contains(evento.target)) setAbierto(false)
    }
    function cerrarConEscape(evento) {
      if (evento.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', cerrarAfuera)
    document.addEventListener('keydown', cerrarConEscape)
    return () => {
      document.removeEventListener('mousedown', cerrarAfuera)
      document.removeEventListener('keydown', cerrarConEscape)
    }
  }, [abierto])

  function elegir(fondo) {
    aplicarFondo(fondo)
    setActual(fondo)
    setAbierto(false)
  }

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((previo) => !previo)}
        aria-haspopup="true"
        aria-expanded={abierto}
        className="inline-flex items-center gap-2 rounded-box px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-graphite-700 hover:text-ink"
      >
        <span
          className="h-4 w-4 rounded-full border border-graphite-500"
          style={{ backgroundColor: actual.color }}
          aria-hidden="true"
        />
        Fondo
      </button>

      {abierto && (
        <div className="absolute right-0 z-40 mt-2 w-44 rounded-box border border-graphite-700 bg-graphite-800 p-2 shadow-lift">
          <p className="px-2 pb-2 text-xs text-muted">Color de fondo</p>
          <ul className="grid grid-cols-3 gap-2">
            {FONDOS.map((fondo) => (
              <li key={fondo.id}>
                <button
                  type="button"
                  onClick={() => elegir(fondo)}
                  title={fondo.nombre}
                  aria-label={`Fondo ${fondo.nombre}`}
                  aria-pressed={fondo.id === actual.id}
                  className={`h-10 w-full rounded-box border-2 transition-transform hover:scale-105 ${
                    fondo.id === actual.id ? 'border-amber' : 'border-graphite-600'
                  }`}
                  style={{ backgroundColor: fondo.color }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
