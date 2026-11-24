import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'

/* Edición del nombre del taller (PUT /plataforma/talleres/{id} con {nombre}).
   Guarda solo cuando cambió y tiene al menos 2 caracteres. */
export default function DatosTaller({ taller, onGuardar }) {
  const [valor, setValor] = useState(taller.nombre ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Si el servidor devuelve otro nombre (lo editó otro superadmin), se
  // sincroniza durante el render: es el ajuste de estado que recomienda React.
  const nombreServidor = taller.nombre ?? ''
  const [nombrePrevio, setNombrePrevio] = useState(nombreServidor)
  if (nombrePrevio !== nombreServidor) {
    setNombrePrevio(nombreServidor)
    setValor(nombreServidor)
  }

  const limpio = valor.trim()
  const actual = (taller.nombre ?? '').trim()
  const valido = limpio.length >= 2
  const cambiado = valido && limpio !== actual

  async function guardar() {
    if (!cambiado || guardando) return
    setGuardando(true)
    setError('')
    try {
      await onGuardar(limpio)
    } catch (problema) {
      setError(problema.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mt-4">
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <Field
          label="Nombre del taller"
          className="min-w-0 flex-1 basis-64"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          disabled={guardando}
          error={valor.trim() !== '' && !valido ? 'El nombre debe tener al menos 2 caracteres.' : undefined}
        />
        <Button onClick={guardar} cargando={guardando} disabled={!cambiado}>
          Guardar nombre
        </Button>
      </div>
    </div>
  )
}
