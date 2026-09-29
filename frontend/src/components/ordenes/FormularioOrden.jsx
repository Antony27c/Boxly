import { useMemo, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import { ESTADOS_ORDEN } from '@/services/ordenes'
import { validarOrden } from '@/utils/validation'

const HOY = new Date().toISOString().slice(0, 10)

const VACIO = {
  cliente_id: '',
  vehiculo_id: '',
  fecha: HOY,
  estado: 'Recibido',
  descripcion: '',
  mecanico: '',
  total: '0',
}

export default function FormularioOrden({
  orden,
  clientes = [],
  vehiculos = [],
  onGuardar,
  onCancelar,
}) {
  const [datos, setDatos] = useState(() => {
    if (!orden) return VACIO
    const vehiculo = vehiculos.find((item) => item.id === orden.vehiculo_id)
    return { ...VACIO, ...orden, cliente_id: vehiculo?.cliente_id ?? '', total: String(orden.total ?? 0) }
  })
  const [errores, setErrores] = useState({})
  const [errorApi, setErrorApi] = useState('')
  const [guardando, setGuardando] = useState(false)

  const vehiculosDelCliente = useMemo(() => {
    if (!datos.cliente_id) return vehiculos
    return vehiculos.filter((item) => item.cliente_id === Number(datos.cliente_id))
  }, [vehiculos, datos.cliente_id])

  function cambiar(campo, valor) {
    setDatos((previo) => {
      const siguiente = { ...previo, [campo]: valor }
      if (campo === 'cliente_id') siguiente.vehiculo_id = ''
      return siguiente
    })
    if (errores[campo]) setErrores((previo) => ({ ...previo, [campo]: undefined }))
    if (errorApi) setErrorApi('')
  }

  async function enviar(evento) {
    evento.preventDefault()

    const encontrados = validarOrden(datos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    setGuardando(true)
    setErrorApi('')
    try {
      await onGuardar({
        vehiculo_id: datos.vehiculo_id,
        fecha: datos.fecha,
        estado: datos.estado,
        descripcion: datos.descripcion.trim(),
        mecanico: datos.mecanico.trim(),
        total: datos.total,
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
        <Select
          label="Cliente"
          value={datos.cliente_id}
          onChange={(e) => cambiar('cliente_id', e.target.value)}
          disabled={guardando}
          opciones={[
            { valor: '', texto: 'Todos los clientes' },
            ...clientes.map((cliente) => ({
              valor: cliente.id,
              texto: `${cliente.apellido}, ${cliente.nombre}`,
            })),
          ]}
        />
        <Select
          label="Vehículo"
          value={datos.vehiculo_id}
          onChange={(e) => cambiar('vehiculo_id', e.target.value)}
          error={errores.vehiculo_id}
          disabled={guardando}
          opciones={[
            { valor: '', texto: 'Elegí el vehículo…' },
            ...vehiculosDelCliente.map((vehiculo) => ({
              valor: vehiculo.id,
              texto: `${vehiculo.patente} — ${vehiculo.marca} ${vehiculo.modelo}`,
            })),
          ]}
        />
        <Field
          label="Fecha de ingreso"
          type="date"
          value={datos.fecha}
          onChange={(e) => cambiar('fecha', e.target.value)}
          error={errores.fecha}
          disabled={guardando}
        />
        <Select
          label="Estado"
          value={datos.estado}
          onChange={(e) => cambiar('estado', e.target.value)}
          error={errores.estado}
          disabled={guardando}
          opciones={ESTADOS_ORDEN.map((estado) => ({ valor: estado, texto: estado }))}
        />
        <Field
          label="Mecánico asignado (opcional)"
          value={datos.mecanico}
          onChange={(e) => cambiar('mecanico', e.target.value)}
          disabled={guardando}
          placeholder="Luis Chávez"
        />
        <Field
          label="Total"
          inputMode="numeric"
          value={datos.total}
          onChange={(e) => cambiar('total', e.target.value)}
          error={errores.total}
          ayuda="Poné 0 mientras no haya presupuesto."
          disabled={guardando}
          placeholder="185000"
        />
      </div>

      <Textarea
        label="Trabajo a realizar"
        value={datos.descripcion}
        onChange={(e) => cambiar('descripcion', e.target.value)}
        error={errores.descripcion}
        disabled={guardando}
        placeholder="Service completo: aceite, filtros y revisión de frenos."
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          {guardando ? 'Guardando…' : 'Guardar orden'}
        </Button>
      </div>
    </form>
  )
}
