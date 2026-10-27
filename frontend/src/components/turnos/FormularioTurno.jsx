import { useMemo, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Autocomplete from '@/components/ui/Autocomplete'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import { ESTADOS_TURNO, HORARIOS } from '@/services/turnos'
import { validarTurno } from '@/utils/validation'

const ETIQUETAS_ESTADO = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  en_taller: 'En el taller',
  completado: 'Completado',
  cancelado: 'Cancelado',
}

export default function FormularioTurno({
  turno,
  esEdicion = false,
  clientes = [],
  vehiculos = [],
  turnos = [],
  fechaSugerida,
  onGuardar,
  onCancelar,
}) {
  const [datos, setDatos] = useState(() => ({
    cliente_id: '',
    vehiculo_id: '',
    fecha: fechaSugerida ?? new Date().toISOString().slice(0, 10),
    hora: '',
    servicio: '',
    estado: 'pendiente',
    notas: '',
    ...turno,
  }))
  const [errores, setErrores] = useState({})
  const [errorApi, setErrorApi] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [textoCliente, setTextoCliente] = useState(() => {
    const cliente = clientes.find((item) => item.id === Number(datos.cliente_id))
    return cliente ? `${cliente.apellido}, ${cliente.nombre}` : ''
  })

  const opcionesCliente = useMemo(
    () =>
      clientes.map((cliente) => ({
        valor: cliente.id,
        texto: `${cliente.apellido}, ${cliente.nombre}`,
        detalle: cliente.telefono ? `Tel. ${cliente.telefono}` : undefined,
      })),
    [clientes],
  )

  const vehiculosDelCliente = useMemo(
    () => vehiculos.filter((v) => v.cliente_id === Number(datos.cliente_id)),
    [vehiculos, datos.cliente_id],
  )

  const ocupados = useMemo(
    () =>
      new Set(
        turnos
          .filter(
            (t) => t.fecha === datos.fecha && t.estado !== 'cancelado' && t.id !== turno?.id,
          )
          .map((t) => t.hora),
      ),
    [turnos, datos.fecha, turno?.id],
  )

  function cambiar(campo, valor) {
    setDatos((previo) => {
      const proximo = { ...previo, [campo]: valor }
      if (campo === 'cliente_id') proximo.vehiculo_id = ''
      return proximo
    })
    if (errores[campo]) setErrores((previo) => ({ ...previo, [campo]: undefined }))
    if (errorApi) setErrorApi('')
  }

  async function enviar(evento) {
    evento.preventDefault()

    const encontrados = validarTurno(datos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    setGuardando(true)
    setErrorApi('')
    try {
      await onGuardar({
        cliente_id: datos.cliente_id,
        vehiculo_id: datos.vehiculo_id,
        fecha: datos.fecha,
        hora: datos.hora,
        servicio: datos.servicio.trim(),
        estado: datos.estado,
        notas: datos.notas.trim(),
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
          onChange={(texto) => {
            setTextoCliente(texto)
            if (datos.cliente_id) cambiar('cliente_id', '')
          }}
          onElegir={(opcion) => cambiar('cliente_id', opcion.valor)}
          opciones={opcionesCliente}
          error={errores.cliente_id}
          disabled={guardando}
          placeholder="Buscá por apellido o nombre"
          sinResultados="No hay clientes con ese nombre."
        />
        <Select
          label="Vehículo"
          value={datos.vehiculo_id}
          onChange={(e) => cambiar('vehiculo_id', e.target.value)}
          error={errores.vehiculo_id}
          disabled={guardando || !datos.cliente_id}
          ayuda={
            datos.cliente_id && vehiculosDelCliente.length === 0
              ? 'Este cliente todavía no tiene vehículos cargados.'
              : undefined
          }
          opciones={[
            { valor: '', texto: 'Elegí un vehículo…' },
            ...vehiculosDelCliente.map((vehiculo) => ({
              valor: vehiculo.id,
              texto: `${vehiculo.patente} — ${vehiculo.marca} ${vehiculo.modelo}`,
            })),
          ]}
        />
        <Field
          label="Fecha"
          type="date"
          min={new Date().toISOString().slice(0, 10)}
          value={datos.fecha}
          onChange={(e) => cambiar('fecha', e.target.value)}
          error={errores.fecha}
          disabled={guardando}
        />
        <Select
          label="Horario"
          value={datos.hora}
          onChange={(e) => cambiar('hora', e.target.value)}
          error={errores.hora}
          disabled={guardando}
          ayuda="Los horarios ocupados no se pueden elegir."
          opciones={[
            { valor: '', texto: 'Elegí un horario…' },
            ...HORARIOS.filter((hora) => !ocupados.has(hora) || hora === datos.hora).map(
              (hora) => ({ valor: hora, texto: hora }),
            ),
          ]}
        />
      </div>

      <Field
        label="Servicio"
        value={datos.servicio}
        onChange={(e) => cambiar('servicio', e.target.value)}
        error={errores.servicio}
        disabled={guardando}
        placeholder="Service de 60.000 km"
      />

      {esEdicion && (
        <Select
          label="Estado"
          value={datos.estado}
          onChange={(e) => cambiar('estado', e.target.value)}
          disabled={guardando}
          opciones={ESTADOS_TURNO.map((estado) => ({
            valor: estado,
            texto: ETIQUETAS_ESTADO[estado],
          }))}
        />
      )}

      <Textarea
        label="Notas (opcional)"
        value={datos.notas}
        onChange={(e) => cambiar('notas', e.target.value)}
        disabled={guardando}
        placeholder="El cliente deja el vehículo a primera hora."
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          {guardando ? 'Guardando…' : 'Guardar turno'}
        </Button>
      </div>
    </form>
  )
}

export { ETIQUETAS_ESTADO }
