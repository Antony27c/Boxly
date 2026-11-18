import { useEffect, useId, useRef, useState } from 'react'

/**
 * Menú "⋯" o "Más" accesible.
 *   <MenuDesplegable etiqueta="Más acciones" opciones={[{ texto: 'Editar', onClick }, { texto: 'Eliminar', onClick, peligro: true }]} />
 * `boton` permite cambiar el contenido del disparador (por defecto "⋯").
 * Cada opción puede tener `onClick` o `a` (ruta: se renderiza como link con `renderLink`).
 */
export default function MenuDesplegable({ etiqueta = 'Más acciones', opciones, boton = '⋯', alinear = 'derecha', renderLink, className = '' }) {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef(null)
  const id = useId()
  const visibles = opciones.filter(Boolean)

  useEffect(() => {
    if (!abierto) return undefined
    function alClickAfuera(evento) {
      if (contenedor.current && !contenedor.current.contains(evento.target)) setAbierto(false)
    }
    function alTeclado(evento) {
      if (evento.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', alClickAfuera)
    document.addEventListener('keydown', alTeclado)
    return () => {
      document.removeEventListener('mousedown', alClickAfuera)
      document.removeEventListener('keydown', alTeclado)
    }
  }, [abierto])

  if (visibles.length === 0) return null

  return (
    <div ref={contenedor} className={`relative inline-block ${className}`}>
      <button
        type="button"
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={(evento) => {
          evento.stopPropagation()
          evento.preventDefault()
          setAbierto((valor) => !valor)
        }}
        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-box px-3 text-sm font-semibold text-muted hover:bg-graphite-700 hover:text-ink"
      >
        {boton}
      </button>
      {abierto && (
        <ul
          id={id}
          role="menu"
          className={`absolute z-40 mt-1 min-w-44 animate-pop-in rounded-box border border-graphite-700 bg-graphite-800 py-1 shadow-lg ${
            alinear === 'derecha' ? 'right-0' : 'left-0'
          }`}
        >
          {visibles.map((opcion) => {
            const clases = `block w-full px-4 py-2.5 text-left text-sm hover:bg-graphite-700 ${opcion.peligro ? 'text-danger' : 'text-ink'}`
            const cerrar = () => setAbierto(false)
            return (
              <li key={opcion.texto} role="none">
                {opcion.a && renderLink ? (
                  renderLink({ a: opcion.a, texto: opcion.texto, className: clases, role: 'menuitem', onClick: cerrar })
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className={clases}
                    onClick={(evento) => {
                      evento.stopPropagation()
                      evento.preventDefault()
                      cerrar()
                      opcion.onClick?.()
                    }}
                  >
                    {opcion.texto}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
