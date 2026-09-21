import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Textarea from '@/components/ui/Textarea'
import { validarCliente } from '@/utils/validation'

const VACIO = {
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  email: '',
  direccion: '',
}

export default function FormularioCliente({ cliente, onGuardar, onCancelar }) {
  const [datos, setDatos] = useState(() => ({ ...VACIO, ...cliente }))
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

    const encontrados = validarCliente(datos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    setGuardando(true)
    setErrorApi('')
    try {
      await onGuardar({
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        dni: datos.dni.trim(),
        telefono: datos.telefono.trim(),
        email: datos.email.trim(),
        direccion: datos.direccion.trim(),
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
          placeholder="Marina"
        />
        <Field
          label="Apellido o razón social"
          value={datos.apellido}
          onChange={(e) => cambiar('apellido', e.target.value)}
          error={errores.apellido}
          disabled={guardando}
          placeholder="Villagra"
        />
        <Field
          label="DNI / CUIT"
          inputMode="numeric"
          value={datos.dni}
          onChange={(e) => cambiar('dni', e.target.value)}
          error={errores.dni}
          disabled={guardando}
          placeholder="32458711"
        />
        <Field
          label="Teléfono"
          inputMode="tel"
          value={datos.telefono}
          onChange={(e) => cambiar('telefono', e.target.value)}
          error={errores.telefono}
          disabled={guardando}
          placeholder="3874112233"
        />
        <Field
          label="Correo (opcional)"
          type="email"
          className="sm:col-span-2"
          value={datos.email}
          onChange={(e) => cambiar('email', e.target.value)}
          error={errores.email}
          disabled={guardando}
          placeholder="cliente@correo.com"
        />
      </div>

      <Textarea
        label="Dirección (opcional)"
        value={datos.direccion}
        onChange={(e) => cambiar('direccion', e.target.value)}
        disabled={guardando}
        placeholder="Av. Belgrano 1450, Salta"
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cliente'}
        </Button>
      </div>
    </form>
  )
}
