import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'

/* Modal de ingreso de stock de un repuesto (estado en `useIngresoStock`). */
export default function ModalIngresoStock({ ingreso }) {
  const { repuesto, cantidad, guardando } = ingreso
  return (
    <Modal
      abierto={Boolean(repuesto)}
      titulo={`Ingreso de stock · ${repuesto?.nombre ?? ''}`}
      descripcion={`Stock actual: ${repuesto?.stock ?? 0} unidades (mínimo ${repuesto?.stock_minimo ?? 0}).`}
      onCerrar={() => !guardando && ingreso.cerrar()}
    >
      <form onSubmit={ingreso.ingresar} noValidate className="space-y-4">
        {ingreso.error && <Alert>{ingreso.error}</Alert>}
        <Field
          label="Cantidad que ingresa"
          inputMode="numeric"
          value={cantidad}
          onChange={(e) => ingreso.cambiarCantidad(e.target.value)}
          error={ingreso.errorCantidad}
          disabled={guardando}
          placeholder="10"
          ayuda={
            Number(cantidad) > 0
              ? `Queda en ${Number(repuesto?.stock ?? 0) + Number(cantidad)} unidades.`
              : undefined
          }
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variante="fantasma" onClick={ingreso.cerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" cargando={guardando}>
            {guardando ? 'Guardando…' : 'Ingresar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
