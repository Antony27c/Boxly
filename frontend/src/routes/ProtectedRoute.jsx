import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useSoporte } from '@/context/SoporteContext'
import Loader from '@/components/ui/Loader'
import { ROLES_SUPERADMIN, inicioSegunRol } from '@/routes/navegacion'

export default function ProtectedRoute({ roles }) {
  const { autenticado, usuario, cargandoSesion } = useAuth()
  const soporte = useSoporte()
  const location = useLocation()

  if (cargandoSesion) return <Loader texto="Verificando sesión…" />

  if (!autenticado || !usuario?.rol) {
    return <Navigate to="/login" state={{ desde: location.pathname + location.search }} replace />
  }

  // En modo soporte el superadmin recorre el taller como si fuera administrador:
  // pasa las rutas del taller (las que admiten 'administrador') sin perder el
  // acceso a las rutas de plataforma, que siguen siendo solo suyas.
  const enSoporte = soporte.activo && ROLES_SUPERADMIN.includes(usuario.rol)
  const permitido =
    !roles || roles.includes(usuario.rol) || (enSoporte && roles.includes('administrador'))

  if (roles && !permitido) {
    return <Navigate to={inicioSegunRol(usuario.rol)} replace />
  }

  return <Outlet />
}
