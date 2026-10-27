import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import { DIAS_SEMANA } from '@/services/mecanicos'

const VACIO = { dia_semana: 0, hora_desde: '08:00', hora_hasta: '12:00' }

export default function FormularioHorario({ horario, onGuardar, onCancelar }) {
  const [datos, setDatos] = useState(() => ({ ...VACIO, ...horario }))
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  function cambiar(campo, valor) {
    setDatos((previo) => ({ ...previo, [campo]: valor }))
    setError('')
  }

  async function enviar(evento) {
    evento.preventDefault()
    if (!datos.hora_desde || !datos.hora_hasta) return setError('Completá las dos horas.')
    if (datos.hora_desde >= datos.hora_hasta) return setError('La hora de inicio tiene que ser anterior a la de fin.')
    setEnviando(true)
    try {
      await onGuardar({
        dia_semana: Number(datos.dia_semana),
        hora_desde: datos.hora_desde,
        hora_hasta: datos.hora_hasta,
      })
    } catch (problema) {
      setError(problema.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Select
        label="Día"
        value={datos.dia_semana}
        onChange={(e) => cambiar('dia_semana', e.target.value)}
        opciones={DIAS_SEMANA.map((texto, valor) => ({ valor, texto }))}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Desde"
          type="time"
          value={datos.hora_desde}
          onChange={(e) => cambiar('hora_desde', e.target.value)}
        />
        <Field
          label="Hasta"
          type="time"
          value={datos.hora_hasta}
          onChange={(e) => cambiar('hora_hasta', e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={enviando}>
          Guardar franja
        </Button>
      </div>
    </form>
  )
}
