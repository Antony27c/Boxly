import AsignarMecanico from '@/components/ordenes/AsignarMecanico'
import CambioEstado from '@/components/ordenes/CambioEstado'
import CobroOrden from '@/components/ordenes/CobroOrden'
import FormularioOrden from '@/components/ordenes/FormularioOrden'
import Confirmacion from '@/components/ui/Confirmacion'
import Modal from '@/components/ui/Modal'

// Host de los modales de la pantalla de órdenes: formulario de nueva/edición,
// cambio de etapa (con destino preseleccionado), cobro, asignar mecánico y la
// confirmación de borrado. Detalles, fotos e historial se resuelven en la
// página de la orden. El estado vive en pages/Ordenes.jsx y llega por props.
export default function ModalesOrden({
  formularioAbierto,
  enEdicion,
  borrador,
  clientes,
  vehiculos,
  mecanicos,
  onCerrarFormulario,
  onGuardar,
  aCambiar,
  esMostrador,
  onCerrarCambio,
  onListoCambio,
  aAsignar,
  onCerrarAsignar,
  onListoAsignar,
  conCobro,
  onCerrarCobro,
  onListoCobro,
  aEliminar,
  errorEliminar,
  eliminando,
  onConfirmarEliminar,
  onCerrarEliminar,
}) {
  const ordenCambio = aCambiar?.orden ?? aCambiar
  return (
    <>
      <Modal
        abierto={formularioAbierto}
        titulo={
          enEdicion ? `Editar orden ${enEdicion.codigo ?? `#${enEdicion.id}`}` : 'Nueva orden de trabajo'
        }
        descripcion="Cada orden registra el trabajo realizado sobre un vehículo del taller."
        onCerrar={onCerrarFormulario}
      >
        <FormularioOrden
          orden={enEdicion ?? borrador}
          clientes={clientes ?? []}
          vehiculos={vehiculos ?? []}
          mecanicos={mecanicos}
          onGuardar={onGuardar}
          onCancelar={onCerrarFormulario}
        />
      </Modal>

      <Modal
        abierto={Boolean(aCambiar)}
        titulo={`Cambiar etapa de la orden ${ordenCambio?.codigo ?? `#${ordenCambio?.id ?? ''}`}`}
        descripcion="Cada cambio de etapa necesita una descripción de lo que se hizo."
        onCerrar={onCerrarCambio}
      >
        {ordenCambio && (
          <CambioEstado
            orden={ordenCambio}
            destinoInicial={aCambiar?.destino}
            puedeCobrar={esMostrador}
            onCancelar={onCerrarCambio}
            onListo={onListoCambio}
          />
        )}
      </Modal>

      <Modal
        abierto={Boolean(aAsignar)}
        titulo={`Asignar mecánico — orden ${aAsignar?.codigo ?? `#${aAsignar?.id ?? ''}`}`}
        descripcion="Elegí qué mecánico toma este trabajo."
        ancho="max-w-md"
        onCerrar={onCerrarAsignar}
      >
        {aAsignar && (
          <AsignarMecanico
            orden={aAsignar}
            mecanicos={mecanicos ?? []}
            onCancelar={onCerrarAsignar}
            onListo={onListoAsignar}
          />
        )}
      </Modal>

      <Modal
        abierto={Boolean(conCobro)}
        titulo={`Cobro de la orden ${conCobro?.codigo ?? `#${conCobro?.id ?? ''}`}`}
        descripcion={
          esMostrador
            ? 'Revisá el monto y envialo al cliente para que lo pague online.'
            : 'Proponé el monto a cobrar; administración o recepción lo aprueba.'
        }
        ancho="max-w-md"
        onCerrar={onCerrarCobro}
      >
        {conCobro && (
          <CobroOrden
            orden={conCobro}
            esMostrador={esMostrador}
            onCancelar={onCerrarCobro}
            onListo={onListoCobro}
          />
        )}
      </Modal>

      <Confirmacion
        abierto={Boolean(aEliminar)}
        titulo="Eliminar orden"
        mensaje={`¿Eliminar la orden ${aEliminar?.codigo ?? `#${aEliminar?.id ?? ''}`}? Solo se pueden borrar órdenes pendientes; las demás se cancelan.`}
        error={errorEliminar}
        procesando={eliminando}
        onConfirmar={onConfirmarEliminar}
        onCerrar={onCerrarEliminar}
      />
    </>
  )
}
