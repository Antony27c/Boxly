import { useCallback, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import useRecurso from '@/hooks/useRecurso'
import { suscripcionesPlataformaService } from '@/services/suscripcionesPlataforma'
import { pesos } from '@/utils/formato'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const VACIO = {
  nombre: '',
  admin_nombre: '',
  admin_apellido: '',
  admin_email: '',
  acceso: 'demo',
  plan: '',
  vence_en: '',
  motivo: '',
}
// Mismos topes que el backend (app/schemas/plataforma.py).
const MAX = { nombre: 120, persona: 80, email: 254, motivo: 500 }

/* Tipo de acceso del taller (docs/Oferta.md §4, API de C2):
   - demo: plan Pro durante 14 días, lo fuerza el backend.
   - piloto: plan y fecha de fin a elección del superadmin, con motivo.
   - pago: el taller paga su suscripción; solo hace falta elegir el plan. */
const TIPOS_ACCESO = [
  { valor: 'demo', texto: 'Demo (plan Pro, 14 días)' },
  { valor: 'piloto', texto: 'Piloto sin cargo' },
  { valor: 'pago', texto: 'Pago' },
]

function validar(datos) {
  const errores = {}
  if (datos.nombre.trim().length < 2) errores.nombre = 'Ingresá el nombre del taller.'
  if (datos.admin_nombre.trim().length < 2) errores.admin_nombre = 'Ingresá el nombre del administrador.'
  if (datos.admin_apellido.trim().length < 2)
    errores.admin_apellido = 'Ingresá el apellido del administrador.'
  const correo = datos.admin_email.trim()
  if (!correo) errores.admin_email = 'Ingresá el correo del administrador.'
  else if (!EMAIL.test(correo)) errores.admin_email = 'El correo no tiene un formato válido.'

  if (datos.acceso !== 'demo' && !datos.plan)
    errores.plan = 'Elegí el plan del taller.'
  if (datos.acceso === 'piloto') {
    if (!datos.vence_en) errores.vence_en = 'Elegí la fecha de fin del piloto.'
    if (datos.motivo.trim().length < 3)
      errores.motivo = 'Contanos el motivo del piloto (para qué taller es).'
  }
  return errores
}

/* Selector de plan para piloto y pago: pide los planes a la API y solo deja
   elegir los activos. Se monta recién cuando el tipo de acceso lo necesita,
   así el alta demo no gasta el pedido. */
function SelectorPlan({ valor, error, deshabilitado, onChange }) {
  const cargar = useCallback((t) => suscripcionesPlataformaService.listarPlanes(t), [])
  const { datos: planes, cargando, error: errorPlanes, recargar } = useRecurso(cargar)
  const activas = (planes ?? []).filter((plan) => plan.activo !== false)
  const opciones = [
    { valor: '', texto: 'Elegí un plan' },
    ...activas.map((plan) => ({
      valor: plan.codigo,
      texto: `${plan.nombre} — ${pesos(plan.precio_mensual)}/mes`,
    })),
  ]

  if (errorPlanes) {
    return (
      <div className="space-y-3">
        <Alert>{errorPlanes}</Alert>
        <Button type="button" variante="secundario" onClick={recargar}>
          Reintentar
        </Button>
      </div>
    )
  }

  if (!cargando && activas.length === 0) {
    return <Alert>No hay planes activos para asignar. Revisá la página de Planes.</Alert>
  }

  return (
    <Select
      label="Plan"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      opciones={cargando ? [{ valor: '', texto: 'Cargando planes…' }] : opciones}
      error={error}
      disabled={deshabilitado || cargando}
    />
  )
}

/* Formulario de alta de taller: nombre del taller, tipo de acceso y los
   datos del primer administrador (recibe una contraseña temporal que se
   muestra una vez). `inicial` precarga los campos (alta desde una solicitud
   de demo); como el Modal desmonta el formulario al cerrar, cada apertura
   arranca de cero — y el tipo de acceso vuelve a Demo, que es lo que
   corresponde a una solicitud aprobada. */
export default function FormularioTaller({ onGuardar, onCancelar, inicial }) {
  const [datos, setDatos] = useState(() => ({
    ...VACIO,
    nombre: inicial?.nombre ?? '',
    admin_nombre: inicial?.admin_nombre ?? '',
    admin_apellido: inicial?.admin_apellido ?? '',
    admin_email: inicial?.admin_email ?? '',
  }))
  const [errores, setErrores] = useState({})
  const [errorApi, setErrorApi] = useState('')
  const [guardando, setGuardando] = useState(false)

  function cambiar(campo, valor) {
    setDatos((previo) => ({ ...previo, [campo]: valor }))
    if (errores[campo]) setErrores((previo) => ({ ...previo, [campo]: undefined }))
    if (errorApi) setErrorApi('')
  }

  async function enviar(evento) {
    evento.preventDefault()
    const encontrados = validar(datos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    setGuardando(true)
    setErrorApi('')
    try {
      const acceso = { tipo: datos.acceso }
      if (datos.acceso !== 'demo') {
        acceso.plan = datos.plan
        if (datos.acceso === 'piloto') {
          acceso.vence_en = datos.vence_en
          acceso.motivo = datos.motivo.trim()
        }
      }
      await onGuardar({
        nombre: datos.nombre.trim(),
        admin: {
          nombre: datos.admin_nombre.trim(),
          apellido: datos.admin_apellido.trim(),
          email: datos.admin_email.trim().toLowerCase(),
        },
        acceso,
      })
    } catch (problema) {
      setErrorApi(problema.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {errorApi && <Alert>{errorApi}</Alert>}

      <Field
        label="Nombre del taller"
        value={datos.nombre}
        onChange={(e) => cambiar('nombre', e.target.value)}
        error={errores.nombre}
        disabled={guardando}
        maxLength={MAX.nombre}
        placeholder="Ej.: Taller El Rayo"
      />

      <Select
        label="Tipo de acceso"
        value={datos.acceso}
        onChange={(e) => cambiar('acceso', e.target.value)}
        opciones={TIPOS_ACCESO}
        disabled={guardando}
        ayuda="Demo: 14 días gratis para probar. Piloto: acceso sin cargo con fecha de fin. Pago: el taller paga su plan."
      />

      {datos.acceso !== 'demo' && (
        <div className="space-y-4 rounded-box border border-graphite-600 p-4">
          <SelectorPlan
            valor={datos.plan}
            error={errores.plan}
            deshabilitado={guardando}
            onChange={(valor) => cambiar('plan', valor)}
          />
          {datos.acceso === 'piloto' && (
            <>
              <Field
                label="Fin del piloto"
                type="date"
                value={datos.vence_en}
                onChange={(e) => cambiar('vence_en', e.target.value)}
                error={errores.vence_en}
                disabled={guardando}
              />
              <Textarea
                label="Motivo"
                rows={2}
                value={datos.motivo}
                onChange={(e) => cambiar('motivo', e.target.value)}
                error={errores.motivo}
                disabled={guardando}
                maxLength={MAX.motivo}
                placeholder="Ej.: piloto con un taller amigo, referido por…"
              />
            </>
          )}
        </div>
      )}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-ink">Primer administrador</legend>
        <p className="-mt-2 text-sm text-muted">
          Es quien va a administrar el taller; le vas a pasar una contraseña temporal.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Nombre"
            value={datos.admin_nombre}
            onChange={(e) => cambiar('admin_nombre', e.target.value)}
            error={errores.admin_nombre}
            disabled={guardando}
            maxLength={MAX.persona}
            placeholder="Ej.: Ana"
          />
          <Field
            label="Apellido"
            value={datos.admin_apellido}
            onChange={(e) => cambiar('admin_apellido', e.target.value)}
            error={errores.admin_apellido}
            disabled={guardando}
            maxLength={MAX.persona}
            placeholder="Ej.: Gómez"
          />
          <Field
            label="Correo"
            type="email"
            className="sm:col-span-2"
            value={datos.admin_email}
            onChange={(e) => cambiar('admin_email', e.target.value)}
            error={errores.admin_email}
            disabled={guardando}
            maxLength={MAX.email}
            placeholder="admin@eltaller.com"
          />
        </div>
      </fieldset>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          {guardando ? 'Creando…' : 'Crear taller'}
        </Button>
      </div>
    </form>
  )
}
