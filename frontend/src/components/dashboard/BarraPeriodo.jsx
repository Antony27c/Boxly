import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import { PRESETS } from '@/utils/periodos'
import { hoyAR } from '@/lib/fechas'

const CLASE_CHIP = (activo) =>
  `min-h-[40px] shrink-0 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
    activo
      ? 'border-amber bg-amber/10 text-amber-texto'
      : 'border-graphite-600 text-muted hover:border-graphite-500 hover:text-ink'
  }`

/**
 * Barra de período del Dashboard: chips de presets, rango personalizado con
 * dos fechas, exportación a CSV y buscador rápido por patente.
 *
 * `rango` es { desde, hasta } en ISO; `onCambio` recibe el rango nuevo (solo
 * con fechas válidas). `onExportar` dispara la descarga del CSV.
 */
export default function BarraPeriodo({ rango, onCambio, onExportar }) {
  const navigate = useNavigate()
  const hoy = useMemo(() => hoyAR(), [])
  const [personalizado, setPersonalizado] = useState(false)
  const [borrador, setBorrador] = useState(rango)
  const [patente, setPatente] = useState('')

  const presetActivo = useMemo(() => {
    if (personalizado) return null
    return (
      PRESETS.find((preset) => {
        const r = preset.rango(hoy)
        return r.desde === rango.desde && r.hasta === rango.hasta
      })?.id ?? null
    )
  }, [personalizado, rango, hoy])

  const fechasInvalidas = Boolean(borrador.desde && borrador.hasta && borrador.desde > borrador.hasta)

  function elegirPreset(preset) {
    setPersonalizado(false)
    const nuevo = preset.rango(hoy)
    setBorrador(nuevo)
    onCambio(nuevo)
  }

  function abrirPersonalizado() {
    setPersonalizado(true)
    setBorrador(rango)
  }

  function cambiarFecha(campo, valor) {
    if (!valor) return
    const nuevo = { ...borrador, [campo]: valor }
    setBorrador(nuevo)
    // Solo se avisa hacia arriba cuando el rango quedó válido: la pantalla
    // nunca recibe un "desde" posterior al "hasta".
    if (nuevo.desde <= nuevo.hasta) onCambio(nuevo)
  }

  function buscarPatente(evento) {
    evento.preventDefault()
    const termino = patente.trim()
    if (!termino) return
    navigate(`/ordenes?q=${encodeURIComponent(termino)}`)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={presetActivo === preset.id}
            onClick={() => elegirPreset(preset)}
            className={CLASE_CHIP(presetActivo === preset.id)}
          >
            {preset.texto}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={personalizado}
          onClick={abrirPersonalizado}
          className={CLASE_CHIP(personalizado)}
        >
          Personalizado
        </button>

        {personalizado && (
          <div className="flex flex-wrap items-end gap-3">
            <Field
              label="Desde"
              type="date"
              data-lectura
              className="w-40"
              value={borrador.desde}
              max={borrador.hasta}
              onChange={(e) => cambiarFecha('desde', e.target.value)}
            />
            <Field
              label="Hasta"
              type="date"
              data-lectura
              className="w-40"
              value={borrador.hasta}
              min={borrador.desde}
              max={hoy}
              onChange={(e) => cambiarFecha('hasta', e.target.value)}
            />
          </div>
        )}

        <Button variante="secundario" icono="descarga" className="ml-auto min-h-[40px]" onClick={onExportar}>
          Exportar
        </Button>
      </div>

      {personalizado && fechasInvalidas && (
        <p className="text-sm text-danger" role="alert">
          La fecha "desde" no puede ser posterior a "hasta".
        </p>
      )}

      <form onSubmit={buscarPatente} className="sm:max-w-xs">
        <Field
          label="Buscar por patente"
          data-lectura
          type="search"
          placeholder="Ej.: AB123CD"
          value={patente}
          onChange={(e) => setPatente(e.target.value)}
          icono="buscar"
        />
      </form>
    </div>
  )
}
