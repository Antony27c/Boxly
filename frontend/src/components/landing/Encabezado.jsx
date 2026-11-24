import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '@/components/ui/Logo'
import Icono from '@/components/ui/Icono'
import { useTema } from '@/context/TemaContext'
import '@/styles/landing.css'

const ANCLAS = [
  { href: '#funciones', texto: 'Funciones' },
  { href: '#como-funciona', texto: 'Cómo funciona' },
  { href: '#seguridad', texto: 'Seguridad' },
  { href: '#planes', texto: 'Planes' },
  { href: '#preguntas', texto: 'Preguntas' },
]

const enlaceSeccion =
  'whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-graphite-700 hover:text-ink'

// Barra superior fija de la landing: logo, anclas a las secciones, acceso y
// botón de demo. Por debajo de lg (1024 px) las anclas pasan a un menú
// desplegable: a 768 px no entraban en una sola línea.
export default function Encabezado() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const botonMenuRef = useRef(null)

  // Escape cierra el menú y devuelve el foco al botón que lo abrió.
  useEffect(() => {
    if (!menuAbierto) return undefined
    function alTeclear(evento) {
      if (evento.key !== 'Escape') return
      setMenuAbierto(false)
      botonMenuRef.current?.focus()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [menuAbierto])

  function cerrarMenu() {
    setMenuAbierto(false)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-graphite-600/60 bg-graphite-900/85 backdrop-blur">
      <a href="#contenido" className="landing-saltar">
        Saltar al contenido
      </a>

      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#inicio" aria-label="Boxly, volver al inicio" className="shrink-0">
          <Logo tamano="sm" />
        </a>

        <nav aria-label="Secciones" className="hidden items-center gap-0.5 lg:flex">
          {ANCLAS.map((ancla) => (
            <a key={ancla.href} href={ancla.href} className={enlaceSeccion}>
              {ancla.texto}
            </a>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <BotonTema />
          <Link
            to="/login"
            className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-graphite-700"
          >
            Ingresar
          </Link>
          <a href="#contacto" className="landing-boton whitespace-nowrap !px-4 !py-2 text-sm">
            Pedí una demo
          </a>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <a
            href="#contacto"
            className="landing-boton mr-1 hidden whitespace-nowrap !px-3.5 !py-2 text-sm sm:inline-flex"
          >
            Pedí una demo
          </a>
          <BotonTema />
          <button
            ref={botonMenuRef}
            type="button"
            aria-expanded={menuAbierto}
            aria-controls="menu-landing"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            className="grid h-10 w-10 place-items-center rounded-md text-ink transition-colors hover:bg-graphite-700"
          >
            <Icono nombre={menuAbierto ? 'cerrar' : 'menu'} className="h-5 w-5" />
          </button>
        </div>
      </div>

      {menuAbierto && (
        <nav
          id="menu-landing"
          aria-label="Secciones (menú)"
          className="border-t border-graphite-600/60 bg-graphite-900/95 px-4 pb-4 pt-2 backdrop-blur lg:hidden"
        >
          <ul className="flex flex-col">
            {ANCLAS.map((ancla) => (
              <li key={ancla.href}>
                <a
                  href={ancla.href}
                  onClick={cerrarMenu}
                  className={`${enlaceSeccion} block py-2.5 text-base`}
                >
                  {ancla.texto}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2 border-t border-graphite-600/60 pt-4">
            <Link
              to="/login"
              onClick={cerrarMenu}
              className="landing-boton landing-boton--secundario"
            >
              Ingresar
            </Link>
            <a href="#contacto" onClick={cerrarMenu} className="landing-boton">
              Pedí una demo
            </a>
          </div>
        </nav>
      )}
    </header>
  )
}

// Alterna claro/oscuro. TemaContext envuelve toda la app, también la landing.
function BotonTema() {
  const { oscuro, alternar } = useTema()
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={oscuro ? 'Cambiar al tema claro' : 'Cambiar al tema oscuro'}
      className="grid h-10 w-10 place-items-center rounded-md text-muted transition-colors hover:bg-graphite-700 hover:text-ink"
    >
      <Icono nombre={oscuro ? 'sol' : 'luna'} className="h-5 w-5" />
    </button>
  )
}
