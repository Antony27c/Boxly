import { useMemo } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Logo from '@/components/ui/Logo'
import Icono from '@/components/ui/Icono'
import MenuUsuario from '@/components/ui/MenuUsuario'
import MenuDesplegable from '@/components/ui/MenuDesplegable'
import BarraInferior from '@/components/ui/BarraInferior'
import BarraLateral from '@/components/ui/BarraLateral'
import { etiquetaRol, inicioSegunRol, menuSegunRol } from '@/routes/navegacion'

export default function AppLayout() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const inicio = inicioSegunRol(usuario?.rol)
  const { principales, mas } = useMemo(() => menuSegunRol(usuario?.rol), [usuario?.rol])

  function cerrarSesion() {
    logout()
    navigate('/login', { replace: true })
  }

  const claseEnlace = ({ isActive }) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-box px-3 py-1.5 text-sm transition-colors duration-200 ${
      isActive
        ? 'bg-graphite-600 text-ink'
        : 'text-muted hover:bg-graphite-700 hover:text-ink'
    }`

  return (
    <div className="min-h-screen bg-graphite-900">
      {/* Pantallas grandes: barra lateral fija. Celular y tablet: header arriba + barra inferior. */}
      <BarraLateral
        usuario={usuario}
        rol={usuario?.rol ? etiquetaRol(usuario.rol) : ''}
        inicio={inicio}
        principales={principales}
        mas={mas}
        onCerrarSesion={cerrarSesion}
      />

      <header className="sticky top-0 z-30 border-b border-graphite-700 bg-graphite-800/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3.5">
          {/* Logo y nombre vuelven al inicio del rol; si ya estás ahí, suben al principio. */}
          <Link
            to={inicio}
            aria-label="Ir al inicio"
            onClick={() => {
              if (location.pathname === inicio) window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="shrink-0 rounded-box transition-transform duration-200 hover:scale-[1.03] active:scale-95"
          >
            <Logo tamano="sm" />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Secciones">
            {principales.map((item) => (
              <NavLink key={item.a} to={item.a} className={claseEnlace}>
                <Icono nombre={item.icono} className="h-4 w-4" />
                {item.texto}
              </NavLink>
            ))}
            {mas.length > 0 && (
              <MenuDesplegable
                etiqueta="Más secciones"
                boton="Más"
                opciones={mas.map((item) => ({ texto: item.texto, a: item.a }))}
                renderLink={({ a, texto, className, role, onClick }) => (
                  <NavLink
                    to={a}
                    role={role}
                    onClick={onClick}
                    className={({ isActive }) =>
                      `${className} ${isActive ? 'bg-graphite-700 font-semibold' : ''}`
                    }
                  >
                    {texto}
                  </NavLink>
                )}
              />
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <MenuUsuario
              usuario={usuario}
              rol={usuario?.rol ? etiquetaRol(usuario.rol) : ''}
              onCerrarSesion={cerrarSesion}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:pb-8 lg:ml-64 lg:mr-0 lg:max-w-none lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      <BarraInferior principales={principales} mas={mas} />
    </div>
  )
}
