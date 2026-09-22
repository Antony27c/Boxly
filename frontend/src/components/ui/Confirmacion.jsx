import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

export default function Confirmacion({
  abierto,
  titulo,
  mensaje,
  error,
  procesando = false,
  textoConfirmar = 'Eliminar',
  onConfirmar,
  onCerrar,
}) {
  return (
    <Modal abierto={abierto} titulo={titulo} onCerrar={onCerrar} ancho="max-w-md">
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
        <Button variante="peligro" onClick={onConfirmar} cargando={procesando}>
          {textoConfirmar}
        </Button>
      </div>
    </Modal>
  )
}
