import { useMemo } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useSoporte } from '@/context/SoporteContext'
import { ZonaSoloLectura } from '@/context/SoloLecturaContext'
import { formatearHora } from '@/lib/fechas'
import useSuscripcion from '@/hooks/useSuscripcion'
import AvisoSuscripcion from '@/components/suscripcion/AvisoSuscripcion'
import Logo from '@/components/ui/Logo'
import Icono from '@/components/ui/Icono'
import MenuUsuario from '@/components/ui/MenuUsuario'
import MenuDesplegable from '@/components/ui/MenuDesplegable'
import BarraInferior from '@/components/ui/BarraInferior'
import BarraLateral from '@/components/ui/BarraLateral'
import { ROLES_ADMIN, ROLES_TALLER, etiquetaRol, inicioSegunRol, menuSegunRol } from '@/routes/navegacion'

/* Franja fija de modo soporte: avisa que se está mirando el taller en solo
   lectura y hasta cuándo; "Salir" vuelve al detalle del taller en plataforma. */
function FranjaSoporte({ taller, hasta, onSalir }) {
  const vence = hasta ? formatearHora(hasta) : ''
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-10 items-center justify-center gap-2 border-b border-amber/50 bg-amber/15 px-4 text-sm text-amber-deep lg:left-64">
      <Icono nombre="alerta" className="h-4 w-4 shrink-0" />
      <p className="truncate">
        Modo soporte{taller?.nombre ? ` · ${taller.nombre}` : ''} · solo lectura
        {vence ? ` · vence ${vence}` : ''}
      </p>
      <span aria-hidden="true" className="shrink-0">
        ·
      </span>
      <button
        type="button"
        onClick={onSalir}
        className="shrink-0 font-semibold text-ink underline-offset-2 transition-colors hover:underline"
      >
        Salir
      </button>
    </div>
  )
}

export default function AppLayout() {
  const { usuario, logout } = useAuth()
  const soporte = useSoporte()
  const { suscripcion } = useSuscripcion()
  const navigate = useNavigate()
  const location = useLocation()
  // En modo soporte el menú y el inicio son los del administrador del taller.
  const rolMenu = soporte.activo ? 'administrador' : usuario?.rol
  const inicio = inicioSegunRol(rolMenu)
  const { principales, mas } = useMemo(() => menuSegunRol(rolMenu), [rolMenu])

  const esAdmin = ROLES_ADMIN.includes(usuario?.rol ?? '')
  const esPersonal = ROLES_TALLER.includes(usuario?.rol ?? '')
  const estadoSuscripcion = suscripcion?.estado ?? null
  // En suspendida el administrador solo puede usar /suscripcion (y /terminos,
  // que el backend también exime); el resto del personal ve una pantalla.
  const suspendida = estadoSuscripcion === 'suspendida' && esPersonal
  const enPantallaSuscripcion = /^\/(suscripcion|terminos)(\/|$)/.test(location.pathname)
  const avisoSuscripcion =
    estadoSuscripcion === 'gracia' || estadoSuscripcion === 'solo_lectura'
      ? suscripcion
      : null
  // Solo lectura por suscripción: misma zona que el modo soporte, salvo en
  // /suscripcion y /terminos (el backend las exime y son la vía de pago).
  const soloLecturaUI =
    estadoSuscripcion === 'solo_lectura' && !enPantallaSuscripcion
  const deshabilitado = soporte.activo || soloLecturaUI
  const fijas = (soporte.activo ? 1 : 0) + (avisoSuscripcion ? 1 : 0)
  const claseRelleno = fijas === 2 ? 'pt-20' : fijas === 1 ? 'pt-10' : ''
  const claseTope = fijas === 2 ? 'top-20' : fijas === 1 ? 'top-10' : 'top-0'

  function cerrarSesion() {
    logout()
    navigate('/login', { replace: true })
  }

  if (suspendida && esAdmin && !enPantallaSuscripcion) {
    return <Navigate to="/suscripcion" replace />
  }

  const claseEnlace = ({ isActive }) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-box px-3 py-1.5 text-sm transition-colors duration-200 ${
      isActive
        ? 'bg-graphite-600 text-ink'
        : 'text-muted hover:bg-graphite-700 hover:text-ink'
    }`

  return (
    <div className={`min-h-screen bg-graphite-900 ${claseRelleno}`}>
      {soporte.activo && (
        <FranjaSoporte taller={soporte.taller} hasta={soporte.hasta} onSalir={soporte.salir} />
      )}
      {avisoSuscripcion && (
        <AvisoSuscripcion
          suscripcion={avisoSuscripcion}
          esAdmin={esAdmin}
          desplazada={soporte.activo}
        />
      )}

      {/* Pantallas grandes: barra lateral fija. Celular y tablet: header arriba + barra inferior. */}
      <BarraLateral
        usuario={usuario}
        rol={usuario?.rol ? etiquetaRol(usuario.rol) : ''}
        inicio={inicio}
        principales={principales}
        mas={mas}
        onCerrarSesion={cerrarSesion}
      />

      <header
        className={`sticky ${claseTope} z-30 border-b border-graphite-700 bg-graphite-800/95 backdrop-blur lg:hidden`}
      >
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
          {/* En modo soporte o en solo lectura por suscripción se apagan las
              acciones que escriben; búsqueda, filtros, pestañas, paginación y
              links siguen andando (ver SoloLecturaContext). Con la
              suscripción suspendida el resto del personal ve una pantalla. */}
          <ZonaSoloLectura activo={deshabilitado} className="w-full min-w-0">
            {suspendida && !esAdmin ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Icono nombre="alerta" className="h-10 w-10 text-danger" />
                <h1 className="text-xl font-bold text-ink">
                  El taller tiene la suscripción suspendida.
                </h1>
                <p className="max-w-md text-sm text-muted">
                  Hablá con el administrador del taller para regularizar el pago.
                </p>
              </div>
            ) : (
              <Outlet />
            )}
          </ZonaSoloLectura>
        </div>
      </main>

      <BarraInferior principales={principales} mas={mas} />
    </div>
  )
}
