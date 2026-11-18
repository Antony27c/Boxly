import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import Toast from '@/components/ui/Toast'

const ToastContext = createContext(null)
const DURACION_MS = 5000

/**
 * Avisos flotantes que no empujan el contenido.
 *   const { avisar } = useToast()
 *   avisar('Cliente creado.')
 *   avisar('No se pudo guardar.', { tipo: 'error' })
 *   avisar('Cliente creado.', { accion: { texto: 'Agregar vehículo', onClick: () => ... } })
 */
export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([])
  const siguienteId = useRef(1)

  const cerrar = useCallback((id) => setAvisos((lista) => lista.filter((a) => a.id !== id)), [])

  const avisar = useCallback(
    (mensaje, { tipo = 'ok', accion = null, duracion = DURACION_MS } = {}) => {
      const id = siguienteId.current++
      setAvisos((lista) => [...lista.slice(-2), { id, mensaje, tipo, accion }])
      // Con acción ("¿qué sigue?") se deja más tiempo para que se pueda tocar.
      const ms = accion ? Math.max(duracion, 9000) : duracion
      if (ms > 0) setTimeout(() => cerrar(id), ms)
      return id
    },
    [cerrar],
  )

  const valor = useMemo(() => ({ avisar, cerrar }), [avisar, cerrar])

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6"
        aria-live="polite"
      >
        {avisos.map((aviso) => (
          <Toast key={aviso.id} {...aviso} onCerrar={() => cerrar(aviso.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const contexto = useContext(ToastContext)
  // Fuera del provider (tests de componentes sueltos) no rompe: avisar no hace nada.
  return contexto ?? { avisar: () => 0, cerrar: () => {} }
}
