import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import BloqueCliente from './ingreso/BloqueCliente'
import BloqueVehiculoNuevo from './ingreso/BloqueVehiculoNuevo'
import PasoAuto from './ingreso/PasoAuto'
import PasoTrabajo from './ingreso/PasoTrabajo'
import useIngresoRapido from './ingreso/useIngresoRapido'

/**
 * Ingreso rápido de un auto por patente, con o sin turno.
 * Abre desde "Nueva orden", Hoy y Turnos. `inicial` puede traer
 * { turno, vehiculoId, clienteId, mecanicoId, motivo } precargados.
 * El estado y las llamadas viven en `useIngresoRapido`; cada paso, en `ingreso/`.
 */
export default function IngresoRapido({ abierto, onCerrar, onListo, inicial }) {
  const ingreso = useIngresoRapido({ abierto, inicial, onCerrar, onListo })
  const { errores, guardando } = ingreso
  const turno = inicial?.turno

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={turno ? 'Recibir auto del turno' : 'Recibir auto'}
      descripcion={
        turno?.hora
          ? `Turno de las ${turno.hora}. Al confirmar, el auto queda ingresado y el turno pasa a "en el taller".`
          : 'Escribí la patente y el trabajo; el auto queda ingresado en el taller.'
      }
      ancho="max-w-xl"
    >
      <div className="space-y-6">
        <PasoAuto
          patente={ingreso.patente}
          esPatenteNueva={ingreso.esPatenteNueva}
          errores={errores}
          guardando={guardando}
        >
          <BloqueCliente cliente={ingreso.cliente} errores={errores} guardando={guardando} />
          <BloqueVehiculoNuevo
            patente={ingreso.patente.patente}
            vehiculo={ingreso.vehiculoNuevo}
            errores={errores}
            guardando={guardando}
          />
        </PasoAuto>

        {ingreso.mostrarTrabajo && (
          <PasoTrabajo trabajo={ingreso.trabajo} errores={errores} guardando={guardando} />
        )}

        {ingreso.errorApi && <Alert>{ingreso.errorApi}</Alert>}

        <div className="flex justify-end gap-2 border-t border-graphite-700 pt-4">
          <Button type="button" variante="fantasma" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="button" onClick={ingreso.recibirAuto} cargando={guardando}>
            Recibir auto
          </Button>
        </div>
      </div>
    </Modal>
  )
}
