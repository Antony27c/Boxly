import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import { ESTADOS_SOLICITUD } from './estados'

const MAX_NOTA = 1000

function Formulario({ solicitud, onGuardar, onCancelar }) {
  const [estado, setEstado] = useState(solicitud.estado ?? 'nueva')
  const [nota, setNota] = useState(solicitud.nota ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await onGuardar({ estado, nota: nota.trim() })
    } catch (problema) {
      setError(problema.message)
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Select
        label="Estado"
        value={estado}
        onChange={(e) => setEstado(e.target.value)}
        opciones={ESTADOS_SOLICITUD.map(({ valor, texto }) => ({ valor, texto }))}
        disabled={guardando}
      />
      <Textarea
        label="Nota (opcional)"
        rows={4}
        maxLength={MAX_NOTA}
        placeholder="Ej.: lo llamé el martes, quiere arrancar el mes que viene."
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        disabled={guardando}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

/* Modal para mover una solicitud de estado y dejarle una nota. El
   formulario se monta de nuevo con cada solicitud. */
export default function CambioEstadoSolicitud({ solicitud, onGuardar, onCerrar }) {
  return (
    <Modal
      abierto={Boolean(solicitud)}
      titulo="Cambiar estado"
      descripcion={solicitud ? `Solicitud de ${solicitud.nombre} (${solicitud.taller}).` : undefined}
      onCerrar={onCerrar}
    >
      {solicitud && (
        <Formulario key={solicitud.id} solicitud={solicitud} onGuardar={onGuardar} onCancelar={onCerrar} />
      )}
    </Modal>
  )
}
