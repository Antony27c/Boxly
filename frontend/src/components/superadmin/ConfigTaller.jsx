import { useEffect, useMemo, useRef, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Icono from '@/components/ui/Icono'
import Loader from '@/components/ui/Loader'
import Textarea from '@/components/ui/Textarea'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import useTaller from '@/hooks/useTaller'
import { tallerService } from '@/services/taller'

// Misma tarjeta que usan las secciones de Configuración.
const CLASE_TARJETA = 'rounded-box border border-graphite-600 bg-graphite-800 p-5'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

// Campos de texto del formulario (dias_garantia va aparte: es numérico).
const CAMPOS_TEXTO = [
  'nombre',
  'razon_social',
  'cuit',
  'direccion',
  'telefono',
  'email',
  'sitio_web',
  'hora_apertura',
  'hora_cierre',
  'mensaje_portal',
  'pie_ticket',
]
const CAMPOS = [...CAMPOS_TEXTO, 'dias_garantia']

function texto(valor) {
  return valor == null ? '' : String(valor)
}

// El formulario trabaja siempre con strings (lo que hay en el input); el
// servidor recibe null en los opcionales vacíos y número en la garantía.
function formularioDesde(taller) {
  return {
    nombre: texto(taller.nombre),
    razon_social: texto(taller.razon_social),
    cuit: texto(taller.cuit),
    direccion: texto(taller.direccion),
    telefono: texto(taller.telefono),
    email: texto(taller.email),
    sitio_web: texto(taller.sitio_web),
    hora_apertura: texto(taller.hora_apertura),
    hora_cierre: texto(taller.hora_cierre),
    mensaje_portal: texto(taller.mensaje_portal),
    pie_ticket: texto(taller.pie_ticket),
    dias_garantia: taller.dias_garantia != null ? String(taller.dias_garantia) : '',
  }
}

function normalizar(campo, valor) {
  const limpio = valor.trim()
  if (campo === 'dias_garantia') return limpio === '' ? null : Number(limpio)
  return limpio === '' ? null : limpio
}

// El PUT es una actualización parcial: solo viajan los campos que cambiaron.
// El CUIT se compara por dígitos (el servidor acepta guiones) pero se manda
// como lo escribió la persona.
function cambiosEntre(inicial, form) {
  const cambios = {}
  for (const campo of CAMPOS) {
    const antes =
      campo === 'cuit'
        ? texto(inicial[campo]).replace(/\D/g, '')
        : normalizar(campo, inicial[campo])
    const ahora =
      campo === 'cuit' ? texto(form[campo]).replace(/\D/g, '') : normalizar(campo, form[campo])
    if (antes !== ahora) cambios[campo] = normalizar(campo, form[campo])
  }
  return cambios
}

// Validación del lado del cliente igual a la del contrato (docs/SuperAdmin.md);
// el servidor puede responder 422 igual y su mensaje se muestra arriba.
function validarTaller(form) {
  const errores = {}

  const nombre = form.nombre.trim()
  if (nombre.length < 2 || nombre.length > 120) {
    errores.nombre = 'El nombre debe tener entre 2 y 120 caracteres.'
  }

  const cuit = form.cuit.trim()
  if (cuit && cuit.replace(/\D/g, '').length !== 11) {
    errores.cuit = 'El CUIT debe tener 11 dígitos.'
  }

  const email = form.email.trim()
  if (email && !EMAIL.test(email)) {
    errores.email = 'El correo no tiene un formato válido.'
  }

  const apertura = form.hora_apertura.trim()
  const cierre = form.hora_cierre.trim()
  if (!apertura) {
    errores.hora_apertura = 'Ingresá el horario de apertura.'
  } else if (!HORA.test(apertura)) {
    errores.hora_apertura = 'Usá el formato HH:MM (por ejemplo 08:30).'
  }
  if (!cierre) {
    errores.hora_cierre = 'Ingresá el horario de cierre.'
  } else if (!HORA.test(cierre)) {
    errores.hora_cierre = 'Usá el formato HH:MM (por ejemplo 18:00).'
  }
  if (!errores.hora_apertura && !errores.hora_cierre && apertura >= cierre) {
    errores.hora_cierre = 'El cierre tiene que ser después de la apertura.'
  }

  const dias = form.dias_garantia.trim()
  if (!/^\d+$/.test(dias) || Number(dias) > 3650) {
    errores.dias_garantia = 'Ingresá un número entero de días entre 0 y 3650.'
  }

  if (form.mensaje_portal.length > 500) {
    errores.mensaje_portal = 'Máximo 500 caracteres.'
  }
  if (form.pie_ticket.length > 300) {
    errores.pie_ticket = 'Máximo 300 caracteres.'
  }

  return errores
}

function fechaHora(iso) {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return ''
  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ConfigTaller() {
  const { token } = useAuth()
  const { avisar } = useToast()
  const { taller, cargando, error, recargar } = useTaller()

  const [form, setForm] = useState(null)
  const [inicial, setInicial] = useState(null)
  const [errores, setErrores] = useState({})
  const [errorApi, setErrorApi] = useState('')
  const [guardando, setGuardando] = useState(false)
  const ultimoTaller = useRef(null)

  // Cuando llega (o se renueva) el taller, el formulario se reinicia con sus
  // valores: es la única fuente de verdad de "cómo estaba guardado".
  useEffect(() => {
    if (!taller || taller === ultimoTaller.current) return
    ultimoTaller.current = taller
    const valores = formularioDesde(taller)
    setForm(valores)
    setInicial({ ...valores })
    setErrores({})
    setErrorApi('')
  }, [taller])

  function cambiar(campo, valor) {
    setForm((previo) => ({ ...previo, [campo]: valor }))
    if (errores[campo]) setErrores((previo) => ({ ...previo, [campo]: undefined }))
    if (errorApi) setErrorApi('')
  }

  const hayCambios = useMemo(
    () => Boolean(form && inicial && Object.keys(cambiosEntre(inicial, form)).length > 0),
    [form, inicial],
  )

  async function enviar(evento) {
    evento.preventDefault()
    if (!form || !inicial) return

    const encontrados = validarTaller(form)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    const cambios = cambiosEntre(inicial, form)
    if (Object.keys(cambios).length === 0) return

    setGuardando(true)
    setErrorApi('')
    try {
      const actualizado = await tallerService.actualizar(cambios, token)
      avisar('Datos del taller guardados.')
      // El formulario queda igual que la respuesta del servidor; el cache del
      // servicio ya tiene los datos nuevos y recargar refresca el estado.
      const valores = formularioDesde(actualizado)
      setForm(valores)
      setInicial({ ...valores })
      ultimoTaller.current = actualizado
      await recargar()
    } catch (problema) {
      setErrorApi(problema.message)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando && !taller) {
    return <Loader texto="Cargando datos del taller…" />
  }

  if (!taller) {
    return (
      <div className="space-y-4">
        <Alert>{error || 'No pudimos cargar los datos del taller.'}</Alert>
        <Button variante="secundario" onClick={recargar}>
          Reintentar
        </Button>
      </div>
    )
  }

  if (!form) {
    return <Loader texto="Cargando datos del taller…" />
  }

  return (
    <div className="animate-bay-in space-y-5">
      <div>
        <p className="text-sm text-muted">
          Estos datos se muestran en el ticket de cobro y en el portal del cliente.
        </p>
        {taller.actualizado_en && (
          <p className="mt-1 text-xs text-muted">
            Última actualización: {fechaHora(taller.actualizado_en)}
          </p>
        )}
      </div>

      <form onSubmit={enviar} noValidate className="space-y-5">
        {errorApi && <Alert>{errorApi}</Alert>}

        <section className={CLASE_TARJETA} aria-labelledby="taller-identidad">
          <h2 id="taller-identidad" className="flex items-center gap-2 font-semibold">
            <Icono nombre="clientes" className="h-5 w-5 text-amber-texto" />
            Identidad
          </h2>
          <p className="mt-1 text-sm text-muted">Cómo se llama el taller y su razón social.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Nombre"
              value={form.nombre}
              onChange={(e) => cambiar('nombre', e.target.value)}
              error={errores.nombre}
              disabled={guardando}
              maxLength={120}
            />
            <Field
              label="Razón social"
              value={form.razon_social}
              onChange={(e) => cambiar('razon_social', e.target.value)}
              disabled={guardando}
              maxLength={120}
            />
            <Field
              label="CUIT"
              value={form.cuit}
              onChange={(e) => cambiar('cuit', e.target.value)}
              error={errores.cuit}
              disabled={guardando}
              maxLength={13}
              ayuda="11 dígitos, con o sin guiones."
            />
          </div>
        </section>

        <section className={CLASE_TARJETA} aria-labelledby="taller-contacto">
          <h2 id="taller-contacto" className="flex items-center gap-2 font-semibold">
            <Icono nombre="correo" className="h-5 w-5 text-amber-texto" />
            Contacto
          </h2>
          <p className="mt-1 text-sm text-muted">Dónde está el taller y cómo ubicarlo.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Dirección"
              className="sm:col-span-2"
              value={form.direccion}
              onChange={(e) => cambiar('direccion', e.target.value)}
              disabled={guardando}
              maxLength={200}
            />
            <Field
              label="Teléfono"
              value={form.telefono}
              onChange={(e) => cambiar('telefono', e.target.value)}
              disabled={guardando}
              maxLength={30}
            />
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => cambiar('email', e.target.value)}
              error={errores.email}
              disabled={guardando}
              maxLength={120}
              placeholder="contacto@taller.com"
            />
            <Field
              label="Sitio web"
              className="sm:col-span-2"
              value={form.sitio_web}
              onChange={(e) => cambiar('sitio_web', e.target.value)}
              disabled={guardando}
              maxLength={200}
              placeholder="https://"
            />
          </div>
        </section>

        <section className={CLASE_TARJETA} aria-labelledby="taller-atencion">
          <h2 id="taller-atencion" className="flex items-center gap-2 font-semibold">
            <Icono nombre="horarios" className="h-5 w-5 text-amber-texto" />
            Atención
          </h2>
          <p className="mt-1 text-sm text-muted">Horario de atención y garantía de los trabajos.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field
              label="Horario de apertura"
              type="time"
              value={form.hora_apertura}
              onChange={(e) => cambiar('hora_apertura', e.target.value)}
              error={errores.hora_apertura}
              disabled={guardando}
            />
            <Field
              label="Horario de cierre"
              type="time"
              value={form.hora_cierre}
              onChange={(e) => cambiar('hora_cierre', e.target.value)}
              error={errores.hora_cierre}
              disabled={guardando}
            />
            <Field
              label="Días de garantía"
              type="number"
              min={0}
              max={3650}
              inputMode="numeric"
              value={form.dias_garantia}
              onChange={(e) => cambiar('dias_garantia', e.target.value)}
              error={errores.dias_garantia}
              disabled={guardando}
              ayuda="Entre 0 y 3650."
            />
          </div>
        </section>

        <section className={CLASE_TARJETA} aria-labelledby="taller-textos">
          <h2 id="taller-textos" className="flex items-center gap-2 font-semibold">
            <Icono nombre="portal" className="h-5 w-5 text-amber-texto" />
            Textos
          </h2>
          <p className="mt-1 text-sm text-muted">
            Mensajes que ve el cliente en el portal y al pie del ticket de cobro.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4">
            <div>
              <Textarea
                label="Mensaje para el portal del cliente"
                rows={3}
                value={form.mensaje_portal}
                onChange={(e) => cambiar('mensaje_portal', e.target.value)}
                error={errores.mensaje_portal}
                disabled={guardando}
                ayuda="Aparece como aviso arriba del portal."
              />
              <p
                className={`mt-1 text-right text-xs ${
                  form.mensaje_portal.length > 500 ? 'text-danger' : 'text-muted'
                }`}
              >
                {form.mensaje_portal.length}/500
              </p>
            </div>
            <div>
              <Textarea
                label="Pie del ticket de cobro"
                rows={2}
                value={form.pie_ticket}
                onChange={(e) => cambiar('pie_ticket', e.target.value)}
                error={errores.pie_ticket}
                disabled={guardando}
                ayuda="Se imprime al pie del ticket de cobro."
              />
              <p
                className={`mt-1 text-right text-xs ${
                  form.pie_ticket.length > 300 ? 'text-danger' : 'text-muted'
                }`}
              >
                {form.pie_ticket.length}/300
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            {hayCambios ? 'Tienes cambios sin guardar.' : ''}
          </p>
          <Button type="submit" cargando={guardando} disabled={!hayCambios}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  )
}
