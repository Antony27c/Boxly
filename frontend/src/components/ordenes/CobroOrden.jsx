import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import { useAuth } from '@/context/AuthContext'
import { estadoCobro, ordenesService } from '@/services/ordenes'

function pesos(valor) {
  return Number(valor ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

function montoInicial(orden) {
  const valor = Number(orden.costo_final) || Number(orden.monto_propuesto) || Number(orden.costo_estimado) || ''
  return String(valor)
}

export default function CobroOrden({ orden, esMostrador, onListo, onCancelar }) {
  const { token } = useAuth()
  const situacion = estadoCobro(orden)
  const [monto, setMonto] = useState(() => montoInicial(orden))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const soloLectura = situacion === 'pagada' || (!esMostrador && situacion === 'aprobado')

  const accion = esMostrador
    ? situacion === 'pendiente'
      ? 'Aprobar y enviar al cliente'
      : situacion === 'aprobado'
        ? 'Guardar nuevo monto'
        : 'Enviar cobro al cliente'
    : situacion === 'pendiente'
      ? 'Actualizar propuesta'
      : 'Enviar a revisión'

  async function enviar(evento) {
    evento.preventDefault()
    if (!(Number(monto) > 0)) {
      setError('Poné un monto mayor a 0.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      if (esMostrador && situacion === 'pendiente') {
        await ordenesService.aprobarCobro(orden.id, monto, token)
        onListo('Cobro aprobado. El cliente ya puede pagarlo desde su portal.')
      } else {
        await ordenesService.emitirCobro(orden.id, monto, token)
        onListo(
          esMostrador
            ? 'Cobro enviado. El cliente ya puede pagarlo desde su portal.'
            : 'Cobro enviado a revisión. Recepción lo tiene que aprobar.',
        )
      }
    } catch (problema) {
      setError(problema.message)
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <div className="space-y-1 rounded-box border border-graphite-700 bg-graphite-900 p-3 text-sm">
        {situacion === 'pagada' && <p className="font-medium text-ok">El cliente ya pagó {pesos(orden.costo_final)}.</p>}
        {situacion === 'aprobado' && (
          <p>
            <span className="font-medium">Enviado al cliente:</span> {pesos(orden.costo_final)}
            {orden.cobro_aprobado_por_nombre && (
              <span className="text-muted"> · aprobó {orden.cobro_aprobado_por_nombre}</span>
            )}
          </p>
        )}
        {situacion === 'pendiente' && (
          <p>
            <span className="font-medium">Propuesto:</span> {pesos(orden.monto_propuesto)}
            {orden.cobro_propuesto_por_nombre && (
              <span className="text-muted"> · por {orden.cobro_propuesto_por_nombre}</span>
            )}
            <span className="block text-amber-deep">Esperando aprobación de administración o recepción.</span>
          </p>
        )}
        {situacion === 'sin_cobro' && <p className="text-muted">Todavía no se emitió el cobro de esta orden.</p>}
        {Number(orden.costo_estimado) > 0 && (
          <p className="text-muted">Presupuesto estimado: {pesos(orden.costo_estimado)}</p>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {soloLectura ? (
        <>
          {situacion === 'aprobado' && (
            <Alert tipo="info">Si hay que cambiar el monto, pedíselo a recepción.</Alert>
          )}
          <div className="flex justify-end">
            <Button type="button" variante="secundario" onClick={onCancelar}>
              Cerrar
            </Button>
          </div>
        </>
      ) : (
        <>
          <Field
            label={esMostrador ? 'Monto a cobrar' : 'Monto a cobrar (lo aprueba recepción)'}
            inputMode="numeric"
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value)
              if (error) setError('')
            }}
            disabled={guardando}
            placeholder="185000"
            ayuda={
              esMostrador
                ? 'Al confirmar, el cliente lo ve en su portal y puede pagarlo online.'
                : 'El cliente lo va a ver recién cuando administración o recepción lo apruebe.'
            }
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" cargando={guardando}>
              {accion}
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
