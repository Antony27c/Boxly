import { useMemo, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { useAuth } from '@/context/AuthContext'
import { ordenesService } from '@/services/ordenes'

// Modal chico para asignar (o desasignar) el mecánico de una orden.
// Conserva el resto de los campos usando ordenesService.actualizar.
export default function AsignarMecanico({ orden, mecanicos = [], onListo, onCancelar }) {
  const { token } = useAuth()
  const [mecanicoId, setMecanicoId] = useState(() => String(orden.mecanico_id ?? ''))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const opciones = useMemo(() => {
    const lista = mecanicos.map((mecanico) => ({
      valor: String(mecanico.id),
      texto: `${mecanico.apellido}, ${mecanico.nombre}`,
    }))
    // Si el mecánico asignado ya no está activo, se ofrece igual para no
    // mostrar "Sin asignar" por error ni perder la asignación al guardar.
    if (orden.mecanico_id && !lista.some((o) => o.valor === String(orden.mecanico_id))) {
      lista.push({
        valor: String(orden.mecanico_id),
        texto: `${orden.mecanico || 'Mecánico asignado'} (inactivo)`,
      })
    }
    return [{ valor: '', texto: 'Sin asignar' }, ...lista]
  }, [mecanicos, orden])

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await ordenesService.actualizar(
        orden.id,
        { ...orden, mecanico_id: mecanicoId || null },
        token,
      )
      onListo()
    } catch (problema) {
      setError(problema.message)
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} noValidate className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <p className="text-sm text-muted">
        Orden {orden.codigo ?? `#${orden.id}`}
        {orden.vehiculo_patente ? ` · ${orden.vehiculo_patente}` : ''}
      </p>

      <Select
        label="Mecánico"
        value={mecanicoId}
        onChange={(e) => setMecanicoId(e.target.value)}
        disabled={guardando}
        opciones={opciones}
      />

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          Guardar
        </Button>
      </div>
    </form>
  )
}
