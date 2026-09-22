import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import { validarVehiculo } from '@/utils/validation'

const VACIO = {
  cliente_id: '',
  patente: '',
  marca: '',
  modelo: '',
  anio: '',
  color: '',
  kilometraje: '',
  combustible: 'Nafta',
  observaciones: '',
}

const COMBUSTIBLES = ['Nafta', 'Diésel', 'GNC', 'Híbrido', 'Eléctrico']

export default function FormularioVehiculo({ vehiculo, clientes = [], onGuardar, onCancelar }) {
  const [datos, setDatos] = useState(() => ({ ...VACIO, ...vehiculo }))
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

    const encontrados = validarVehiculo(datos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    setGuardando(true)
    setErrorApi('')
    try {
      await onGuardar({
        cliente_id: datos.cliente_id,
        patente: datos.patente.trim(),
        marca: datos.marca.trim(),
        modelo: datos.modelo.trim(),
        anio: datos.anio,
        color: datos.color.trim(),
        kilometraje: datos.kilometraje,
        combustible: datos.combustible,
        observaciones: datos.observaciones.trim(),
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

      <Select
        label="Cliente"
        value={datos.cliente_id}
        onChange={(e) => cambiar('cliente_id', e.target.value)}
        error={errores.cliente_id}
        disabled={guardando}
        opciones={[
          { valor: '', texto: 'Elegí un cliente…' },
          ...clientes.map((cliente) => ({
            valor: cliente.id,
            texto: `${cliente.apellido}, ${cliente.nombre} — DNI ${cliente.dni}`,
          })),
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Patente"
          value={datos.patente}
          onChange={(e) => cambiar('patente', e.target.value.toUpperCase())}
          error={errores.patente}
          ayuda="Formato AAA123 o AA123AA"
          disabled={guardando}
          placeholder="AC482KL"
        />
        <Field
          label="Marca"
          value={datos.marca}
          onChange={(e) => cambiar('marca', e.target.value)}
          error={errores.marca}
          disabled={guardando}
          placeholder="Volkswagen"
        />
        <Field
          label="Modelo"
          value={datos.modelo}
          onChange={(e) => cambiar('modelo', e.target.value)}
          error={errores.modelo}
          disabled={guardando}
          placeholder="Gol Trend"
        />
        <Field
          label="Año"
          inputMode="numeric"
          value={datos.anio}
          onChange={(e) => cambiar('anio', e.target.value)}
          error={errores.anio}
          disabled={guardando}
          placeholder="2017"
        />
        <Field
          label="Kilometraje"
          inputMode="numeric"
          value={datos.kilometraje}
          onChange={(e) => cambiar('kilometraje', e.target.value)}
          error={errores.kilometraje}
          disabled={guardando}
          placeholder="98400"
        />
        <Field
          label="Color (opcional)"
          value={datos.color}
          onChange={(e) => cambiar('color', e.target.value)}
          disabled={guardando}
          placeholder="Gris"
        />
        <Select
          label="Combustible"
          className="sm:col-span-2"
          value={datos.combustible}
          onChange={(e) => cambiar('combustible', e.target.value)}
          disabled={guardando}
          opciones={COMBUSTIBLES.map((tipo) => ({ valor: tipo, texto: tipo }))}
        />
      </div>

      <Textarea
        label="Observaciones (opcional)"
        value={datos.observaciones}
        onChange={(e) => cambiar('observaciones', e.target.value)}
        disabled={guardando}
        placeholder="Ruido en tren delantero, pedidos del cliente, etc."
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          {guardando ? 'Guardando…' : 'Guardar vehículo'}
        </Button>
      </div>
    </form>
  )
}
