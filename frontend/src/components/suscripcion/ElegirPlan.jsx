import { useCallback, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Icono from '@/components/ui/Icono'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import useRecurso from '@/hooks/useRecurso'
import { etiquetaFuncion, funcionesDePlan } from '@/lib/funcionesPlan'
import { suscripcionService } from '@/services/suscripcion'
import { pesos } from '@/utils/formato'
import { esDemo } from './finDemo'
import {
  AVISO_COBRO_NO_HABILITADO,
  DIAS_DEMO,
  loQueSePierde,
  mensajeErrorPlan,
  PLAN_RECOMENDADO,
} from './planes'

const CLASE_TARJETA = 'rounded-box border border-graphite-600 bg-graphite-800 p-5'

// Lista de funciones de un plan (docs/Oferta.md), todas con el tilde de incluido.
export function ListaFunciones({ funciones, className = '' }) {
  if (funciones.length === 0) return null
  return (
    <ul className={`space-y-1.5 text-sm text-muted ${className}`}>
      {funciones.map((codigo) => (
        <li key={codigo} className="flex flex-wrap items-center gap-2">
          <Icono nombre="check" className="h-4 w-4 shrink-0 text-amber-texto" />
          <span>{etiquetaFuncion(codigo)}</span>
        </li>
      ))}
    </ul>
  )
}

/* Confirmación del plan elegido. Si el taller pierde algo (funciones que usa
   hoy o lugar para su personal), se lo lista antes de confirmar; si el
   personal no entra, no se puede confirmar hasta desactivar a alguien. */
function ConfirmarPlan({ plan, suscripcion, demo, error, aviso, procesando, onConfirmar, onCerrar }) {
  const perdida = loQueSePierde(suscripcion, plan)
  const precio = `El plan ${plan.nombre} cuesta ${pesos(plan.precio_mensual)} por mes.`
  return (
    <Modal abierto titulo={`Pasar a ${plan.nombre}`} onCerrar={procesando ? () => {} : onCerrar} ancho="max-w-md">
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          {demo
            ? `${precio} Después de confirmar, activás el débito automático en Mercado Pago.`
            : `${precio} El precio nuevo rige desde el próximo período; el actual no se prorratea.`}
        </p>
        {perdida.hayPerdida && (
          <div className="rounded-box border border-amber/50 bg-amber/10 p-3">
            <p className="font-semibold text-ink">Con {plan.nombre} dejás de tener:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              {perdida.funciones.map((codigo) => (
                <li key={codigo}>{etiquetaFuncion(codigo)}</li>
              ))}
              {perdida.sobran > 0 && (
                <li>
                  Lugar para todo tu personal: tenés {suscripcion.personal_activo} personas activas y{' '}
                  {plan.nombre} permite hasta {plan.max_personal}. Desactivá a {perdida.sobran} desde
                  Usuarios antes de cambiar.
                </li>
              )}
            </ul>
          </div>
        )}
        {error && <Alert>{error}</Alert>}
        {aviso && <Alert tipo="warning">{aviso}</Alert>}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variante="fantasma" onClick={onCerrar} disabled={procesando}>
          Cancelar
        </Button>
        <Button onClick={onConfirmar} cargando={procesando} disabled={perdida.sobran > 0}>
          {demo ? `Seguir con ${plan.nombre}` : 'Cambiar plan'}
        </Button>
      </div>
    </Modal>
  )
}

/* Tarjetas de los planes y su elección. Pro va "Recomendado". Con una demo
   (de Pro), Pro queda preseleccionado y destacado con "Seguí con Pro", y el
   resto como opción secundaria; elegir un plan en la demo activa el cobro. */
export default function ElegirPlan({ suscripcion, onCambio, antesDeIrAPagar }) {
  const { token } = useAuth()
  const { avisar } = useToast()
  const cargarPlanes = useCallback((t) => suscripcionService.planes(t), [])
  const { datos: planes } = useRecurso(cargarPlanes)

  const [aConfirmar, setAConfirmar] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const demo = esDemo(suscripcion)
  const planActual = suscripcion?.plan?.codigo

  async function irAPagar() {
    if (suscripcion?.cobro_automatico) return false
    antesDeIrAPagar?.()
    const { init_point } = await suscripcionService.activarCobro(token)
    window.location.assign(init_point)
    return true
  }

  async function elegir(plan) {
    setProcesando(true)
    setError('')
    setAviso('')
    let cambio = false
    try {
      if (plan.codigo !== planActual) {
        await suscripcionService.cambiarPlan(plan.codigo, token)
        cambio = true
      }
      if (demo && (await irAPagar())) return
      avisar('Plan actualizado.')
      setAConfirmar(null)
      await onCambio?.()
    } catch (problema) {
      if (problema?.status === 503) setAviso(AVISO_COBRO_NO_HABILITADO)
      else setError(cambio ? problema.message : mensajeErrorPlan(problema, plan, suscripcion))
      if (cambio) onCambio?.()
    } finally {
      setProcesando(false)
    }
  }

  function abrir(plan) {
    setError('')
    setAviso('')
    setAConfirmar(plan)
  }

  // En la demo, Pro sigue sin preguntar si no se pierde nada; si no, se confirma.
  function seguirConPro(plan) {
    if (plan.codigo === planActual) elegir(plan)
    else abrir(plan)
  }

  const lista = planes ?? []
  return (
    <>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((plan) => {
          const actual = plan.codigo === planActual
          const recomendado = plan.codigo === PLAN_RECOMENDADO
          const destacado = demo && recomendado
          return (
            <div
              key={plan.codigo}
              aria-current={destacado ? 'true' : undefined}
              className={`${CLASE_TARJETA} flex flex-col ${
                destacado
                  ? 'border-amber bg-amber/5 ring-2 ring-amber/40 sm:order-first'
                  : actual && !demo
                    ? 'border-amber/60'
                    : ''
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-ink">{plan.nombre}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {recomendado && <Badge tono="ambar">Recomendado</Badge>}
                  {actual && !demo && <Badge tono="ok">Plan actual</Badge>}
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold text-ink">
                {pesos(plan.precio_mensual)}
                <span className="text-sm font-normal text-muted">/mes</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                {plan.max_personal ? `Hasta ${plan.max_personal} del personal` : 'Personal sin límite'}
              </p>
              <ListaFunciones funciones={funcionesDePlan(plan)} className="mt-3 flex-1" />
              {destacado ? (
                <div className="mt-4">
                  <Button
                    className="w-full"
                    cargando={procesando && !aConfirmar}
                    disabled={procesando}
                    onClick={() => seguirConPro(plan)}
                  >
                    Seguí con {plan.nombre}
                  </Button>
                  <p className="mt-2 text-center text-sm text-muted">
                    Mantené todo lo que usaste estos {DIAS_DEMO} días
                  </p>
                </div>
              ) : demo ? (
                <Button variante="secundario" className="mt-4" disabled={procesando} onClick={() => abrir(plan)}>
                  Elegir {plan.nombre}
                </Button>
              ) : (
                !actual && (
                  <Button variante="secundario" className="mt-4" onClick={() => abrir(plan)}>
                    Pasar a este plan
                  </Button>
                )
              )}
            </div>
          )
        })}
      </div>
      {!aConfirmar && (error || aviso) && (
        <div className="mt-3">{error ? <Alert>{error}</Alert> : <Alert tipo="warning">{aviso}</Alert>}</div>
      )}
      {aConfirmar && (
        <ConfirmarPlan
          plan={aConfirmar}
          suscripcion={suscripcion}
          demo={demo}
          error={error}
          aviso={aviso}
          procesando={procesando}
          onConfirmar={() => elegir(aConfirmar)}
          onCerrar={() => setAConfirmar(null)}
        />
      )}
    </>
  )
}
