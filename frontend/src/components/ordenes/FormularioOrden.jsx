import { useMemo, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Autocomplete from '@/components/ui/Autocomplete'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import { estadosPermitidos } from '@/services/ordenes'
import { validarOrden } from '@/utils/validation'

const HOY = new Date().toISOString().slice(0, 10)

function nombreCliente(cliente) {
  return cliente ? `${cliente.apellido}, ${cliente.nombre}` : ''
}

function nombreVehiculo(vehiculo) {
  return vehiculo ? `${vehiculo.patente} — ${vehiculo.marca} ${vehiculo.modelo}` : ''
}

const VACIO = {
  cliente_id: '',
  vehiculo_id: '',
  fecha: HOY,
  estado: 'Pendiente',
  descripcion: '',
  mecanico_id: '',
  total: '0',
}

export default function FormularioOrden({
  orden,
  clientes = [],
  vehiculos = [],
  mecanicos,
  onGuardar,
  onCancelar,
}) {
  const [datos, setDatos] = useState(() => {
    if (!orden) return VACIO
    const vehiculo = vehiculos.find((item) => item.id === orden.vehiculo_id)
    return {
      ...VACIO,
      ...orden,
      cliente_id: vehiculo?.cliente_id ?? '',
      mecanico_id: orden.mecanico_id ?? '',
      total: String(orden.total ?? 0),
    }
  })

  const opcionesMecanico = useMemo(() => {
    const opciones = (mecanicos ?? []).map((m) => ({ valor: m.id, texto: `${m.apellido}, ${m.nombre}` }))
    if (orden?.mecanico_id && !opciones.some((o) => o.valor === orden.mecanico_id)) {
      opciones.push({ valor: orden.mecanico_id, texto: `${orden.mecanico || 'Mecánico asignado'} (inactivo)` })
    }
    return opciones
  }, [mecanicos, orden])
  const [errores, setErrores] = useState({})
  const [errorApi, setErrorApi] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [textoCliente, setTextoCliente] = useState(() =>
    nombreCliente(clientes.find((item) => item.id === Number(datos.cliente_id))),
  )
  const [textoVehiculo, setTextoVehiculo] = useState(() =>
    nombreVehiculo(vehiculos.find((item) => item.id === Number(datos.vehiculo_id))),
  )

  const opcionesCliente = useMemo(
    () =>
      clientes.map((cliente) => ({
        valor: cliente.id,
        texto: nombreCliente(cliente),
        detalle: cliente.dni ? `DNI ${cliente.dni}` : undefined,
      })),
    [clientes],
  )

  const vehiculosDelCliente = useMemo(() => {
    if (!datos.cliente_id) return vehiculos
    return vehiculos.filter((item) => item.cliente_id === Number(datos.cliente_id))
  }, [vehiculos, datos.cliente_id])

  const opcionesVehiculo = useMemo(
    () =>
      vehiculosDelCliente.map((vehiculo) => ({
        valor: vehiculo.id,
        texto: nombreVehiculo(vehiculo),
        detalle: nombreCliente(clientes.find((item) => item.id === vehiculo.cliente_id)),
      })),
    [vehiculosDelCliente, clientes],
  )

  function escribirCliente(texto) {
    setTextoCliente(texto)
    if (datos.cliente_id) {
      cambiar('cliente_id', '')
      setTextoVehiculo('')
    }
  }

  function elegirCliente(opcion) {
    cambiar('cliente_id', opcion.valor)
    setTextoVehiculo('')
  }

  function escribirVehiculo(texto) {
    setTextoVehiculo(texto)
    if (datos.vehiculo_id) cambiar('vehiculo_id', '')
  }

  function elegirVehiculo(opcion) {
    const vehiculo = vehiculos.find((item) => item.id === opcion.valor)
    if (!datos.cliente_id && vehiculo) {
      setTextoCliente(nombreCliente(clientes.find((item) => item.id === vehiculo.cliente_id)))
      setDatos((previo) => ({ ...previo, cliente_id: vehiculo.cliente_id }))
    }
    cambiar('vehiculo_id', opcion.valor)
  }

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
        estado: datos.estado,
        mecanico_id: datos.mecanico_id,
        descripcion: datos.descripcion.trim(),
        total: datos.total,
        costo_final: orden?.costo_final ?? null,
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
        <Autocomplete
          label="Cliente"
          value={textoCliente}
          onChange={escribirCliente}
          onElegir={elegirCliente}
          opciones={opcionesCliente}
          disabled={guardando || Boolean(orden)}
          placeholder="Buscá por apellido o DNI"
          sinResultados="No hay clientes con ese nombre."
        />
        <Autocomplete
          label="Vehículo"
          value={textoVehiculo}
          onChange={escribirVehiculo}
          onElegir={elegirVehiculo}
          opciones={opcionesVehiculo}
          error={errores.vehiculo_id}
          disabled={guardando || Boolean(orden)}
          placeholder="Buscá por patente o modelo"
          sinResultados="No hay vehículos que coincidan."
        />
        {orden && (
          <>
            <Field label="Fecha de ingreso" type="date" value={datos.fecha} disabled />
            <Select
              label="Estado"
              value={datos.estado}
              onChange={(e) => cambiar('estado', e.target.value)}
              error={errores.estado}
              disabled={guardando}
              opciones={estadosPermitidos(orden.estado).map((estado) => ({
                valor: estado,
                texto: estado,
              }))}
            />
          </>
        )}
        {mecanicos && (
          <Select
            label="Mecánico asignado"
            value={datos.mecanico_id}
            onChange={(e) => cambiar('mecanico_id', e.target.value)}
            disabled={guardando}
            opciones={[
              ...(orden?.mecanico_id ? [] : [{ valor: '', texto: 'Sin asignar' }]),
              ...opcionesMecanico,
            ]}
          />
        )}
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
