import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icono from '@/components/ui/Icono'
import LucesTema from '@/components/ui/LucesTema'

function iniciales(usuario) {
  const partes = [usuario?.nombre, usuario?.apellido].filter(Boolean)
  const texto = partes.length ? partes.map((p) => p[0]).join('') : (usuario?.email ?? '?')[0]
  return texto.slice(0, 2).toUpperCase()
}

/**
 * Menú de usuario (botón hamburguesa) arriba a la derecha: quién está conectado,
 * tema claro/oscuro, Configuración, Ayuda y Cerrar sesión.
 */
export default function MenuUsuario({ usuario, rol, onCerrarSesion }) {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef(null)
  const location = useLocation()

  // Se cierra al navegar (ajuste durante el render, como en BarraInferior).
  const [ruta, setRuta] = useState(location.pathname)
  if (ruta !== location.pathname) {
    setRuta(location.pathname)
    setAbierto(false)
  }

  useEffect(() => {
    if (!abierto) return undefined
    const alClickAfuera = (evento) => {
      if (contenedor.current && !contenedor.current.contains(evento.target)) setAbierto(false)
    }
    const alTeclado = (evento) => {
      if (evento.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', alClickAfuera)
    document.addEventListener('keydown', alTeclado)
    return () => {
      document.removeEventListener('mousedown', alClickAfuera)
      document.removeEventListener('keydown', alTeclado)
    }
  }, [abierto])

  const claseItem =
    'flex w-full items-center gap-3 rounded-box px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-graphite-700'

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        aria-label={abierto ? 'Cerrar menú de usuario' : 'Abrir menú de usuario'}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((valor) => !valor)}
        className={`flex min-h-10 items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
          abierto ? 'border-amber/60 bg-graphite-700' : 'border-graphite-600 hover:bg-graphite-700'
        }`}
      >
        <span className="hidden text-right text-sm leading-tight sm:block">
          <span className="block font-medium">{usuario?.nombre ?? usuario?.email}</span>
          {rol && <span className="block text-xs text-muted">{rol}</span>}
        </span>
        <span className="relative h-5 w-5" aria-hidden="true">
          <Icono
            nombre="menu"
            className={`absolute inset-0 h-5 w-5 transition-all duration-200 ${abierto ? 'rotate-90 opacity-0' : 'opacity-100'}`}
          />
          <Icono
            nombre="cerrar"
            className={`absolute inset-0 h-5 w-5 transition-all duration-200 ${abierto ? 'opacity-100' : '-rotate-90 opacity-0'}`}
          />
        </span>
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 origin-top-right animate-pop-in rounded-box border border-graphite-600 bg-graphite-800 p-2 shadow-lift"
        >
          <div className="flex items-center gap-3 border-b border-graphite-700 px-3 pb-3 pt-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber/15 text-sm font-semibold text-amber-texto">
              {iniciales(usuario)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {[usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ') || usuario?.email}
              </span>
              <span className="block truncate text-xs text-muted">{rol}</span>
            </span>
          </div>

          <div className="px-3 py-3">
            <p className="mb-2 text-xs font-medium text-muted">Tema</p>
            <LucesTema etiqueta="Tema" />
          </div>

          <div className="border-t border-graphite-700 pt-2">
            <Link to="/configuracion" role="menuitem" className={claseItem}>
              <Icono nombre="ajustes" className="h-5 w-5 text-muted" />
              Configuración
            </Link>
            <Link to="/ayuda" role="menuitem" className={claseItem}>
              <Icono nombre="ayuda" className="h-5 w-5 text-muted" />
              Ayuda y preguntas frecuentes
            </Link>
          </div>

          <div className="mt-2 border-t border-graphite-700 pt-2">
            <button
              type="button"
              role="menuitem"
              onClick={onCerrarSesion}
              className={`${claseItem} text-danger hover:bg-danger/10`}
            >
              <Icono nombre="salir" className="h-5 w-5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
