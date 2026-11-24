import Confirmacion from '@/components/ui/Confirmacion'
import Modal from '@/components/ui/Modal'
import { etiquetaFuncion } from '../funciones'
import { fechaSuscripcion } from './formatos'
import CambioAcceso from './formularios/CambioAcceso'
import CambioPlan from './formularios/CambioPlan'
import RegistrarPago from './formularios/RegistrarPago'
import AjusteVencimiento from './formularios/AjusteVencimiento'
import ActivarAdicional from './formularios/ActivarAdicional'

/* Todos los diálogos de la suscripción del taller: cambio de acceso, cambio
   de plan, pago o cortesía, ajuste de vencimiento (fecha + confirmación con
   el antes y el después) y adicionales (activar + desactivación confirmada).
   El estado de cuál está abierto lo maneja SuscripcionTaller. */
export default function ModalesSuscripcion({
  accion,
  onCerrarAccion,
  suscripcion,
  planes,
  guardando,
  errorAccion,
  onGuardar,
  onSolicitarVencimiento,
  confirmandoVencimiento,
  onCerrarVencimiento,
  onConfirmarVencimiento,
  confirmandoDesactivacion,
  errorDesactivacion,
  onConfirmarDesactivacion,
  onCerrarDesactivacion,
}) {
  return (
    <>
      <Modal
        abierto={accion === 'acceso'}
        titulo="Cambiar acceso"
        descripcion="Convierte el acceso del taller: de demo o piloto a pago, o a piloto con fecha de fin. Queda auditado."
        onCerrar={onCerrarAccion}
      >
        <CambioAcceso
          tipoActual={suscripcion.tipo_acceso}
          planActual={suscripcion.plan?.codigo}
          planes={planes}
          guardando={guardando}
          error={errorAccion}
          onGuardar={onGuardar}
          onCancelar={onCerrarAccion}
        />
      </Modal>

      <Modal
        abierto={accion === 'plan'}
        titulo="Cambiar plan"
        descripcion="El plan nuevo rige ya; el precio se cobra desde el próximo período."
        onCerrar={onCerrarAccion}
      >
        <CambioPlan
          planActual={suscripcion.plan?.codigo}
          planes={planes}
          guardando={guardando}
          error={errorAccion}
          onGuardar={onGuardar}
          onCancelar={onCerrarAccion}
        />
      </Modal>

      <Modal
        abierto={accion === 'pago'}
        titulo="Registrar pago o cortesía"
        descripcion="Un pago aprobado extiende el vencimiento del taller."
        onCerrar={onCerrarAccion}
      >
        <RegistrarPago
          precioMensual={suscripcion.plan?.precio_mensual}
          guardando={guardando}
          error={errorAccion}
          onGuardar={onGuardar}
          onCancelar={onCerrarAccion}
        />
      </Modal>

      <Modal
        abierto={accion === 'vencimiento'}
        titulo="Ajustar vencimiento"
        descripcion="Cortesía o corrección manual del vencimiento."
        onCerrar={onCerrarAccion}
      >
        <AjusteVencimiento
          venceActual={suscripcion.vence_en ? String(suscripcion.vence_en).slice(0, 10) : ''}
          guardando={guardando}
          onSolicitar={onSolicitarVencimiento}
          onCancelar={onCerrarAccion}
        />
      </Modal>

      <Modal
        abierto={accion === 'adicional'}
        titulo="Activar adicional"
        descripcion="Suma una función al taller sin cambiar de plan."
        onCerrar={onCerrarAccion}
      >
        <ActivarAdicional
          guardando={guardando}
          error={errorAccion}
          onGuardar={onGuardar}
          onCancelar={onCerrarAccion}
        />
      </Modal>

      <Confirmacion
        abierto={Boolean(confirmandoVencimiento)}
        titulo="Confirmar vencimiento"
        mensaje={`Vencimiento actual: ${fechaSuscripcion(suscripcion.vence_en)}. Nuevo vencimiento: ${fechaSuscripcion(confirmandoVencimiento)}. Queda registrado en la auditoría.`}
        textoConfirmar="Ajustar vencimiento"
        peligrosa={false}
        error={errorAccion}
        procesando={guardando}
        onConfirmar={onConfirmarVencimiento}
        onCerrar={onCerrarVencimiento}
      />

      <Confirmacion
        abierto={Boolean(confirmandoDesactivacion)}
        titulo="Desactivar adicional"
        mensaje={`Se desactiva ${etiquetaFuncion(confirmandoDesactivacion)} para este taller.`}
        textoConfirmar="Desactivar"
        peligrosa
        error={errorDesactivacion}
        procesando={guardando}
        onConfirmar={onConfirmarDesactivacion}
        onCerrar={onCerrarDesactivacion}
      />
    </>
  )
}
