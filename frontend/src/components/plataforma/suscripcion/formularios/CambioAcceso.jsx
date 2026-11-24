import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import { opcionesDePlanes } from '../formatos'

/* Destinos válidos de "Cambiar acceso" (docs/Oferta.md §4): demo no es un
   destino — se otorga desde una solicitud aprobada, no por conversión. */
const TIPOS_DESTINO = [
  { valor: 'pago', texto: 'Pago' },
  { valor: 'piloto', texto: 'Piloto sin cargo' },
]

/* Conversión del tipo de acceso (C2): demo o piloto pasan a pago, o el
   taller queda como piloto con plan, fecha de fin y motivo. */
export default function CambioAcceso({ tipoActual, planActual, planes, guardando, error, onGuardar, onCancelar }) {
  const [tipo, setTipo] = useState(tipoActual === 'pago' ? 'piloto' : 'pago')
  const [plan, setPlan] = useState(planActual ?? '')
  const [venceEn, setVenceEn] = useState('')
  const [motivo, setMotivo] = useState('')
  const [errores, setErrores] = useState({})

  function enviar(e) {
    e.preventDefault()
    const encontrados = {}
    if (!plan) encontrados.plan = 'Elegí el plan del taller.'
    if (tipo === 'piloto') {
      if (!venceEn) encontrados.venceEn = 'Elegí la fecha de fin del piloto.'
      if (motivo.trim().length < 3)
        encontrados.motivo = 'Contanos el motivo del piloto (para qué taller es).'
    }
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    const datos = { tipo, plan }
    if (tipo === 'piloto') {
      datos.vence_en = venceEn
      datos.motivo = motivo.trim()
    }
    onGuardar(datos)
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <Select
        label="Tipo de acceso nuevo"
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        opciones={TIPOS_DESTINO}
        disabled={guardando}
      />

      <Select
        label="Plan"
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
        opciones={opcionesDePlanes(planes)}
        error={errores.plan}
        disabled={guardando}
      />

      {tipo === 'piloto' && (
        <>
          <Field
            label="Fin del piloto"
            type="date"
            value={venceEn}
            onChange={(e) => setVenceEn(e.target.value)}
            error={errores.venceEn}
            disabled={guardando}
          />
          <Textarea
            label="Motivo"
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            error={errores.motivo}
            disabled={guardando}
            maxLength={500}
            placeholder="Ej.: piloto con un taller amigo, referido por…"
          />
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          Cambiar acceso
        </Button>
      </div>
    </form>
  )
}
