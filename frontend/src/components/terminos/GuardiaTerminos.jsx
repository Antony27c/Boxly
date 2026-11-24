import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Loader from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import { ROLES_ADMIN } from '@/routes/navegacion'
import { terminosService } from '@/services/terminos'

// Solo el administrador del taller queda bloqueado hasta aceptar los términos
// vigentes: el resto del personal, los clientes y el superadmin no pasan por acá.
function esAdminTaller(rol) {
  return ROLES_ADMIN.includes(rol)
}

export default function GuardiaTerminos() {
  const { token, usuario } = useAuth()
  const { pathname } = useLocation()
  const admin = esAdminTaller(usuario?.rol)
  // Resultado de la verificación atado al token: si cambia el usuario se
  // vuelve a pedir (el servicio también lo indexa por token).
  const [intento, setIntento] = useState({ token: null, fallo: false })

  // Una sola llamada por sesión (el servicio guarda el resultado): si el GET
  // falla se deja pasar — la página de términos muestra el error y se reintenta ahí.
  useEffect(() => {
    if (!admin || !token) return
    let vigente = true
    terminosService
      .obtener(token)
      .then(() => {
        if (vigente) setIntento({ token, fallo: false })
      })
      .catch(() => {
        if (vigente) setIntento({ token, fallo: true })
      })
    return () => {
      vigente = false
    }
  }, [admin, token])

  const listo = intento.token === token
  const fallo = listo && intento.fallo

  if (!admin || !token || fallo) return <Outlet />
  if (!listo) return <Loader texto="Verificando términos…" />

  const aceptado = Boolean(terminosService.estado()?.aceptados_en)
  if (!aceptado && pathname !== '/terminos') {
    return <Navigate to="/terminos" replace />
  }
  return <Outlet />
}
