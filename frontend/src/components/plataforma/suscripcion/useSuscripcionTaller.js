import { useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import useRecurso from '@/hooks/useRecurso'
import { suscripcionesPlataformaService } from '@/services/suscripcionesPlataforma'

/* Estado y acciones de la suscripción del taller (S5 + C3, contratos en
   docs/Suscripciones.md y docs/Oferta.md §4). Junta en un solo pedido la
   suscripción, los planes y los adicionales; las mutaciones avisan con toast,
   recargan la suscripción y avisan al padre (onCambio) para que refresque el
   detalle del taller.

   `ejecutar(tipo, payload)` devuelve null si salió bien o el Error si el
   servidor rechazó: el formulario que la llamó muestra el mensaje adentro
   del modal. */
export default function useSuscripcionTaller(tallerId, onCambio) {
  const { token } = useAuth()
  const { avisar } = useToast()

  const cargar = useCallback(
    (t) =>
      Promise.all([
        suscripcionesPlataformaService.obtenerSuscripcion(tallerId, t),
        suscripcionesPlataformaService.listarPlanes(t),
        suscripcionesPlataformaService.listarAdicionales(tallerId, t),
      ]).then(([suscripcion, planes, adicionales]) => ({ suscripcion, planes, adicionales })),
    [tallerId],
  )
  const { datos, cargando, error, recargar } = useRecurso(cargar)

  async function mutar(fn, mensaje) {
    try {
      await fn()
      avisar(mensaje)
      await recargar()
      await onCambio?.()
      return null
    } catch (problema) {
      return problema
    }
  }

  async function ejecutar(tipo, payload) {
    switch (tipo) {
      case 'plan':
        return mutar(
          () => suscripcionesPlataformaService.cambiarPlan(tallerId, payload.plan, token),
          'Plan actualizado.',
        )
      case 'pago':
        return mutar(
          () => suscripcionesPlataformaService.registrarPago(tallerId, payload, token),
          'Pago registrado.',
        )
      case 'acceso':
        return mutar(
          () => suscripcionesPlataformaService.cambiarAcceso(tallerId, payload, token),
          'Acceso actualizado.',
        )
      case 'adicional':
        return mutar(
          () => suscripcionesPlataformaService.activarAdicional(tallerId, payload, token),
          'Adicional activado.',
        )
      case 'vencimiento':
        return mutar(
          () => suscripcionesPlataformaService.ajustarVencimiento(tallerId, payload.vence_en, token),
          'Vencimiento ajustado.',
        )
      case 'desactivarAdicional':
        return mutar(
          () => suscripcionesPlataformaService.desactivarAdicional(tallerId, payload, token),
          'Adicional desactivado.',
        )
      default:
        return new Error(`Acción desconocida: ${tipo}`)
    }
  }

  return { datos, cargando, error, recargar, ejecutar }
}
