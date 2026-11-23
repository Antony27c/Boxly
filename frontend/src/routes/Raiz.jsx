import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Loader from '@/components/ui/Loader'
import { inicioSegunRol } from '@/routes/navegacion'
import Landing from '@/pages/Landing'

// Ruta "/": sin sesión muestra la landing; con sesión manda a cada usuario a su inicio.
export default function Raiz() {
  const { autenticado, usuario, cargandoSesion } = useAuth()

  if (cargandoSesion) return <Loader texto="Verificando sesión…" />
  if (!autenticado || !usuario?.rol) return <Landing />

  return <Navigate to={inicioSegunRol(usuario.rol)} replace />
}
