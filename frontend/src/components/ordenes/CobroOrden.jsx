import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import { useAuth } from '@/context/AuthContext'
import useTaller from '@/hooks/useTaller'
import { formatearFechaHora } from '@/lib/fechas'
import { formatearMontoAR, MENSAJE_MONTO_INVALIDO, parsearMontoAR } from '@/lib/montos'
import { estadoCobro, MEDIOS_PAGO_LOCAL, montoDelServidor, ordenesService, textoPagada } from '@/services/ordenes'
import { pesos } from '@/utils/formato'
import '@/styles/ticket.css'

// Se precarga en formato argentino ("185.000,50"), igual que se tipea.
function montoInicial(orden) {
  const valor = Number(orden.costo_final) || Number(orden.monto_propuesto) || Number(orden.costo_estimado) || 0
  return valor > 0 ? formatearMontoAR(valor) : ''
}

// El CUIT se muestra como XX-XXXXXXXX-X cuando tiene los 11 dígitos.
function cuitLegible(cuit) {
  const digitos = String(cuit ?? '').replace(/\D/g, '')
  if (digitos.length !== 11) return cuit
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`
}

/* Pago presencial de un cobro ya emitido (W2). El backend exige el monto
   exacto del cobro (no hay pagos parciales): se muestra solo para leer y se
   manda el costo_final tal cual, sin pasar por lo que se tipee. */
function RegistrarPagoLocal({ orden, abierto, onCerrar, onListo }) {
  const { token } = useAuth()
  const [medio, setMedio] = useState('efectivo')
  const [referencia, setReferencia] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const monto = montoDelServidor(orden.costo_final)
  const montoValido = monto != null && monto > 0

  async function registrar(evento) {
    evento.preventDefault()
    if (!montoValido) return
    setGuardando(true)
    setError('')
    try {
      await ordenesService.registrarPagoLocal(orden.id, { medio, monto, referencia }, token)
      onListo('Pago registrado. La orden quedó pagada.')
    } catch (problema) {
      setError(problema.message)
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Registrar pago en el local"
      descripcion="El cliente pagó en el taller el cobro emitido."
      ancho="max-w-sm"
      onCerrar={guardando ? () => {} : onCerrar}
    >
      <form onSubmit={registrar} noValidate className="space-y-4">
        <Select
          label="Medio de pago"
          value={medio}
          onChange={(e) => setMedio(e.target.value)}
          opciones={MEDIOS_PAGO_LOCAL}
          disabled={guardando}
        />
        <dl>
          <dt className="text-sm font-medium text-muted">Monto del cobro</dt>
          <dd className="mt-1 font-mono text-2xl font-semibold text-ink">{montoValido ? pesos(monto) : '—'}</dd>
        </dl>
        {!montoValido && <Alert>La orden no tiene un cobro emitido con monto válido.</Alert>}
        <Field
          label="Referencia (opcional)"
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
          maxLength={100}
          disabled={guardando}
          placeholder="Ej.: n.º de operación o de comprobante"
        />
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variante="fantasma" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" cargando={guardando} disabled={!montoValido}>
            Registrar pago
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function CobroOrden({ orden, esMostrador, onListo, onCancelar }) {
  const { token } = useAuth()
  const { taller } = useTaller()
  const situacion = estadoCobro(orden)
  const [monto, setMonto] = useState(() => montoInicial(orden))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [pagoLocal, setPagoLocal] = useState(false)

  const soloLectura = situacion === 'pagada' || (!esMostrador && situacion === 'aprobado')
  // Con líneas a cotizar el backend rechaza el cobro (409, S3): se avisa
  // antes en vez de dejar que el intento falle.
  const hayACotizar = Number(orden.lineas_a_cotizar ?? 0) > 0
  // Recepción y el administrador registran el pago presencial de un cobro emitido.
  const puedeRegistrarPago = esMostrador && situacion === 'aprobado' && !hayACotizar

  // Línea del total del ticket según en qué quedó el cobro (sin cobro no hay total).
  const total =
    situacion === 'pagada'
      ? {
          etiqueta: 'El cliente ya pagó',
          monto: orden.costo_final,
          clase: 'text-ok',
          detalle: [
            textoPagada(orden.pago_medio),
            orden.pago_fecha && formatearFechaHora(orden.pago_fecha),
          ]
            .filter(Boolean)
            .join(' · '),
        }
      : situacion === 'aprobado'
        ? {
            etiqueta: 'Enviado al cliente:',
            monto: orden.costo_final,
            detalle: orden.cobro_aprobado_por_nombre && `Aprobó ${orden.cobro_aprobado_por_nombre}`,
          }
        : situacion === 'pendiente'
          ? {
              etiqueta: 'Propuesto:',
              monto: orden.monto_propuesto,
              detalle: orden.cobro_propuesto_por_nombre && `Por ${orden.cobro_propuesto_por_nombre}`,
            }
          : null

  const garantia =
    taller?.dias_garantia != null
      ? `Garantía: ${taller.dias_garantia} ${Number(taller.dias_garantia) === 1 ? 'día' : 'días'}`
      : null

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
    const numero = parsearMontoAR(monto)
    if (numero === null) {
      setError(String(monto).trim() ? MENSAJE_MONTO_INVALIDO : 'Poné el monto a cobrar.')
      return
    }
    if (!(numero > 0)) {
      setError('Poné un monto mayor a 0.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      if (esMostrador && situacion === 'pendiente') {
        await ordenesService.aprobarCobro(orden.id, numero, token)
        onListo('Cobro aprobado. El cliente ya puede pagarlo desde su portal.')
      } else {
        await ordenesService.emitirCobro(orden.id, numero, token)
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
    <>
      <form onSubmit={enviar} noValidate className="space-y-4">
        <div className="ticket-caja space-y-2 border-x border-graphite-700 bg-graphite-900 px-4 py-5 text-sm">
          {taller?.nombre && (
            <div className="space-y-0.5 border-b border-dashed border-graphite-600 pb-2 text-center">
              <p className="font-semibold text-ink">{taller.nombre}</p>
              {taller.direccion && <p className="text-muted">{taller.direccion}</p>}
              {taller.telefono && <p className="text-muted">Tel: {taller.telefono}</p>}
              {taller.cuit && <p className="text-muted">CUIT: {cuitLegible(taller.cuit)}</p>}
            </div>
          )}
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted" aria-hidden="true">
            Cobro{orden.id != null && ` · Orden #${orden.id}`}
          </p>
          {Number(orden.costo_estimado) > 0 && (
            <p className="flex items-baseline justify-between gap-3 text-muted">
              <span>Presupuesto estimado:</span>
              <span className="shrink-0 font-mono tabular-nums">{pesos(orden.costo_estimado)}</span>
            </p>
          )}
          {situacion === 'sin_cobro' && <p className="text-muted">Todavía no se emitió el cobro de esta orden.</p>}
          {total && (
            <div className="space-y-1 border-t border-dashed border-graphite-600 pt-2">
              <p className={`flex items-baseline justify-between gap-3 font-medium ${total.clase}`}>
                <span>{total.etiqueta}</span>
                <span className="shrink-0 font-mono text-base font-semibold tabular-nums">{pesos(total.monto)}</span>
              </p>
              {total.detalle && <p className="text-muted">{total.detalle}</p>}
              {situacion === 'pendiente' && (
                <p className="text-amber-deep">Esperando aprobación de administración o recepción.</p>
              )}
            </div>
          )}
          {(taller?.pie_ticket || garantia) && (
            <div className="space-y-1 border-t border-dashed border-graphite-600 pt-2 text-center">
              {taller?.pie_ticket && <p className="text-muted">{taller.pie_ticket}</p>}
              {garantia && <p className="text-muted">{garantia}</p>}
            </div>
          )}
        </div>

        {error && <Alert>{error}</Alert>}

        {hayACotizar ? (
          <div className="space-y-4">
            <Alert tipo="info">Cotizá los trabajos pendientes antes de cobrar.</Alert>
            <div className="flex justify-end">
              <Button type="button" variante="secundario" onClick={onCancelar}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : soloLectura ? (
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
              inputMode="decimal"
              value={monto}
              onChange={(e) => {
                setMonto(e.target.value)
                if (error) setError('')
              }}
              disabled={guardando}
              placeholder="Ej.: 185.000 o 185.000,50"
              ayuda={
                esMostrador
                  ? 'Al confirmar, el cliente lo ve en su portal y puede pagarlo online.'
                  : 'El cliente lo va a ver recién cuando administración o recepción lo apruebe.'
              }
            />
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
                Cancelar
              </Button>
              {puedeRegistrarPago && (
                <Button type="button" variante="secundario" onClick={() => setPagoLocal(true)} disabled={guardando}>
                  Registrar pago en el local
                </Button>
              )}
              <Button type="submit" cargando={guardando}>
                {accion}
              </Button>
            </div>
          </>
        )}
      </form>
      {puedeRegistrarPago && pagoLocal && (
        <RegistrarPagoLocal
          orden={orden}
          abierto
          onCerrar={() => setPagoLocal(false)}
          onListo={(mensaje) => {
            setPagoLocal(false)
            onListo(mensaje)
          }}
        />
      )}
    </>
  )
}
