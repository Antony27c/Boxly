import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import { ROLES } from '@/services/usuarios'
import { validarUsuario } from '@/utils/validation'

const VACIO = {
  nombre: '',
  apellido: '',
  email: '',
  rol: 'recepcionista',
}

export default function FormularioUsuario({ usuario, onGuardar, onCancelar }) {
  const [datos, setDatos] = useState(() => ({ ...VACIO, ...usuario }))
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

    const encontrados = validarUsuario(datos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    setGuardando(true)
    setErrorApi('')
    try {
      await onGuardar({
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        email: datos.email.trim().toLowerCase(),
        rol: datos.rol,
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nombre"
          value={datos.nombre}
          onChange={(e) => cambiar('nombre', e.target.value)}
          error={errores.nombre}
          disabled={guardando}
          placeholder="Sofía"
        />
        <Field
          label="Apellido"
          value={datos.apellido}
          onChange={(e) => cambiar('apellido', e.target.value)}
          error={errores.apellido}
          disabled={guardando}
          placeholder="Rueda"
        />
        <Field
          label="Correo"
          type="email"
          className="sm:col-span-2"
          value={datos.email}
          onChange={(e) => cambiar('email', e.target.value)}
          error={errores.email}
          disabled={guardando}
          placeholder="usuario@boxly.com"
        />
        <Select
          label="Rol"
          className="sm:col-span-2"
          value={datos.rol}
          onChange={(e) => cambiar('rol', e.target.value)}
          error={errores.rol}
          disabled={guardando}
          ayuda="El rol define qué secciones ve el usuario al iniciar sesión."
          opciones={ROLES}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          {guardando ? 'Guardando…' : 'Guardar usuario'}
        </Button>
      </div>
    </form>
  )
}
