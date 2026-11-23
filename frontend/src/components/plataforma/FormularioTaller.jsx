import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const VACIO = { nombre: '', admin_nombre: '', admin_apellido: '', admin_email: '' }

function validar(datos) {
  const errores = {}
  if (datos.nombre.trim().length < 2) errores.nombre = 'Ingresá el nombre del taller.'
  if (datos.admin_nombre.trim().length < 2) errores.admin_nombre = 'Ingresá el nombre del administrador.'
  if (datos.admin_apellido.trim().length < 2)
    errores.admin_apellido = 'Ingresá el apellido del administrador.'
  const correo = datos.admin_email.trim()
  if (!correo) errores.admin_email = 'Ingresá el correo del administrador.'
  else if (!EMAIL.test(correo)) errores.admin_email = 'El correo no tiene un formato válido.'
  return errores
}

/* Formulario de alta de taller: nombre del taller y los datos del primer
   administrador (recibe una contraseña temporal que se muestra una vez). */
export default function FormularioTaller({ onGuardar, onCancelar }) {
  const [datos, setDatos] = useState(VACIO)
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
      await onGuardar({
        nombre: datos.nombre.trim(),
        admin: {
          nombre: datos.admin_nombre.trim(),
          apellido: datos.admin_apellido.trim(),
          email: datos.admin_email.trim().toLowerCase(),
        },
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
        placeholder="Ej.: Taller El Rayo"
      />

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
            placeholder="Ej.: Ana"
          />
          <Field
            label="Apellido"
            value={datos.admin_apellido}
            onChange={(e) => cambiar('admin_apellido', e.target.value)}
            error={errores.admin_apellido}
            disabled={guardando}
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
