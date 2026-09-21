import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Loader from '@/components/ui/Loader'

// Protege las rutas privadas. Si además se pasan roles, exige que el usuario
// tenga uno de ellos (base para el panel de administración del Sprint 2).
export default function ProtectedRoute({ roles }) {
  const { autenticado, usuario, cargandoSesion } = useAuth()
  const location = useLocation()

  if (cargandoSesion) return <Loader texto="Verificando sesión…" />

  if (!autenticado) {
    return <Navigate to="/login" state={{ desde: location.pathname }} replace />
  }

  if (roles && usuario?.rol && !roles.includes(usuario.rol)) {
    return <Navigate to="/inicio" replace />
  }

  return <Outlet />
}
