import { useCallback, useMemo, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Autocomplete from '@/components/ui/Autocomplete'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Textarea from '@/components/ui/Textarea'
import { useAuth } from '@/context/AuthContext'
import { catalogoService } from '@/services/catalogo'
import { validarVehiculo } from '@/utils/validation'

const VACIO = {
  cliente_id: '',
  patente: '',
  marca: '',
  modelo: '',
  anio: '',
  color: '',
  vin: '',
  observaciones: '',
}

export default function FormularioVehiculo({ vehiculo, clientes = [], onGuardar, onCancelar }) {
  const { token } = useAuth()
  const [datos, setDatos] = useState(() =>
    Object.fromEntries(
      Object.keys(VACIO).map((campo) => [campo, String(vehiculo?.[campo] ?? VACIO[campo])]),
    ),
  )
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
        valor: String(cliente.id),
        texto: `${cliente.apellido}, ${cliente.nombre}`,
        detalle: `DNI ${cliente.dni}`,
      })),
    [clientes],
  )

  const buscarMarcas = useCallback((texto) => catalogoService.marcas(texto, token), [token])
  const buscarModelos = useCallback(
    (texto) => catalogoService.modelos(datos.marca, texto, token),
    [datos.marca, token],
  )

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
        vin: datos.vin.trim(),
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
        placeholder="Buscá por apellido o DNI"
        sinResultados="No hay clientes con ese nombre o DNI."
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
        <Autocomplete
          label="Marca"
          value={datos.marca}
          onChange={(valor) => cambiar('marca', valor)}
          buscar={buscarMarcas}
          error={errores.marca}
          disabled={guardando}
          placeholder="Volkswagen"
          sinResultados="No está en el catálogo, podés escribirla igual."
        />
        <Autocomplete
          label="Modelo"
          value={datos.modelo}
          onChange={(valor) => cambiar('modelo', valor)}
          buscar={buscarModelos}
          error={errores.modelo}
          disabled={guardando}
          placeholder="Gol Trend"
          sinResultados="No está en el catálogo, podés escribirlo igual."
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
          label="Color (opcional)"
          value={datos.color}
          onChange={(e) => cambiar('color', e.target.value)}
          disabled={guardando}
          placeholder="Gris"
        />
        <Field
          label="VIN / chasis (opcional)"
          className="sm:col-span-2"
          value={datos.vin}
          onChange={(e) => cambiar('vin', e.target.value.toUpperCase())}
          disabled={guardando}
          placeholder="9BWZZZ377VT004251"
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
