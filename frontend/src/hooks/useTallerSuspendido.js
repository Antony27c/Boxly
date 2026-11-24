import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { CODIGOS_ERROR, alErrorDeAcceso, tieneCodigo } from '@/lib/api'

/* ¿El superadmin suspendió el taller a mano? (talleres.estado, distinto de la
   suscripción vencida). El backend responde 403 `taller_suspendido` a todo el
   personal; acá se escucha con alErrorDeAcceso para mostrar un aviso claro en
   lugar del error genérico de cada pantalla. Se olvida al cambiar la sesión. */
export default function useTallerSuspendido() {
  const { token } = useAuth()
  const [suspendido, setSuspendido] = useState({ token: null, valor: false })

  useEffect(() => {
    if (!token) return undefined
    return alErrorDeAcceso((error) => {
      if (tieneCodigo(error, CODIGOS_ERROR.tallerSuspendido)) setSuspendido({ token, valor: true })
    })
  }, [token])

  return suspendido.valor && suspendido.token === token
}
