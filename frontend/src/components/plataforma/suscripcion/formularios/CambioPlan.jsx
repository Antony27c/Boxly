import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { opcionesDePlanes } from '../formatos'

/* Cambio de plan del taller: Select con todos los planes (los inactivos van
   marcados) y el aviso de que el servidor rechaza si el personal supera el
   límite del plan elegido (409). */
export default function CambioPlan({ planActual, planes, guardando, error, onGuardar, onCancelar }) {
  const [plan, setPlan] = useState(planActual ?? '')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (plan && plan !== planActual) onGuardar({ plan })
      }}
      className="space-y-4"
    >
      {error && <Alert>{error}</Alert>}
      <Select
        label="Plan nuevo"
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
        opciones={opcionesDePlanes(planes)}
        disabled={guardando}
      />
      <p className="text-sm text-muted">
        Rige ya. Si el personal activo supera el límite del plan elegido, el servidor lo
        rechaza.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando} disabled={!plan || plan === planActual}>
          Cambiar plan
        </Button>
      </div>
    </form>
  )
}
