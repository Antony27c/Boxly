import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Icono from '@/components/ui/Icono'

function claseItem(activo, abierto = false) {
  return `flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium leading-tight transition-colors ${
    activo || abierto ? 'bg-graphite-700 text-ink' : 'text-muted hover:text-ink'
  }`
}

/**
 * Barra de navegación fija abajo, solo en celular (la oculta `sm:hidden`).
 * Muestra hasta 4 principales; el resto (incluidos los principales que no
 * entran y todo `mas`) queda detrás del botón "Más", que abre una hoja
 * hacia arriba. Cada destino es un NavLink: el activo se resalta solo.
 */
export default function BarraInferior({ principales = [], mas = [] }) {
  const [abierto, setAbierto] = useState(false)
  const location = useLocation()

  // Al navegar, la hoja se cierra sola (ajuste de estado durante el render,
  // el mismo patrón que usan Ordenes y Turnos).
  const [rutaAnterior, setRutaAnterior] = useState(location.pathname)
  if (rutaAnterior !== location.pathname) {
    setRutaAnterior(location.pathname)
    setAbierto(false)
  }

  useEffect(() => {
    if (!abierto) return undefined
    function alTeclado(evento) {
      if (evento.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('keydown', alTeclado)
    return () => document.removeEventListener('keydown', alTeclado)
  }, [abierto])

  const visibles = principales.slice(0, 4)
  const resto = [...principales.slice(4), ...mas]

  if (visibles.length === 0 && resto.length === 0) return null

  return (
    <>
      {abierto && resto.length > 0 && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setAbierto(false)}
          className="fixed inset-0 z-30 animate-fade-in cursor-default bg-black/40 sm:hidden"
        />
      )}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-graphite-600 bg-graphite-800 pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {abierto && resto.length > 0 && (
          <div className="absolute inset-x-0 bottom-full max-h-[60vh] animate-sheet-up overflow-y-auto border-t border-graphite-600 bg-graphite-800 py-1 shadow-lift">
            <ul>
              {resto.map((item) => (
                <li key={item.a}>
                  <NavLink
                    to={item.a}
                    onClick={() => setAbierto(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-5 py-3.5 text-sm ${
                        isActive ? 'font-semibold text-amber-texto' : 'text-ink'
                      }`
                    }
                  >
                    <Icono nombre={item.icono} className="h-5 w-5 text-muted" />
                    {item.texto}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ul className="flex">
          {visibles.map((item) => (
            <li key={item.a} className="flex-1">
              <NavLink to={item.a} className={({ isActive }) => claseItem(isActive)}>
                {({ isActive }) => (
                  <>
                    <Icono
                      nombre={item.icono}
                      className={`h-5 w-5 transition-transform duration-200 ${isActive ? 'scale-110 text-amber-texto' : ''}`}
                    />
                    {item.texto}
                  </>
                )}
              </NavLink>
            </li>
          ))}
          {resto.length > 0 && (
            <li className="flex-1">
              <button
                type="button"
                aria-expanded={abierto}
                aria-label="Más secciones"
                onClick={() => setAbierto((valor) => !valor)}
                className={claseItem(false, abierto)}
              >
                <Icono nombre="mas" className="h-5 w-5" />
                Más
              </button>
            </li>
          )}
        </ul>
      </nav>
    </>
  )
}
