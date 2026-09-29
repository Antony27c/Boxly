import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ...dependencias])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { datos, cargando, error, recargar }
}
