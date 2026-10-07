import { createContext, use, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authService } from '@/services/auth'
import { setUnaunthorizedHandler } from '../lib/api'

const CLAVE_TOKEN = 'boxly_token'
const CLAVE_USUARIO = 'boxly_usuario'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(CLAVE_TOKEN))
  const [usuario, setUsuario] = useState(() => {
    const guardado = localStorage.getItem(CLAVE_USUARIO)
    return guardado ? JSON.parse(guardado) : null
  })
  const [cargandoSesion, setCargandoSesion] = useState(Boolean(localStorage.getItem(CLAVE_TOKEN)))

  useEffect(() => {
    if (!token) {
      setCargandoSesion(false)
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
        if (error.status !== 401 && error.status !== 403) return
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
    setToken(datos.access_token)
    setUsuario(datos.usuario)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(CLAVE_TOKEN)
    localStorage.removeItem(CLAVE_USUARIO)
    setToken(null)
    setUsuario(null)
  }, [])

  useEffect(() => {
    setUnaunthorizedHandler(logout)
  }, [logout])

  const valor = useMemo(
    () => ({ token, usuario, autenticado: Boolean(token), cargandoSesion, login, logout }),
    [token, usuario, cargandoSesion, login, logout],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return contexto
}
