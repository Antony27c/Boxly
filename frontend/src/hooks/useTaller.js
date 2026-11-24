import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { tallerService } from '@/services/taller'

// Datos del taller para la sesión: el cache vive en el servicio (se comparte
// entre el panel, el ticket de cobro y el portal, y `actualizar` lo renueva),
// así que acá solo se refleja en estado de React. Si la carga falla, `taller`
// queda en null y quien lo use sigue funcionando sin esos datos.
export default function useTaller() {
  const { token } = useAuth()
  const [taller, setTaller] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const peticion = useRef(0)

  const traer = useCallback(
    async (forzar) => {
      peticion.current += 1
      const actual = peticion.current
      if (!token) {
        setCargando(false)
        return null
      }
      setCargando(true)
      setError('')
      try {
        const datos = await tallerService.obtener(token, forzar)
        if (peticion.current === actual) setTaller(datos)
        return datos
      } catch (problema) {
        if (peticion.current === actual) {
          setTaller(null)
          setError(problema.message)
        }
        return null
      } finally {
        if (peticion.current === actual) setCargando(false)
      }
    },
    [token],
  )

  useEffect(() => {
    // Se difiere un tick para no marcar el estado de carga de forma síncrona en el efecto.
    const temporizador = setTimeout(() => traer(false), 0)
    return () => clearTimeout(temporizador)
  }, [traer])

  const recargar = useCallback(() => traer(true), [traer])

  return { taller, cargando, error, recargar }
}
