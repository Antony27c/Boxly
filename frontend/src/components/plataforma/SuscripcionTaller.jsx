import { useCallback, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import { Chip } from '@/components/ui/Ficha'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Confirmacion from '@/components/ui/Confirmacion'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import useRecurso from '@/hooks/useRecurso'
import { suscripcionesPlataformaService } from '@/services/suscripcionesPlataforma'
import { pesos } from '@/utils/formato'
import { fechaHora } from './formatos'

/* Estado de la suscripción (lo calcula el backend, docs/Suscripciones.md).
   TarjetaTaller tiene su propia copia mínima: los archivos de componente no
   exportan constantes (regla de fast refresh). */
const ESTADOS_SUSCRIPCION = {
  al_dia: { texto: 'Al día', tono: 'ok', detalle: null },
  gracia: {
    texto: 'En gracia',
    tono: 'ambar',
    detalle: 'El taller tiene unos días de gracia; después pasa a solo lectura.',
  },
  solo_lectura: {
    texto: 'Solo lectura',
    tono: 'peligro',
    detalle: 'El personal y los clientes solo pueden leer hasta que se regularice el pago.',
  },
  suspendida: {
    texto: 'Suspendida por falta de pago',
    tono: 'peligro',
    detalle: 'Solo el administrador puede entrar, y solo a la sección de suscripción.',
  },
}

const MEDIOS = { manual: 'Manual', mercadopago: 'Mercado Pago' }
const ESTADOS_PAGO = {
  aprobado: { texto: 'Aprobado', tono: 'ok' },
  pendiente: { texto: 'Pendiente', tono: 'ambar' },
  rechazado: { texto: 'Rechazado', tono: 'peligro' },
}

const MESES = Array.from({ length: 12 }, (_, i) => ({
  valor: String(i + 1),
  texto: i + 1 === 1 ? '1 mes' : `${i + 1} meses`,
}))

// Las fechas de suscripción y pagos llegan como YYYY-MM-DD: se muestran
// DD/MM/AAAA sin pasar por Date para no correr el día por la zona horaria.
function fechaSuscripcion(fecha) {
  if (!fecha) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha))
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return fechaHora(fecha)
}

function textoDias(dias) {
  if (dias == null) return '—'
  if (dias === 0) return 'Vence hoy'
  if (dias > 0) return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`
  const atraso = -dias
  return `Venció hace ${atraso} ${atraso === 1 ? 'día' : 'días'}`
}

function hoy() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function Dato({ etiqueta, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{children}</dd>
    </div>
  )
}

function CambioPlan({ planActual, planes, guardando, error, onGuardar, onCancelar }) {
  const [plan, setPlan] = useState(planActual ?? '')
  const opciones = planes.map((p) => ({
    valor: p.codigo,
    texto: `${p.nombre} — ${pesos(p.precio_mensual)}${p.activo ? '' : ' (inactivo)'}`,
  }))

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
        opciones={opciones}
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

function FormularioPago({ precioMensual, guardando, error, onGuardar, onCancelar }) {
  const [meses, setMeses] = useState('1')
  const [monto, setMonto] = useState(() => String(Number(precioMensual ?? 0)))
  const [referencia, setReferencia] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [errorMonto, setErrorMonto] = useState('')

  // El monto sugerido es el precio del plan por la cantidad de meses; queda
  // editable por si el pago fue otro monto (señas, descuentos, cortesía = 0).
  function cambiarMeses(valor) {
    setMeses(valor)
    setMonto(String(Number(precioMensual ?? 0) * Number(valor)))
  }

  function enviar(e) {
    e.preventDefault()
    const numero = Number(monto)
    if (monto.trim() === '' || !Number.isFinite(numero) || numero < 0) {
      setErrorMonto('Ingresá un monto válido (0 o más; 0 si es una cortesía).')
      return
    }
    setErrorMonto('')
    onGuardar({
      monto: numero,
      meses: Number(meses),
      fecha: fecha || undefined,
      referencia: referencia.trim() || undefined,
    })
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Meses"
          value={meses}
          onChange={(e) => cambiarMeses(e.target.value)}
          opciones={MESES}
          disabled={guardando}
        />
        <Field
          label="Monto"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          error={errorMonto}
          disabled={guardando}
          ayuda="Sugerido: precio del plan × meses. 0 si es una cortesía."
        />
      </div>

      <Field
        label="Fecha del pago"
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        disabled={guardando}
      />

      <Field
        label="Referencia"
        value={referencia}
        onChange={(e) => setReferencia(e.target.value)}
        disabled={guardando}
        placeholder="Ej.: n.º de comprobante"
        ayuda="Opcional: comprobante, captura o nota."
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          Registrar
        </Button>
      </div>
    </form>
  )
}

// Solo pide la fecha: el guardado lo confirma un paso aparte (Confirmacion)
// para que se vea el antes y el después antes de tocar la suscripción.
function FormularioVencimiento({ venceActual, guardando, onSolicitar, onCancelar }) {
  const [vence, setVence] = useState(venceActual ?? '')
  const [errorFecha, setErrorFecha] = useState('')

  function enviar(e) {
    e.preventDefault()
    if (!vence) {
      setErrorFecha('Elegí la nueva fecha de vencimiento.')
      return
    }
    setErrorFecha('')
    onSolicitar(vence)
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <p className="text-sm text-muted">
        Para cortesías o correcciones. El ajuste queda registrado en la auditoría.
      </p>

      <Field
        label="Vence el"
        type="date"
        value={vence}
        onChange={(e) => setVence(e.target.value)}
        error={errorFecha}
        disabled={guardando}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          Continuar
        </Button>
      </div>
    </form>
  )
}

/* Sección "Suscripción" del detalle del taller (S5): estado, vencimiento,
   acciones del superadmin (cambiar plan, registrar pago o cortesía, ajustar
   vencimiento) e historial de pagos. Los datos llegan de
   GET /plataforma/talleres/{id}/suscripcion + /planes. */
export default function SuscripcionTaller({ tallerId, onCambio }) {
  const { token } = useAuth()
  const { avisar } = useToast()

  const cargar = useCallback(
    (t) =>
      Promise.all([
        suscripcionesPlataformaService.obtenerSuscripcion(tallerId, t),
        suscripcionesPlataformaService.listarPlanes(t),
      ]).then(([suscripcion, planes]) => ({ suscripcion, planes })),
    [tallerId],
  )
  const { datos, cargando, error, recargar } = useRecurso(cargar)

  const [accion, setAccion] = useState(null) // 'plan' | 'pago' | 'vencimiento'
  const [confirmandoVencimiento, setConfirmandoVencimiento] = useState(null) // fecha elegida
  const [guardando, setGuardando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')

  async function guardar(datosAccion) {
    setGuardando(true)
    setErrorAccion('')
    try {
      if (accion === 'plan') {
        await suscripcionesPlataformaService.cambiarPlan(tallerId, datosAccion.plan, token)
        avisar('Plan actualizado.')
      } else if (accion === 'pago') {
        await suscripcionesPlataformaService.registrarPago(tallerId, datosAccion, token)
        avisar('Pago registrado.')
      } else {
        await suscripcionesPlataformaService.ajustarVencimiento(
          tallerId,
          datosAccion.vence_en,
          token,
        )
        avisar('Vencimiento ajustado.')
      }
      setAccion(null)
      setConfirmandoVencimiento(null)
      await recargar()
      await onCambio?.()
    } catch (problema) {
      setErrorAccion(problema.message)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando && !datos) return <Loader texto="Cargando suscripción…" />

  if (error) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Button variante="secundario" onClick={recargar}>
          Reintentar
        </Button>
      </div>
    )
  }

  if (!datos) return null

  const { suscripcion, planes } = datos
  const estado = ESTADOS_SUSCRIPCION[suscripcion.estado] ?? {
    texto: suscripcion.estado,
    tono: 'neutro',
    detalle: null,
  }
  const limite = suscripcion.max_personal ?? suscripcion.plan?.max_personal ?? null
  const pagos = suscripcion.pagos ?? []

  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Dato etiqueta="Plan">
          {suscripcion.plan?.nombre ?? '—'}
          {suscripcion.plan?.precio_mensual != null &&
            ` · ${pesos(suscripcion.plan.precio_mensual)}/mes`}
        </Dato>
        <Dato etiqueta="Estado">
          <span className="inline-flex flex-wrap items-center gap-2">
            <Chip tono={estado.tono}>{estado.texto}</Chip>
          </span>
        </Dato>
        <Dato etiqueta="Vencimiento">
          {fechaSuscripcion(suscripcion.vence_en)} · {textoDias(suscripcion.dias_para_vencer)}
        </Dato>
        <Dato etiqueta="Cobro automático">
          {suscripcion.cobro_automatico ? 'Sí' : 'No'}
        </Dato>
        <Dato etiqueta="Personal">
          {suscripcion.personal_activo ?? '—'}
          {limite == null ? ' (sin límite)' : ` de ${limite}`}
        </Dato>
        {suscripcion.proximo_monto != null && (
          <Dato etiqueta="Próximo cobro">{pesos(suscripcion.proximo_monto)}</Dato>
        )}
      </dl>

      {estado.detalle && <p className="mt-3 text-sm text-muted">{estado.detalle}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variante="secundario" icono="ajustes" onClick={() => setAccion('plan')}>
          Cambiar plan
        </Button>
        <Button variante="secundario" icono="dinero" onClick={() => setAccion('pago')}>
          Registrar pago o cortesía
        </Button>
        <Button variante="secundario" icono="horarios" onClick={() => setAccion('vencimiento')}>
          Ajustar vencimiento
        </Button>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold">Historial de pagos</h3>
        {pagos.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Todavía no hay pagos registrados.</p>
        ) : (
          <ul className="mt-2 divide-y divide-graphite-700">
            {pagos.map((pago) => {
              const estadoPago = ESTADOS_PAGO[pago.estado] ?? { texto: pago.estado, tono: 'neutro' }
              return (
                <li key={pago.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                  <span className="text-sm font-semibold tabular-nums text-ink">
                    {pesos(pago.monto)}
                  </span>
                  <Chip tono={estadoPago.tono}>{estadoPago.texto}</Chip>
                  <span className="text-xs text-muted">
                    {fechaHora(pago.creado_en)} · {MEDIOS[pago.medio] ?? pago.medio ?? '—'} ·{' '}
                    {fechaSuscripcion(pago.periodo_desde)} → {fechaSuscripcion(pago.periodo_hasta)}
                    {pago.referencia ? ` · Ref. ${pago.referencia}` : ''}
                    {' · '}
                    {pago.registrado_por ?? 'Automático'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Modal
        abierto={accion === 'plan'}
        titulo="Cambiar plan"
        descripcion="El plan nuevo rige ya; el precio se cobra desde el próximo período."
        onCerrar={() => setAccion(null)}
      >
        <CambioPlan
          planActual={suscripcion.plan?.codigo}
          planes={planes}
          guardando={guardando}
          error={errorAccion}
          onGuardar={guardar}
          onCancelar={() => setAccion(null)}
        />
      </Modal>

      <Modal
        abierto={accion === 'pago'}
        titulo="Registrar pago o cortesía"
        descripcion="Un pago aprobado extiende el vencimiento del taller."
        onCerrar={() => setAccion(null)}
      >
        <FormularioPago
          precioMensual={suscripcion.plan?.precio_mensual}
          guardando={guardando}
          error={errorAccion}
          onGuardar={guardar}
          onCancelar={() => setAccion(null)}
        />
      </Modal>

      <Modal
        abierto={accion === 'vencimiento'}
        titulo="Ajustar vencimiento"
        descripcion="Cortesía o corrección manual del vencimiento."
        onCerrar={() => setAccion(null)}
      >
        <FormularioVencimiento
          venceActual={suscripcion.vence_en ? String(suscripcion.vence_en).slice(0, 10) : ''}
          guardando={guardando}
          onSolicitar={(vence) => {
            setErrorAccion('')
            setConfirmandoVencimiento(vence)
          }}
          onCancelar={() => setAccion(null)}
        />
      </Modal>

      <Confirmacion
        abierto={Boolean(confirmandoVencimiento)}
        titulo="Confirmar vencimiento"
        mensaje={`Vencimiento actual: ${fechaSuscripcion(suscripcion.vence_en)}. Nuevo vencimiento: ${fechaSuscripcion(confirmandoVencimiento)}. Queda registrado en la auditoría.`}
        textoConfirmar="Ajustar vencimiento"
        peligrosa={false}
        error={errorAccion}
        procesando={guardando}
        onConfirmar={() => guardar({ vence_en: confirmandoVencimiento })}
        onCerrar={() => {
          setConfirmandoVencimiento(null)
          setErrorAccion('')
        }}
      />
    </div>
  )
}
