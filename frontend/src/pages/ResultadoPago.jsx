import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Loader from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { pagosService } from '@/services/portal'

const ESTADOS = {
  aprobado: {
    titulo: '¡Pago aprobado!',
    texto: 'Recibimos tu pago. Ya podés pasar a retirar tu vehículo.',
    color: 'border-ok/50 bg-ok/10 text-ok',
    icono: '✓',
  },
  rechazado: {
    titulo: 'El pago fue rechazado',
    texto: 'No se pudo completar el cobro. Podés intentarlo de nuevo con otro medio de pago.',
    color: 'border-danger/50 bg-danger/10 text-danger',
    icono: '✕',
  },
  pendiente: {
    titulo: 'Pago pendiente',
    texto: 'Mercado Pago todavía está procesando el pago. Te avisamos apenas se acredite.',
    color: 'border-amber/50 bg-amber/10 text-amber-deep',
    icono: '…',
  },
}

function pesos(valor) {
  return Number(valor ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

export default function ResultadoPago() {
  const { token } = useAuth()
  const [parametros] = useSearchParams()
  const pagoId = parametros.get('pago_id')
  const paymentId = parametros.get('payment_id') ?? parametros.get('collection_id')
  const [procesando, setProcesando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')

  const cargar = useCallback(
    (t) => {
      if (!pagoId) return Promise.reject(new Error('Falta el número de pago.'))
      if (paymentId && /^\d+$/.test(paymentId)) return pagosService.confirmar(pagoId, paymentId, t)
      return pagosService.obtener(pagoId, t)
    },
    [pagoId, paymentId],
  )
  const { datos: pago, cargando, error, recargar } = useRecurso(cargar)

  async function ejecutar(accion) {
    setProcesando(true)
    setErrorAccion('')
    try {
      await accion()
    } catch (problema) {
      setErrorAccion(problema.message)
    } finally {
      setProcesando(false)
    }
  }

  const simular = (estado) =>
    ejecutar(async () => {
      await pagosService.simular(pago.id, estado, token)
      await recargar()
    })

  const reintentar = () =>
    ejecutar(async () => {
      const { url_pago } = await pagosService.crear(pago.orden_id, token)
      window.location.assign(url_pago)
    })

  if (cargando && !pago) return <Loader texto="Confirmando el pago…" />

  const info = ESTADOS[pago?.estado] ?? ESTADOS.pendiente
  const simulado = pago && !pago.preference_id

  return (
    <div className="mx-auto max-w-lg animate-bay-in">
      {error ? (
        <div className="space-y-4">
          <Alert>{error}</Alert>
          <Link to="/portal" className="text-sm text-amber hover:underline">
            Volver a mis órdenes
          </Link>
        </div>
      ) : (
        <div className="rounded-box border border-graphite-700 bg-graphite-800 p-8 text-center shadow-lift">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full border text-2xl font-bold ${info.color}`}
            aria-hidden="true"
          >
            {info.icono}
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{info.titulo}</h1>
          <p className="mt-2 text-sm text-muted">{info.texto}</p>

          <dl className="mt-6 grid grid-cols-2 gap-3 rounded-box bg-graphite-900 p-4 text-left text-sm">
            <div>
              <dt className="text-muted">Monto</dt>
              <dd className="font-semibold">{pesos(pago.monto)}</dd>
            </div>
            <div>
              <dt className="text-muted">N.º de pago</dt>
              <dd className="font-mono">{pago.payment_id ?? pago.id}</dd>
            </div>
            {pago.fecha_pago && (
              <div className="col-span-2">
                <dt className="text-muted">Fecha</dt>
                <dd>{new Date(pago.fecha_pago).toLocaleString('es-AR')}</dd>
              </div>
            )}
          </dl>

          {errorAccion && (
            <div className="mt-4 text-left">
              <Alert>{errorAccion}</Alert>
            </div>
          )}

          {pago.estado === 'pendiente' && simulado && (
            <div className="mt-6 rounded-box border border-dashed border-graphite-500 p-4">
              <p className="text-xs text-muted">
                Modo prueba: sin Mercado Pago configurado, simulá el resultado del pago.
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <Button cargando={procesando} onClick={() => simular('aprobado')}>
                  Simular aprobado
                </Button>
                <Button variante="secundario" disabled={procesando} onClick={() => simular('rechazado')}>
                  Simular rechazado
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {pago.estado === 'rechazado' && (
              <Button cargando={procesando} onClick={reintentar}>
                Reintentar pago
              </Button>
            )}
            {pago.estado === 'pendiente' && !simulado && (
              <Button variante="secundario" cargando={cargando} onClick={recargar}>
                Actualizar estado
              </Button>
            )}
            <Link
              to="/portal"
              className="inline-flex items-center rounded-box px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-graphite-700 hover:text-ink"
            >
              Volver a mis órdenes
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
