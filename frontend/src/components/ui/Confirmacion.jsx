import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

/**
 * Pide confirmar una acción. Por defecto es peligrosa (borrar, cancelar):
 * botón rojo y una franja de cinta de peligro arriba del cuadro.
 */
export default function Confirmacion({
  abierto,
  titulo,
  mensaje,
  error,
  procesando = false,
  textoConfirmar = 'Eliminar',
  peligrosa = true,
  onConfirmar,
  onCerrar,
}) {
  return (
    <Modal abierto={abierto} titulo={titulo} onCerrar={onCerrar} ancho="max-w-md">
      {peligrosa && (
        <span
          aria-hidden="true"
          className="hazard-bar pointer-events-none absolute inset-x-0 top-0 h-1.5"
        />
      )}
      <p className="text-sm text-muted">{mensaje}</p>
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variante="fantasma" onClick={onCerrar} disabled={procesando}>
          Cancelar
        </Button>
        <Button variante={peligrosa ? 'peligro' : 'primario'} onClick={onConfirmar} cargando={procesando}>
          {textoConfirmar}
        </Button>
      </div>
    </Modal>
  )
}
