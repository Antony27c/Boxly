import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { catalogoService } from '@/services/catalogo'
import { clientesService } from '@/services/clientes'
import { mecanicosService } from '@/services/mecanicos'
import { nombrePersona, normalizarPatente } from './formato'
import { avanceVacio, mensajeParcial, registrarIngreso } from './registrarIngreso'
import usePatenteIngreso from './usePatenteIngreso'
import { validarIngreso } from './validarIngreso'

const CLIENTE_VACIO = { nombre: '', apellido: '', dni: '', telefono: '' }
const VEHICULO_VACIO = { marca: '', modelo: '', anio: '' }
const ERRORES_CLIENTE = ['cliente', 'clienteNombre', 'clienteApellido', 'clienteDni', 'clienteTelefono']

/**
 * Estado y llamadas del ingreso rápido: la patente (en `usePatenteIngreso`),
 * el cliente y el vehículo nuevos, el trabajo y el envío final.
 */
export default function useIngresoRapido({ abierto, inicial, onCerrar, onListo }) {
  const { token } = useAuth()
  const { avisar } = useToast()
  const navigate = useNavigate()

  const inicialRef = useRef(inicial)
  // El ref se sincroniza en un efecto para que el de carga de abajo
  // (declarado después) ya lea el `inicial` del render actual.
  useEffect(() => {
    inicialRef.current = inicial
  })
  const avance = useRef(avanceVacio())
  const cacheClientes = useRef(new Map())

  const [errores, setErrores] = useState({})
  const [errorApi, setErrorApi] = useState('')
  const [guardando, setGuardando] = useState(false)

  const limpiarErrores = useCallback((...claves) => {
    setErrores((previo) =>
      claves.some((clave) => previo[clave])
        ? { ...previo, ...Object.fromEntries(claves.map((clave) => [clave, undefined])) }
        : previo,
    )
  }, [])

  const patente = usePatenteIngreso({
    abierto,
    inicial,
    token,
    limpiarError: () => limpiarErrores('patente'),
  })
  const { cargarVehiculoTurno } = patente

  const [clienteModo, setClienteModo] = useState('buscar') // buscar | nuevo
  const [textoCliente, setTextoCliente] = useState('')
  const [clienteElegido, setClienteElegido] = useState(null)
  const [clienteForm, setClienteForm] = useState(CLIENTE_VACIO)
  const [vehiculoForm, setVehiculoForm] = useState(VEHICULO_VACIO)
  const [trabajo, setTrabajo] = useState('')
  const [mecanicoId, setMecanicoId] = useState('')
  const [entrega, setEntrega] = useState('')
  const [mecanicos, setMecanicos] = useState([])

  // Cada apertura arranca limpio y precarga lo que venga en `inicial`.
  // Es el patrón "ajustar estado durante el render" (como en Ordenes):
  // los setState van acá y las cargas de red en el efecto de abajo.
  const [previoAbierto, setPrevioAbierto] = useState(false)
  if (abierto !== previoAbierto) {
    setPrevioAbierto(abierto)
    if (abierto) {
      setClienteModo('buscar')
      setTextoCliente('')
      setClienteElegido(null)
      setClienteForm(CLIENTE_VACIO)
      setVehiculoForm(VEHICULO_VACIO)
      setTrabajo(inicial?.motivo ?? '')
      setMecanicoId(inicial?.mecanicoId ? String(inicial.mecanicoId) : '')
      setEntrega('')
      setErrores({})
      setErrorApi('')
      setGuardando(false)
    }
  }

  useEffect(() => {
    if (!abierto) return
    avance.current = avanceVacio()
    cacheClientes.current = new Map()

    mecanicosService
      .listar(token)
      .then(setMecanicos)
      .catch(() => setMecanicos([]))

    const inic = inicialRef.current
    if (inic?.vehiculoId) {
      cargarVehiculoTurno(inic.vehiculoId).catch((problema) =>
        setErrorApi(`No pudimos cargar el vehículo del turno: ${problema.message}`),
      )
    } else if (inic?.clienteId) {
      clientesService
        .obtener(inic.clienteId, token)
        .then(setClienteElegido)
        .catch(() => {})
    }
  }, [abierto, token, cargarVehiculoTurno])

  const buscarClientes = useCallback(
    async (texto) => {
      const { items } = await clientesService.listarPaginado({ q: texto, limit: 8 }, token)
      return (items ?? []).map((cliente) => {
        cacheClientes.current.set(cliente.id, cliente)
        return {
          valor: cliente.id,
          texto: nombrePersona(cliente),
          detalle: cliente.dni ? `DNI ${cliente.dni}` : undefined,
        }
      })
    },
    [token],
  )

  function elegirCliente(opcion) {
    const encontrado = cacheClientes.current.get(Number(opcion.valor))
    setClienteElegido(
      encontrado ?? {
        id: Number(opcion.valor),
        nombre: opcion.texto,
        dni: opcion.detalle?.replace(/^DNI\s*/, '') || undefined,
      },
    )
    setTextoCliente('')
    limpiarErrores(...ERRORES_CLIENTE)
  }

  function limpiarCliente() {
    setClienteElegido(null)
    setClienteModo('buscar')
    setTextoCliente('')
    limpiarErrores(...ERRORES_CLIENTE)
  }

  function cambiarClienteForm(campo, valor) {
    setClienteForm((previo) => ({ ...previo, [campo]: valor }))
    limpiarErrores(`cliente${campo[0].toUpperCase()}${campo.slice(1)}`)
  }

  const buscarMarcas = useCallback((texto) => catalogoService.marcas(texto, token), [token])
  const buscarModelos = useCallback(
    (texto) => catalogoService.modelos(vehiculoForm.marca, texto, token),
    [vehiculoForm.marca, token],
  )

  function cambiarVehiculoForm(campo, valor) {
    setVehiculoForm((previo) => ({ ...previo, [campo]: valor }))
    limpiarErrores(campo)
  }

  function cambiarTrabajo(valor) {
    setTrabajo(valor)
    limpiarErrores('trabajo')
  }

  function agregarChip(texto) {
    setTrabajo((previo) => {
      const actual = previo.trim()
      if (!actual) return texto
      if (actual.toLowerCase().includes(texto.toLowerCase())) return previo
      return `${actual}, ${texto}`
    })
    limpiarErrores('trabajo')
  }

  async function recibirAuto() {
    const { vehiculo, busqueda, errorBusqueda } = patente
    const encontrados = validarIngreso({
      patente: patente.patente,
      vehiculo,
      busqueda,
      errorBusqueda,
      trabajo,
      clienteElegido,
      clienteModo,
      clienteForm,
      vehiculoForm,
    })
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    setGuardando(true)
    setErrorApi('')
    try {
      const orden = await registrarIngreso(
        avance.current,
        {
          vehiculo,
          clienteElegido,
          clienteForm,
          vehiculoForm,
          patente: patente.patente,
          mecanicoId,
          trabajo,
          entrega,
          turno: inicialRef.current?.turno,
        },
        token,
      )
      const chapa = vehiculo?.patente ?? normalizarPatente(patente.patente)
      avisar(`Auto ${chapa} recibido en el taller.`, {
        accion: { texto: 'Ver orden', onClick: () => navigate(`/ordenes/${orden.id}`) },
      })
      onListo?.(orden)
      onCerrar?.()
    } catch (problema) {
      setErrorApi(mensajeParcial(avance.current, problema))
    } finally {
      setGuardando(false)
    }
  }

  const esPatenteNueva = !patente.vehiculo && patente.busqueda === 'nueva'

  return {
    patente,
    esPatenteNueva,
    mostrarTrabajo: Boolean(patente.vehiculo) || esPatenteNueva,
    cliente: {
      modo: clienteModo,
      setModo: setClienteModo,
      texto: textoCliente,
      setTexto: setTextoCliente,
      elegido: clienteElegido,
      form: clienteForm,
      cambiarForm: cambiarClienteForm,
      elegir: elegirCliente,
      limpiar: limpiarCliente,
      buscar: buscarClientes,
    },
    vehiculoNuevo: {
      form: vehiculoForm,
      cambiar: cambiarVehiculoForm,
      buscarMarcas,
      buscarModelos,
    },
    trabajo: {
      texto: trabajo,
      cambiar: cambiarTrabajo,
      agregarChip,
      mecanicoId,
      setMecanicoId,
      entrega,
      setEntrega,
      mecanicos,
    },
    errores,
    errorApi,
    guardando,
    recibirAuto,
  }
}
