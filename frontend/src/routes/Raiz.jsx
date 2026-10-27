import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Loader from '@/components/ui/Loader'
import { inicioSegunRol } from '@/routes/navegacion'

// Ruta "/": manda a cada usuario a su pantalla de inicio según el rol.
export default function Raiz() {
  const { autenticado, usuario, cargandoSesion } = useAuth()

  if (cargandoSesion) return <Loader texto="Verificando sesión…" />
  if (!autenticado) return <Navigate to="/login" replace />

  return <Navigate to={inicioSegunRol(usuario?.rol)} replace />
}
