import { useCallback, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import Icono from '@/components/ui/Icono'
import Loader from '@/components/ui/Loader'
import {
  estadoPago,
  estadoSuscripcion,
  fraseEstado,
  medioPago,
} from '@/components/suscripcion/estados'
import { fraseDemoVencida } from '@/components/suscripcion/finDemo'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import useRecurso from '@/hooks/useRecurso'
import useSuscripcion from '@/hooks/useSuscripcion'
import { formatearFecha, formatearFechaHora } from '@/lib/fechas'
import { esProximamente, etiquetaFuncion, funcionesDePlan, ordenar } from '@/lib/funcionesPlan'
import { suscripcionService } from '@/services/suscripcion'
import { pesos } from '@/utils/formato'

const CLASE_TARJETA = 'rounded-box border border-graphite-600 bg-graphite-800 p-5'

// "23/12": el día y el mes de una fecha del servidor (lib/fechas.js), sin el año.
function fechaCorta(valor) {
  const fecha = formatearFecha(valor)
  return fecha === '—' ? fecha : fecha.slice(0, 5)
}

function estadoVisual(suscripcion) {
  // Una demo vencida no tiene gracia: 3 días para elegir plan (docs/Oferta.md).
  const fraseDemo = fraseDemoVencida(suscripcion)
  if (fraseDemo) {
    const suspendida = suscripcion.estado === 'suspendida'
    return { tono: 'peligro', chip: suspendida ? 'Suspendida' : 'Demo terminada', frase: fraseDemo }
  }
  const estado = estadoSuscripcion(suscripcion?.estado)
  return { tono: estado.tono, chip: estado.corto, frase: fraseEstado(suscripcion) }
}

function textoPersonal(plan, activo, maximo) {
  if (!maximo) return 'Personal sin límite'
  if (activo != null) return `${activo} de ${maximo} del personal en uso`
  return `Hasta ${maximo} del personal`
}

/* Lista de funciones de un plan, con "Próximamente" en las que todavía no existen
   (docs/Oferta.md). */
function ListaFunciones({ funciones, className = '' }) {
  if (funciones.length === 0) return null
  return (
    <ul className={`space-y-1.5 text-sm text-muted ${className}`}>
      {funciones.map((codigo) => (
        <li key={codigo} className="flex flex-wrap items-center gap-2">
          <Icono nombre="check" className="h-4 w-4 shrink-0 text-amber-texto" />
          <span>{etiquetaFuncion(codigo)}</span>
          {esProximamente(codigo) && <Badge>Próximamente</Badge>}
        </li>
      ))}
    </ul>
  )
}

// Las del taller: las del plan más los adicionales (funciones_efectivas), o las del plan.
function funcionesDelTaller(suscripcion) {
  if (Array.isArray(suscripcion?.funciones_efectivas)) return ordenar(suscripcion.funciones_efectivas)
  return funcionesDePlan(suscripcion?.plan)
}

/* Los pagos manuales los carga Boxly (el superadmin no es del taller y el
   servidor no manda su nombre); null en un cobro de Mercado Pago es automático. */
function quienRegistro(pago) {
  if (pago.registrado_por) return pago.registrado_por
  return pago.medio === 'manual' ? 'Boxly' : 'Automático'
}

/* El 409 del servidor ("Tu personal activo supera el límite de ese plan") no dice
   cuántos son ni qué hacer: con la suscripción a mano lo explicamos. */
function mensajeErrorPlan(problema, plan, suscripcion) {
  if (problema?.status !== 409) return problema?.message
  const activos = suscripcion?.personal_activo
  if (activos == null || !plan?.max_personal) return problema.message
  return (
    `Tenés ${activos} personas activas en el personal y el plan ${plan.nombre} permite ` +
    `hasta ${plan.max_personal}. Desactivá a quien ya no trabaje en el taller desde ` +
    'Usuarios, o elegí un plan más grande.'
  )
}

export default function Suscripcion() {
  const { token } = useAuth()
  const { avisar } = useToast()
  const { suscripcion, cargando, error, recargar } = useSuscripcion()

  const cargarPlanes = useCallback((t) => suscripcionService.planes(t), [])
  const { datos: planes } = useRecurso(cargarPlanes)
  const cargarPagos = useCallback((t) => suscripcionService.pagos(t), [])
  const { datos: pagos, cargando: cargandoPagos, error: errorPagos } = useRecurso(cargarPagos)

  const [planAConfirmar, setPlanAConfirmar] = useState(null)
  const [cambiandoPlan, setCambiandoPlan] = useState(false)
  const [errorPlan, setErrorPlan] = useState('')
  const [confirmarBaja, setConfirmarBaja] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [activando, setActivando] = useState(false)
  const [errorCobro, setErrorCobro] = useState('')
  const [avisoCobro, setAvisoCobro] = useState('')

  async function confirmarCambioPlan() {
    setCambiandoPlan(true)
    setErrorPlan('')
    try {
      await suscripcionService.cambiarPlan(planAConfirmar.codigo, token)
      avisar('Plan actualizado.')
      setPlanAConfirmar(null)
      await recargar()
    } catch (problema) {
      setErrorPlan(mensajeErrorPlan(problema, planAConfirmar, suscripcion))
    } finally {
      setCambiandoPlan(false)
    }
  }

  async function activarCobro() {
    setActivando(true)
    setErrorCobro('')
    setAvisoCobro('')
    try {
      const { init_point } = await suscripcionService.activarCobro(token)
      window.location.assign(init_point)
    } catch (problema) {
      if (problema.status === 503) {
        setAvisoCobro(
          'El débito automático todavía no está habilitado. Escribinos y te ayudamos.',
        )
      } else {
        setErrorCobro(problema.message)
      }
    } finally {
      setActivando(false)
    }
  }

  async function confirmarCancelarCobro() {
    setCancelando(true)
    setErrorCobro('')
    try {
      await suscripcionService.cancelarCobro(token)
      avisar('Cobro automático cancelado.')
      setConfirmarBaja(false)
      await recargar()
    } catch (problema) {
      setErrorCobro(problema.message)
    } finally {
      setCancelando(false)
    }
  }

  if (cargando && !suscripcion) return <Loader texto="Cargando suscripción…" />
  if (error && !suscripcion) {
    return (
      <div className="space-y-4">
        <Alert>{error.message}</Alert>
        <Button variante="secundario" onClick={recargar}>
          Reintentar
        </Button>
      </div>
    )
  }
  if (!suscripcion) return null

  const visual = estadoVisual(suscripcion)
  const planActual = suscripcion.plan?.codigo
  const listaPagos = pagos ?? []

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">Suscripción</h1>
        <p className="mt-1 text-sm text-muted">
          El plan de Boxly del taller, su vencimiento y los pagos registrados.
        </p>
      </header>

      <section className={CLASE_TARJETA} aria-labelledby="estado-suscripcion">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tono={visual.tono}>{visual.chip}</Badge>
          <h2 id="estado-suscripcion" className="text-lg font-semibold text-ink">
            {visual.frase}
          </h2>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted">Plan</dt>
            <dd className="font-medium text-ink">
              {suscripcion.plan?.nombre} · {pesos(suscripcion.plan?.precio_mensual)}/mes
            </dd>
          </div>
          <div>
            <dt className="text-muted">Personal</dt>
            <dd className="font-medium text-ink">
              {textoPersonal(
                suscripcion.plan,
                suscripcion.personal_activo,
                suscripcion.max_personal,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Próximo cobro</dt>
            <dd className="font-medium text-ink">
              {suscripcion.proximo_monto != null ? pesos(suscripcion.proximo_monto) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Cobro automático</dt>
            <dd className="font-medium text-ink">
              {suscripcion.cobro_automatico ? 'Activo (Mercado Pago)' : 'No activo'}
            </dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-graphite-700 pt-4">
          <h3 className="text-sm font-medium text-ink">Incluye tu plan</h3>
          <ListaFunciones funciones={funcionesDelTaller(suscripcion)} className="mt-2" />
        </div>
        {suscripcion.estado === 'suspendida' && (
          <div className="mt-4">
            <Alert>
              El taller está suspendido: solo podés usar esta pantalla hasta regularizar el
              pago con el débito automático de Mercado Pago.
            </Alert>
          </div>
        )}
      </section>

      <section aria-labelledby="planes-suscripcion">
        <h2 id="planes-suscripcion" className="text-lg font-semibold text-ink">
          Planes
        </h2>
        <p className="mt-1 text-sm text-muted">
          El precio nuevo rige desde el próximo período; el actual no se prorratea.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(planes ?? []).map((plan) => {
            const actual = plan.codigo === planActual
            return (
              <div
                key={plan.codigo}
                className={`${CLASE_TARJETA} flex flex-col ${actual ? 'border-amber/60' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-ink">{plan.nombre}</h3>
                  {actual && <Badge tono="ok">Plan actual</Badge>}
                </div>
                <p className="mt-2 text-2xl font-bold text-ink">
                  {pesos(plan.precio_mensual)}
                  <span className="text-sm font-normal text-muted">/mes</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {plan.max_personal ? `Hasta ${plan.max_personal} del personal` : 'Personal sin límite'}
                </p>
                <ListaFunciones funciones={funcionesDePlan(plan)} className="mt-3 flex-1" />
                {!actual && (
                  <Button
                    variante="secundario"
                    className="mt-4"
                    onClick={() => {
                      setErrorPlan('')
                      setPlanAConfirmar(plan)
                    }}
                  >
                    Pasar a este plan
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className={CLASE_TARJETA} aria-labelledby="cobro-suscripcion">
        <h2 id="cobro-suscripcion" className="flex items-center gap-2 font-semibold text-ink">
          <Icono nombre="llave" className="h-5 w-5 text-amber-texto" />
          Cobro automático
        </h2>
        {suscripcion.cobro_automatico ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted">
              Está activo: Mercado Pago debita el plan cada mes, sin que tengas que hacer nada.
            </p>
            <Button variante="secundario" onClick={() => setConfirmarBaja(true)}>
              Cancelar cobro automático
            </Button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted">
              Activá el débito automático y Mercado Pago cobra el plan cada mes: te olvidás del
              vencimiento y evitás cortes.
            </p>
            <Button cargando={activando} onClick={activarCobro}>
              Activar cobro automático
            </Button>
          </div>
        )}
        {avisoCobro && (
          <div className="mt-3">
            <Alert tipo="warning">{avisoCobro}</Alert>
          </div>
        )}
        {errorCobro && (
          <div className="mt-3">
            <Alert>{errorCobro}</Alert>
          </div>
        )}
      </section>

      <section aria-labelledby="pagos-suscripcion">
        <h2 id="pagos-suscripcion" className="text-lg font-semibold text-ink">
          Historial de pagos
        </h2>
        {cargandoPagos ? (
          <Loader texto="Cargando pagos…" />
        ) : errorPagos ? (
          <div className="mt-3">
            <Alert>{errorPagos}</Alert>
          </div>
        ) : listaPagos.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Todavía no hay pagos registrados.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-box border border-graphite-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-graphite-800 text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">Monto</th>
                  <th className="px-4 py-2.5 font-medium">Período</th>
                  <th className="px-4 py-2.5 font-medium">Medio</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Registrado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-700">
                {listaPagos.map((pago) => (
                  <tr key={pago.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                      {formatearFechaHora(pago.creado_en)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-ink">{pesos(pago.monto)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                      {fechaCorta(pago.periodo_desde)} → {fechaCorta(pago.periodo_hasta)}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {medioPago(pago.medio)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tono={estadoPago(pago.estado).tono}>{estadoPago(pago.estado).texto}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{quienRegistro(pago)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Confirmacion
        abierto={planAConfirmar != null}
        titulo={`Pasar a ${planAConfirmar?.nombre ?? ''}`}
        mensaje={`El plan ${planAConfirmar?.nombre ?? ''} cuesta ${pesos(
          planAConfirmar?.precio_mensual,
        )} por mes. El precio nuevo rige desde el próximo período; el actual no se prorratea.`}
        error={errorPlan}
        procesando={cambiandoPlan}
        textoConfirmar="Cambiar plan"
        peligrosa={false}
        onConfirmar={confirmarCambioPlan}
        onCerrar={() => setPlanAConfirmar(null)}
      />
      <Confirmacion
        abierto={confirmarBaja}
        titulo="Cancelar cobro automático"
        mensaje="Mercado Pago deja de debitar la suscripción. Para seguir usando Boxly después del vencimiento, vas a tener que volver a activarlo."
        procesando={cancelando}
        textoConfirmar="Sí, cancelar"
        onConfirmar={confirmarCancelarCobro}
        onCerrar={() => setConfirmarBaja(false)}
      />
    </div>
  )
}
