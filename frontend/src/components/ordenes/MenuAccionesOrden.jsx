import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icono from '@/components/ui/Icono'
import { ROLES_MOSTRADOR, tieneAcceso } from '@/routes/navegacion'
import { sePuedeEliminar } from '@/services/ordenes'

const CLASE_ITEM =
  'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-graphite-700'

// Menú "⋯" de la tarjeta: lo secundario vive acá; la acción principal va en
// el botón destacado y el resto se resuelve en la página de la orden.
// MenuDesplegable no admite iconos por opción, así que el menú se arma acá
// con el mismo patrón accesible (role=menu/menuitem, Escape y clic afuera).
export default function MenuAccionesOrden({ orden, vehiculo, usuario, onEditar, onEliminar }) {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef(null)
  const id = useId()
  const esMostrador = tieneAcceso(ROLES_MOSTRADOR, usuario?.rol)

  const opciones = [
    vehiculo && { a: `/vehiculos/${vehiculo.id}`, texto: 'Ver vehículo', icono: 'vehiculos' },
    onEditar && { texto: 'Editar', icono: 'ajustes', onClick: () => onEditar(orden) },
    esMostrador && sePuedeEliminar(orden) && {
      texto: 'Eliminar',
      icono: 'cerrar',
      peligro: true,
      onClick: () => onEliminar?.(orden),
    },
  ].filter(Boolean)

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

  if (opciones.length === 0) return null

  function cerrar() {
    setAbierto(false)
  }

  return (
    <div ref={contenedor} className="relative z-10 inline-block">
      <button
        type="button"
        aria-label={`Acciones de la orden ${orden.codigo ?? `#${orden.id}`}`}
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
        ⋯
      </button>
      {abierto && (
        <ul
          id={id}
          role="menu"
          className="absolute right-0 z-40 mt-1 min-w-44 animate-pop-in rounded-box border border-graphite-700 bg-graphite-800 py-1 shadow-lg"
        >
          {opciones.map((opcion) => {
            const claseColor = opcion.peligro ? 'text-danger' : 'text-ink'
            const claseIcono = opcion.peligro ? 'text-danger' : 'text-muted'
            const contenido = (
              <>
                <Icono nombre={opcion.icono} className={`h-4 w-4 shrink-0 ${claseIcono}`} />
                {opcion.texto}
              </>
            )
            return (
              <li key={opcion.texto} role="none">
                {opcion.a ? (
                  <Link
                    to={opcion.a}
                    role="menuitem"
                    onClick={cerrar}
                    className={`${CLASE_ITEM} ${claseColor}`}
                  >
                    {contenido}
                  </Link>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className={`${CLASE_ITEM} ${claseColor}`}
                    onClick={(evento) => {
                      evento.stopPropagation()
                      evento.preventDefault()
                      cerrar()
                      opcion.onClick?.()
                    }}
                  >
                    {contenido}
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
