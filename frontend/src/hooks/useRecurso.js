import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'

// Centraliza el ciclo cargando / datos / error de cualquier listado o detalle
// para que las pantallas no repitan la misma lógica (FE-05).
export default function useRecurso(cargador, dependencias = []) {
  const { token } = useAuth()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const recargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      setDatos(await cargador(token))
    } catch (problema) {
      setError(problema.message)
    } finally {
      setCargando(false)
    }
    // El cargador se recrea en cada render, por eso las dependencias se
    // declaran desde la pantalla que usa el hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ...dependencias])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { datos, cargando, error, recargar }
}
