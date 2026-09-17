import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Logo from '@/components/ui/Logo'
import Button from '@/components/ui/Button'

const navegacion = [
  { a: '/inicio', texto: 'Inicio' },
  { a: '/clientes', texto: 'Clientes' },
  { a: '/vehiculos', texto: 'Vehículos' },
  { a: '/ordenes', texto: 'Órdenes' },
]

export default function AppLayout() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  function cerrarSesion() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-graphite-900">
      <header className="border-b border-graphite-700 bg-graphite-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-3.5">
          <Logo tamano="sm" />
          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-2 sm:w-auto">
            {navegacion.map((item) => (
              <NavLink
                key={item.a}
                to={item.a}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-box px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-graphite-600 text-ink'
                      : 'text-muted hover:bg-graphite-700 hover:text-ink'
                  }`
                }
              >
                {item.texto}
              </NavLink>
            ))}
          </nav>
          <div className="order-2 ml-auto flex items-center gap-3 sm:order-3">
            <span className="hidden text-sm text-muted sm:block">
              {usuario?.nombre ?? usuario?.username}
              {usuario?.rol ? ` · ${usuario.rol}` : ''}
            </span>
            <Button variante="fantasma" onClick={cerrarSesion}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  )
}
