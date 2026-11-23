import { Link, NavLink } from 'react-router-dom'
import Icono from '@/components/ui/Icono'
import Logo from '@/components/ui/Logo'

function iniciales(usuario) {
  const partes = [usuario?.nombre, usuario?.apellido].filter(Boolean)
  const texto = partes.length ? partes.map((p) => p[0]).join('') : (usuario?.email ?? '?')[0]
  return texto.slice(0, 2).toUpperCase()
}

const claseItem = ({ isActive }) =>
  `group relative flex items-center gap-3 rounded-box px-3 py-[7px] text-sm transition-colors duration-200 ${
    isActive
      ? 'bg-amber/15 font-semibold text-amber-texto'
      : 'text-muted hover:bg-graphite-700 hover:text-ink'
  }`

function Grupo({ titulo, items }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{titulo}</p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.a}>
            <NavLink to={item.a} end={item.a === "/plataforma"} className={claseItem}>
              {({ isActive }) => (
                <>
                  {/* Marca lateral de la página activa. */}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-1.5 left-0 w-1 rounded-r bg-amber transition-opacity duration-200 ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <Icono nombre={item.icono} className="h-5 w-5" />
                  {item.texto}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Barra lateral de navegación para pantallas grandes (lg en adelante).
 * Es solo otra distribución del mismo menú: mismas páginas y mismas acciones
 * de cuenta que el menú de arriba y la barra inferior del celular.
 */
export default function BarraLateral({ usuario, rol, inicio, principales, mas, onCerrarSesion }) {
  return (
    <aside
      aria-label="Navegación principal"
      className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-graphite-700 bg-graphite-800 chapa-melon lg:flex"
    >
      <div className="px-5 pb-3 pt-4">
        <Link
          to={inicio}
          aria-label="Ir al inicio"
          className="inline-block rounded-box transition-transform duration-200 hover:scale-[1.03] active:scale-95"
        >
          <Logo tamano="sm" />
        </Link>
      </div>

      <div className="mx-3 flex items-center gap-3 rounded-box bg-graphite-700/60 px-3 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber/15 text-sm font-semibold text-amber-texto">
          {iniciales(usuario)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {[usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ') || usuario?.email}
          </span>
          <span className="block truncate text-xs text-muted">{rol}</span>
        </span>
      </div>

      <nav aria-label="Secciones" className="sin-barra mt-4 flex-1 space-y-5 overflow-y-auto px-3">
        <Grupo titulo="Principal" items={principales} />
        <Grupo titulo="Gestión" items={mas} />
      </nav>

      <div className="space-y-0.5 border-t border-graphite-700 px-3 py-3">
        <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Cuenta</p>
        <NavLink to="/configuracion" className={claseItem}>
          <Icono nombre="ajustes" className="h-5 w-5" />
          Configuración
        </NavLink>
        <NavLink to="/ayuda" className={claseItem}>
          <Icono nombre="ayuda" className="h-5 w-5" />
          Ayuda
        </NavLink>
        <button
          type="button"
          onClick={onCerrarSesion}
          className="flex w-full items-center gap-3 rounded-box px-3 py-2 text-left text-sm text-danger transition-colors duration-200 hover:bg-danger/10"
        >
          <Icono nombre="salir" className="h-5 w-5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
