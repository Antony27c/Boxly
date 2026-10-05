import { useState } from 'react'
import { FONDOS, aplicarFondo, fondoGuardado } from '@/utils/fondo'

export default function SelectorFondo() {
  const [actual, setActual] = useState(fondoGuardado)
  const siguiente = FONDOS.find((fondo) => fondo.id !== actual.id)

  function cambiar() {
    aplicarFondo(siguiente)
    setActual(siguiente)
  }

  return (
    <button
      type="button"
      onClick={cambiar}
      title={`Cambiar a fondo ${siguiente.nombre.toLowerCase()}`}
      className="inline-flex items-center gap-2 rounded-box px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-graphite-700 hover:text-ink"
    >
      <span
        className="h-4 w-4 rounded-full border border-graphite-500"
        style={{ backgroundColor: `rgb(${siguiente.colores.fondo})` }}
        aria-hidden="true"
      />
      Fondo {siguiente.nombre.toLowerCase()}
    </button>
  )
}
