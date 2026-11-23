import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLES_ADMIN } from '@/routes/navegacion'
import { estadoEncuestaDeLaSesion, marcarRedirigido, yaRedirigido } from '@/services/encuesta'

// Pantallas desde las que no se interrumpe: los términos van primero y /gracias es el destino.
const SIN_REDIRECCION = ['/terminos', '/gracias']

/* Fin de la demo (docs/Oferta.md): cuando el backend dice que corresponde la
   encuesta, el administrador va a /gracias una sola vez por sesión. Recepción,
   el mecánico, los clientes y el superadmin no pasan por acá. No bloquea la
   pantalla mientras pregunta: si el GET falla, se sigue de largo. */
export default function GuardiaEncuesta() {
  const { token, usuario } = useAuth()
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const admin = ROLES_ADMIN.includes(usuario?.rol)
  const enPausa = SIN_REDIRECCION.includes(pathname)

  useEffect(() => {
    if (!admin || !token || enPausa || yaRedirigido(token)) return
    let vigente = true
    estadoEncuestaDeLaSesion(token)
      .then((estado) => {
        if (!vigente || !estado?.corresponde || yaRedirigido(token)) return
        marcarRedirigido(token)
        navegar('/gracias', { replace: true })
      })
      .catch(() => {
        // Sin respuesta no se interrumpe: la encuesta es opcional.
      })
    return () => {
      vigente = false
    }
  }, [admin, token, enPausa, navegar])

  return <Outlet />
}
