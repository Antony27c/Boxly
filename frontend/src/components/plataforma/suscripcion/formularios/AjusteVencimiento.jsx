import { useState } from 'react'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'

/* Ajuste manual del vencimiento (cortesía o corrección): solo pide la fecha;
   el guardado lo confirma un paso aparte (Confirmacion) para que se vea el
   antes y el después antes de tocar la suscripción. */
export default function AjusteVencimiento({ venceActual, guardando, onSolicitar, onCancelar }) {
  const [vence, setVence] = useState(venceActual ?? '')
  const [errorFecha, setErrorFecha] = useState('')

  function enviar(e) {
    e.preventDefault()
    if (!vence) {
      setErrorFecha('Elegí la nueva fecha de vencimiento.')
      return
    }
    setErrorFecha('')
    onSolicitar(vence)
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <p className="text-sm text-muted">
        Para cortesías o correcciones. El ajuste queda registrado en la auditoría.
      </p>

      <Field
        label="Vence el"
        type="date"
        value={vence}
        onChange={(e) => setVence(e.target.value)}
        error={errorFecha}
        disabled={guardando}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          Continuar
        </Button>
      </div>
    </form>
  )
}
