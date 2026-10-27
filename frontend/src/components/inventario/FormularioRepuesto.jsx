import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Textarea from '@/components/ui/Textarea'
import { validarRepuesto } from '@/utils/validation'

const VACIO = {
  codigo: '',
  nombre: '',
  descripcion: '',
  precio: '',
  stock: '0',
  stock_minimo: '0',
}

/* Formulario de alta y edición de repuestos.
   - Sin la prop `repuesto`: alta.  Con `repuesto`: edición (los campos vienen cargados). */
export default function FormularioRepuesto({ repuesto, onGuardar, onCancelar }) {
  const esEdicion = Boolean(repuesto)

  const [datos, setDatos] = useState(() =>
    Object.fromEntries(
      Object.keys(VACIO).map((campo) => [campo, String(repuesto?.[campo] ?? VACIO[campo])]),
    ),
  )
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

    // 1. Validación en el navegador
    const encontrados = validarRepuesto(datos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    // 2. Envío. Si el padre lanza un error (ej. código repetido 409) se muestra acá.
    setGuardando(true)
    setErrorApi('')
    try {
      await onGuardar(datos)
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
          label="Código"
          value={datos.codigo}
          onChange={(e) => cambiar('codigo', e.target.value.toUpperCase())}
          error={errores.codigo}
          ayuda="Se guarda en mayúsculas y sin espacios."
          disabled={guardando}
          placeholder="REP-1001"
        />
        <Field
          label="Nombre"
          value={datos.nombre}
          onChange={(e) => cambiar('nombre', e.target.value)}
          error={errores.nombre}
          disabled={guardando}
          placeholder="Filtro de aceite"
        />
      </div>

      <Textarea
        label="Descripción (opcional)"
        value={datos.descripcion}
        onChange={(e) => cambiar('descripcion', e.target.value)}
        disabled={guardando}
        placeholder="Filtro original para service."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Precio ($)"
          inputMode="decimal"
          value={datos.precio}
          onChange={(e) => cambiar('precio', e.target.value)}
          error={errores.precio}
          disabled={guardando}
          placeholder="8500"
        />
        <Field
          label="Stock actual"
          inputMode="numeric"
          value={datos.stock}
          onChange={(e) => cambiar('stock', e.target.value)}
          error={errores.stock}
          ayuda={esEdicion ? 'Para sumar unidades usá "Ingresar stock".' : undefined}
          disabled={guardando || esEdicion}
        />
        <Field
          label="Stock mínimo"
          inputMode="numeric"
          value={datos.stock_minimo}
          onChange={(e) => cambiar('stock_minimo', e.target.value)}
          error={errores.stock_minimo}
          ayuda="Avisa cuando el stock llega a este valor."
          disabled={guardando}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear repuesto'}
        </Button>
      </div>
    </form>
  )
}
