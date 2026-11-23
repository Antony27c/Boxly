import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import { useAuth } from '@/context/AuthContext'
import { nombreRol, rolesAsignables } from '@/services/usuarios'
import { validarUsuario } from '@/utils/validation'

const VACIO = {
  nombre: '',
  apellido: '',
  email: '',
  rol: 'recepcion',
  password: '',
}

export default function FormularioUsuario({ usuario, onGuardar, onCancelar }) {
  const { usuario: lector } = useAuth()
  const esNuevo = !usuario
  const [datos, setDatos] = useState(() => ({ ...VACIO, ...usuario, password: '' }))
  const [errores, setErrores] = useState({})
  const [errorApi, setErrorApi] = useState('')
  const [guardando, setGuardando] = useState(false)

  // El select solo ofrece los roles que el usuario logueado puede asignar
  // (superadmin: todos; administrador: recepción y mecánico). Si el usuario en
  // edición tiene un rol fuera de la lista (por ejemplo cliente), se agrega
  // para que el select no quede en blanco.
  const asignables = rolesAsignables(lector?.rol)
  const opcionesRol = asignables.some((opcion) => opcion.valor === datos.rol)
    ? asignables
    : [...asignables, { valor: datos.rol, texto: nombreRol(datos.rol) }]

  function cambiar(campo, valor) {
    setDatos((previo) => ({ ...previo, [campo]: valor }))
    if (errores[campo]) setErrores((previo) => ({ ...previo, [campo]: undefined }))
    if (errorApi) setErrorApi('')
  }

  async function enviar(evento) {
    evento.preventDefault()

    const encontrados = validarUsuario(datos, { esNuevo })
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
        ...(datos.password && { password: datos.password }),
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Nombre"
          value={datos.nombre}
          onChange={(e) => cambiar('nombre', e.target.value)}
          error={errores.nombre}
          disabled={guardando}
          placeholder="Ej.: Sofía"
        />
        <Field
          label="Apellido"
          value={datos.apellido}
          onChange={(e) => cambiar('apellido', e.target.value)}
          error={errores.apellido}
          disabled={guardando}
          placeholder="Ej.: Rueda"
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
          opciones={opcionesRol}
        />
        <Field
          label={esNuevo ? 'Contraseña' : 'Nueva contraseña'}
          type="password"
          autoComplete="new-password"
          className="sm:col-span-2"
          value={datos.password}
          onChange={(e) => cambiar('password', e.target.value)}
          error={errores.password}
          disabled={guardando}
          ayuda={
            esNuevo
              ? 'Mínimo 8 caracteres, combinando letras y números.'
              : 'Dejala vacía para mantener la contraseña actual.'
          }
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
