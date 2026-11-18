import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'

export default function useRecurso(cargador) {
  const { token } = useAuth()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const peticion = useRef(0)

  const recargar = useCallback(async () => {
    peticion.current += 1
    const actual = peticion.current
    setCargando(true)
    setError('')
    try {
      const resultado = await cargador(token)
      // Si arrancó otra carga más nueva, esta respuesta ya quedó vieja: no pisa los datos.
      if (peticion.current === actual) setDatos(resultado)
    } catch (problema) {
      if (peticion.current === actual) setError(problema.message)
    } finally {
      if (peticion.current === actual) setCargando(false)
    }
  }, [cargador, token])

  useEffect(() => {
    // Se difiere un tick para no marcar el estado de carga de forma síncrona en el efecto.
    const temporizador = setTimeout(recargar, 0)
    return () => clearTimeout(temporizador)
  }, [recargar])

  return { datos, cargando, error, recargar }
}
