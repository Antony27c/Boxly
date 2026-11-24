import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { authService } from '@/services/auth'
import { setUnauthorizedHandler } from '../lib/api'

const CLAVE_TOKEN = 'boxly_token'
const CLAVE_USUARIO = 'boxly_usuario'
const MAXIMO_DELAY_TIMEOUT = 2 ** 31 - 1

const AuthContext = createContext(null)

function vencimientoDelToken(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(base64))
    return exp ? exp * 1000 : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(CLAVE_TOKEN))
  const [usuario, setUsuario] = useState(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_USUARIO)
      return guardado ? JSON.parse(guardado) : null
    } catch {
      localStorage.removeItem(CLAVE_USUARIO)
      return null
    }
  })
  const [cargandoSesion, setCargandoSesion] = useState(Boolean(localStorage.getItem(CLAVE_TOKEN)))
  const recienLogueado = useRef(false)

  useEffect(() => {
    if (!token) return
    if (recienLogueado.current) {
      recienLogueado.current = false
      return
    }
    let vigente = true
    authService
      .perfil(token)
      .then((datos) => {
        if (!vigente) return
        setUsuario(datos)
        localStorage.setItem(CLAVE_USUARIO, JSON.stringify(datos))
      })
      .catch((error) => {
        if (!vigente) return
        // Solo un 401 es sesión inválida. Un 403 (taller con la suscripción
        // suspendida o en solo lectura) no tiene que cerrar la sesión: la
        // pantalla muestra el bloqueo y la persona sigue logueada.
        if (error.status !== 401) return
        setToken(null)
        setUsuario(null)
        localStorage.removeItem(CLAVE_TOKEN)
        localStorage.removeItem(CLAVE_USUARIO)
      })
      .finally(() => {
        if (vigente) setCargandoSesion(false)
      })
    return () => {
      vigente = false
    }
  }, [token])

  const login = useCallback(async ({ email, password }) => {
    const datos = await authService.login({ email, password })
    localStorage.setItem(CLAVE_TOKEN, datos.access_token)
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(datos.usuario))
    recienLogueado.current = true
    setCargandoSesion(false)
    setToken(datos.access_token)
    setUsuario(datos.usuario)
    return datos.usuario
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(CLAVE_TOKEN)
    localStorage.removeItem(CLAVE_USUARIO)
    setCargandoSesion(false)
    setToken(null)
    setUsuario(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  useEffect(() => {
    if (!token) return
    const vence = vencimientoDelToken(token)
    if (!vence) return
    const temporizador = setTimeout(
      logout,
      Math.min(Math.max(vence - Date.now(), 0), MAXIMO_DELAY_TIMEOUT),
    )
    return () => clearTimeout(temporizador)
  }, [token, logout])

  const valor = useMemo(
    () => ({ token, usuario, autenticado: Boolean(token), cargandoSesion, login, logout }),
    [token, usuario, cargandoSesion, login, logout],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// El hook queda junto al provider para no romper los imports existentes.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return contexto
}
