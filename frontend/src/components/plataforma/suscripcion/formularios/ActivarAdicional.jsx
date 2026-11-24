import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import { etiquetaFuncion } from '../../funciones'

/* Activar un adicional del taller (docs/Oferta.md §4): hoy el único
   confirmado es ARCA. Las fechas son opcionales: vacío = sin límite. Si el
   plan ya incluye la función, el servidor responde 409 y el mensaje se
   muestra acá adentro del modal. */
export default function ActivarAdicional({ guardando, error, onGuardar, onCancelar }) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [errorFechas, setErrorFechas] = useState('')

  function enviar(e) {
    e.preventDefault()
    if (desde && hasta && hasta < desde) {
      setErrorFechas('La fecha de fin no puede ser anterior a la de inicio.')
      return
    }
    setErrorFechas('')
    onGuardar({
      codigo: 'arca',
      ...(desde ? { desde } : {}),
      ...(hasta ? { hasta } : {}),
    })
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <p className="text-sm text-muted">
        Suma {etiquetaFuncion('arca')} al taller sin cambiar de plan. Si el plan ya
        incluye esta función, el servidor lo rechaza.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Vigente desde"
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          disabled={guardando}
        />
        <Field
          label="Vigente hasta"
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          disabled={guardando}
        />
      </div>
      {errorFechas && (
        <p role="alert" className="text-sm text-danger">
          {errorFechas}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          Activar
        </Button>
      </div>
    </form>
  )
}
