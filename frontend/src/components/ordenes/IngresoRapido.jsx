import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Autocomplete from '@/components/ui/Autocomplete'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { api } from '@/lib/api'
import { clientesService } from '@/services/clientes'
import { catalogoService } from '@/services/catalogo'
import { mecanicosService } from '@/services/mecanicos'
import { ordenesService } from '@/services/ordenes'
import { turnosService } from '@/services/turnos'
import { vehiculosService } from '@/services/vehiculos'
import { aISO } from '@/utils/fechas'

const PATENTE = /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/
const COMENTARIO_INGRESO = 'Auto recibido en el taller.'
const SUGERENCIAS_TRABAJO = [
  'Service',
  'Frenos',
  'Ruido en tren delantero',
  'No arranca',
  'Revisión general',
]

function normalizarPatente(texto) {
  return String(texto ?? '')
    .toUpperCase()
    .replace(/[\s-]/g, '')
}

function normalizarNombre(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function nombrePersona(persona) {
  if (!persona) return ''
  return [persona.apellido, persona.nombre].filter(Boolean).join(', ')
}

function detalleVehiculo(vehiculo) {
  const base = `${vehiculo.marca ?? ''} ${vehiculo.modelo ?? ''}`.trim()
  return [base, vehiculo.anio].filter(Boolean).join(' · ')
}

function EncabezadoPaso({ numero, texto }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber/15 text-xs font-bold text-amber-texto">
        {numero}
      </span>
      {texto}
    </h3>
  )
}

/**
 * Ingreso rápido de un auto por patente, con o sin turno.
 * Abre desde "Nueva orden", Hoy y Turnos. `inicial` puede traer
 * { turno, vehiculoId, clienteId, mecanicoId, motivo } precargados.
 */
export default function IngresoRapido({ abierto, onCerrar, onListo, inicial }) {
  const { token } = useAuth()
  const { avisar } = useToast()
  const navigate = useNavigate()
  const hoy = aISO(new Date())

  const inicialRef = useRef(inicial)
  // El ref se sincroniza en un efecto para que el de carga de abajo
  // (declarado después) ya lea el `inicial` del render actual.
  useEffect(() => {
    inicialRef.current = inicial
  })
  // Ids de lo ya creado en el servidor: si algo falla a mitad de camino,
  // el reintento no vuelve a crear cliente/vehículo/orden.
  const avance = useRef({
    clienteId: null,
    vehiculoId: null,
    orden: null,
    estadoOk: false,
    fechaOk: false,
    turnoOk: false,
  })
  const consultaPatente = useRef(0)
  const cacheClientes = useRef(new Map())
  // Patente confirmada como "nueva" desde una sugerencia: frena la búsqueda
  // automática para que no vuelva a preguntar por la misma chapa.
  const placaNueva = useRef('')

  const [patente, setPatente] = useState('')
  const [vehiculo, setVehiculo] = useState(null)
  const [titular, setTitular] = useState(null)
  const [busqueda, setBusqueda] = useState('ociosa') // ociosa | buscando | encontrada | nueva | error
  const [errorBusqueda, setErrorBusqueda] = useState('')
  const [vehiculosBase, setVehiculosBase] = useState([])
  const [clientesBase, setClientesBase] = useState([])
  const [catalogosListos, setCatalogosListos] = useState(false)

  const [clienteModo, setClienteModo] = useState('buscar') // buscar | nuevo
  const [textoCliente, setTextoCliente] = useState('')
  const [clienteElegido, setClienteElegido] = useState(null)
  const [clienteForm, setClienteForm] = useState({ nombre: '', apellido: '', dni: '', telefono: '' })

  const [vehiculoForm, setVehiculoForm] = useState({ marca: '', modelo: '', anio: '' })

  const [trabajo, setTrabajo] = useState('')
  const [mecanicoId, setMecanicoId] = useState('')
  const [entrega, setEntrega] = useState('')
  const [mecanicos, setMecanicos] = useState([])

  const [errores, setErrores] = useState({})
  const [errorApi, setErrorApi] = useState('')
  const [guardando, setGuardando] = useState(false)
  // true solo mientras viaja la carga inicial del vehículo del turno:
  // bloquea la patente para que una búsqueda a mano no pise ese resultado.
  const [cargandoVehiculoTurno, setCargandoVehiculoTurno] = useState(false)

  // Cada apertura arranca limpio y precarga lo que venga en `inicial`.
  // Es el patrón "ajustar estado durante el render" (como en Ordenes):
  // los setState van acá y las cargas de red en el efecto de abajo.
  const [previoAbierto, setPrevioAbierto] = useState(false)
  if (abierto !== previoAbierto) {
    setPrevioAbierto(abierto)
    if (abierto) {
      const inic = inicial
      setPatente('')
      setVehiculo(null)
      setTitular(null)
      setBusqueda('ociosa')
      setErrorBusqueda('')
      setVehiculosBase([])
      setClientesBase([])
      setCatalogosListos(false)
      setClienteModo('buscar')
      setTextoCliente('')
      setClienteElegido(null)
      setClienteForm({ nombre: '', apellido: '', dni: '', telefono: '' })
      setVehiculoForm({ marca: '', modelo: '', anio: '' })
      setTrabajo(inic?.motivo ?? '')
      setMecanicoId(inic?.mecanicoId ? String(inic.mecanicoId) : '')
      setEntrega('')
      setErrores({})
      setErrorApi('')
      setGuardando(false)
      setCargandoVehiculoTurno(Boolean(inic?.vehiculoId))
    }
  }

  useEffect(() => {
    if (!abierto) return
    avance.current = {
      clienteId: null,
      vehiculoId: null,
      orden: null,
      estadoOk: false,
      fechaOk: false,
      turnoOk: false,
    }
    cacheClientes.current = new Map()
    placaNueva.current = ''

    mecanicosService
      .listar(token)
      .then(setMecanicos)
      .catch(() => setMecanicos([]))

    // Listas para las sugerencias de patente: se filtran en el cliente,
    // sin pedir un endpoint nuevo. `catalogosListos` evita ofrecer
    // "patente nueva" antes de saber qué autos ya existen.
    let pendientes = 2
    const listo = () => {
      pendientes -= 1
      if (pendientes === 0) setCatalogosListos(true)
    }
    Promise.resolve()
      .then(() => vehiculosService.listar(token))
      .then((lista) => setVehiculosBase(Array.isArray(lista) ? lista : []))
      .catch(() => setVehiculosBase([]))
      .finally(listo)
    Promise.resolve()
      .then(() => clientesService.listar(token))
      .then((lista) => setClientesBase(Array.isArray(lista) ? lista : []))
      .catch(() => setClientesBase([]))
      .finally(listo)

    const inic = inicialRef.current
    if (inic?.vehiculoId) {
      vehiculosService
        .obtener(inic.vehiculoId, token)
        .then(async (encontrado) => {
          setVehiculo(encontrado)
          setPatente(encontrado.patente ?? '')
          setBusqueda('encontrada')
          try {
            setTitular(await clientesService.obtener(encontrado.cliente_id, token))
          } catch {
            setTitular(null)
          }
        })
        .catch((problema) =>
          setErrorApi(`No pudimos cargar el vehículo del turno: ${problema.message}`),
        )
        .finally(() => setCargandoVehiculoTurno(false))
    } else if (inic?.clienteId) {
      clientesService
        .obtener(inic.clienteId, token)
        .then(setClienteElegido)
        .catch(() => {})
    }
  }, [abierto, token])

  const buscar = useCallback(
    async (limpia) => {
      const numero = ++consultaPatente.current
      setBusqueda('buscando')
      setErrorBusqueda('')
      try {
        const params = new URLSearchParams({ q: limpia, limit: '10' })
        const lista = await api.get(`/api/v1/vehiculos?${params}`, token)
        if (numero !== consultaPatente.current) return
        const exacto =
          (lista ?? []).find((v) => normalizarPatente(v.patente) === limpia) ?? null
        if (exacto) {
          setVehiculo(exacto)
          setTitular(null)
          setBusqueda('encontrada')
          clientesService
            .obtener(exacto.cliente_id, token)
            .then((c) => {
              if (consultaPatente.current === numero) setTitular(c)
            })
            .catch(() => {})
        } else {
          setVehiculo(null)
          setTitular(null)
          setBusqueda('nueva')
        }
      } catch (problema) {
        if (numero !== consultaPatente.current) return
        setVehiculo(null)
        setTitular(null)
        setBusqueda('error')
        setErrorBusqueda(problema.message)
      }
    },
    [token],
  )

  // Sugerencias de la patente, armadas en el cliente con los autos y
  // clientes ya cargados (máximo 6). Coinciden por patente (sin espacios
  // ni guiones), marca, modelo o apellido/nombre del cliente (sin tildes).
  // Si nada coincide y la chapa tiene formato válido, se ofrece cargarla
  // como patente nueva.
  const mapaClientes = useMemo(
    () => new Map((clientesBase ?? []).map((cliente) => [Number(cliente.id), cliente])),
    [clientesBase],
  )

  const opcionesPatente = useMemo(() => {
    const limpia = normalizarPatente(patente)
    if (!catalogosListos || limpia.length < 2) return []
    const texto = normalizarNombre(limpia)
    const hallados = []
    for (const vehiculoBase of vehiculosBase ?? []) {
      if (!vehiculoBase?.patente) continue
      const placa = normalizarPatente(vehiculoBase.patente)
      const cliente = mapaClientes.get(Number(vehiculoBase.cliente_id))
      const nombre = normalizarNombre(
        `${vehiculoBase.marca ?? ''} ${vehiculoBase.modelo ?? ''} ${vehiculoBase.anio ?? ''} ${nombrePersona(cliente)}`,
      )
      const porPlaca = placa.includes(limpia)
      const porNombre = nombre.includes(texto)
      if (!porPlaca && !porNombre) continue
      // Primero la patente exacta, después la que la contiene y al
      // final las coincidencias por nombre/modelo.
      const puntaje = placa === limpia ? 0 : porPlaca ? 1 : 2
      hallados.push({ vehiculoBase, placa, cliente, puntaje })
    }
    hallados.sort((a, b) => a.puntaje - b.puntaje)
    const opciones = hallados.slice(0, 6).map(({ vehiculoBase, placa, cliente }) => ({
      valor: vehiculoBase.id,
      texto: placa,
      detalle: [detalleVehiculo(vehiculoBase), nombrePersona(cliente)]
        .filter(Boolean)
        .join(' · '),
      vehiculo: vehiculoBase,
    }))
    if (opciones.length === 0 && PATENTE.test(limpia)) {
      opciones.push({
        valor: '__patente_nueva__',
        texto: `Patente nueva: ${limpia} — cargar auto y cliente`,
        patente: limpia,
      })
    }
    return opciones
  }, [catalogosListos, patente, vehiculosBase, mapaClientes])

  function seleccionarVehiculo(encontrado) {
    const numero = ++consultaPatente.current
    setVehiculo(encontrado)
    setTitular(null)
    setBusqueda('encontrada')
    setErrorBusqueda('')
    clientesService
      .obtener(encontrado.cliente_id, token)
      .then((c) => {
        if (consultaPatente.current === numero) setTitular(c)
      })
      .catch(() => {})
  }

  function elegirSugerenciaPatente(opcion) {
    if (opcion.valor === '__patente_nueva__') {
      const limpia = opcion.patente ?? normalizarPatente(opcion.texto)
      placaNueva.current = limpia
      consultaPatente.current += 1
      setPatente(limpia)
      setVehiculo(null)
      setTitular(null)
      setBusqueda('nueva')
      setErrorBusqueda('')
      return
    }
    const encontrado =
      opcion.vehiculo ??
      vehiculosBase.find((v) => Number(v.id) === Number(opcion.valor))
    if (encontrado) seleccionarVehiculo(encontrado)
  }

  function alCambiarPatente(valor) {
    const limpio = normalizarPatente(valor)
    placaNueva.current = ''
    consultaPatente.current += 1
    setPatente(limpio)
    setErrorBusqueda('')
    if (errores.patente) {
      setErrores((previo) => ({ ...previo, patente: undefined }))
    }
    if (!PATENTE.test(limpio)) {
      setBusqueda('ociosa')
    }
  }

  // Al salir del campo con un valor escrito pero inválido recién ahí
  // aparece el error de formato; vacío o válido no muestran nada.
  function alSalirPatente() {
    const limpio = normalizarPatente(patente)
    if (limpio && !PATENTE.test(limpio)) {
      setErrorBusqueda('Formato válido: AAA123 o AA123AA.')
    }
  }

  // Al escribir la patente se busca sola (debounce ~300ms); `vehiculo`
  // elegido frena la búsqueda. El estado 'ociosa' lo deja alCambiarPatente
  // cuando el texto deja de tener formato válido.
  useEffect(() => {
    if (!abierto || vehiculo) return
    const limpia = normalizarPatente(patente)
    if (!PATENTE.test(limpia) || placaNueva.current === limpia) return
    const temporizador = setTimeout(() => {
      // La persona pudo elegir "patente nueva" después de agendarse
      // esta búsqueda: en ese caso no hay nada que buscar.
      if (placaNueva.current !== limpia) buscar(limpia)
    }, 300)
    return () => clearTimeout(temporizador)
  }, [abierto, patente, vehiculo, buscar])

  function buscarAhora() {
    const limpia = normalizarPatente(patente)
    if (!limpia) {
      setErrorBusqueda('Escribí la patente.')
      return
    }
    if (!PATENTE.test(limpia)) {
      setBusqueda('error')
      setErrorBusqueda('Formato válido: AAA123 o AA123AA.')
      return
    }
    buscar(limpia)
  }

  function cambiarVehiculo() {
    placaNueva.current = ''
    setVehiculo(null)
    setTitular(null)
    setPatente('')
    setBusqueda('ociosa')
    setErrorBusqueda('')
  }

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
    limpiarErroresCliente()
  }

  function limpiarCliente() {
    setClienteElegido(null)
    setClienteModo('buscar')
    setTextoCliente('')
    limpiarErroresCliente()
  }

  function limpiarErroresCliente() {
    setErrores((previo) => ({
      ...previo,
      cliente: undefined,
      clienteNombre: undefined,
      clienteApellido: undefined,
      clienteDni: undefined,
      clienteTelefono: undefined,
    }))
  }

  const buscarMarcas = useCallback((texto) => catalogoService.marcas(texto, token), [token])
  const buscarModelos = useCallback(
    (texto) => catalogoService.modelos(vehiculoForm.marca, texto, token),
    [vehiculoForm.marca, token],
  )

  function cambiarVehiculoForm(campo, valor) {
    setVehiculoForm((previo) => ({ ...previo, [campo]: valor }))
    if (errores[campo]) setErrores((previo) => ({ ...previo, [campo]: undefined }))
  }

  function cambiarClienteForm(campo, valor) {
    setClienteForm((previo) => ({ ...previo, [campo]: valor }))
    const clave = `cliente${campo[0].toUpperCase()}${campo.slice(1)}`
    if (errores[clave]) setErrores((previo) => ({ ...previo, [clave]: undefined }))
  }

  function agregarChip(texto) {
    setTrabajo((previo) => {
      const actual = previo.trim()
      if (!actual) return texto
      if (actual.toLowerCase().includes(texto.toLowerCase())) return previo
      return `${actual}, ${texto}`
    })
    if (errores.trabajo) setErrores((previo) => ({ ...previo, trabajo: undefined }))
  }

  function validar() {
    const encontrados = {}
    const limpia = normalizarPatente(patente)
    if (!limpia) {
      encontrados.patente = 'Escribí la patente.'
    } else if (!PATENTE.test(limpia)) {
      encontrados.patente = 'Formato válido: AAA123 o AA123AA.'
    } else if (!vehiculo && busqueda === 'error') {
      encontrados.patente = errorBusqueda || 'No pudimos buscar la patente. Reintentá.'
    } else if (!vehiculo && (busqueda === 'buscando' || busqueda === 'ociosa')) {
      // 'ociosa' con formato válido es la ventana del debounce de 300ms.
      encontrados.patente = 'Todavía estamos buscando la patente, esperá un segundo.'
    } else if (!vehiculo && busqueda !== 'nueva') {
      encontrados.patente = 'Buscá la patente para encontrar el auto.'
    }
    if (trabajo.trim().length < 5) {
      encontrados.trabajo = 'Contanos qué trabajo hay que hacerle.'
    }
    if (!vehiculo && busqueda === 'nueva') {
      if (clienteElegido) {
        // Cliente existente: no hay nada que validar.
      } else if (clienteModo === 'nuevo') {
        if (clienteForm.nombre.trim().length < 2) {
          encontrados.clienteNombre = 'Ingresá el nombre.'
        }
        if (clienteForm.apellido.trim().length < 2) {
          encontrados.clienteApellido = 'Ingresá el apellido.'
        }
        const dni = clienteForm.dni.trim()
        if (dni.length < 6 || dni.length > 20) {
          encontrados.clienteDni = 'Ingresá el DNI (de 6 a 20 caracteres).'
        }
        const telefono = clienteForm.telefono.trim()
        if (telefono && !/^[\d\s()+-]{6,20}$/.test(telefono)) {
          encontrados.clienteTelefono = 'El teléfono no tiene un formato válido.'
        }
      } else {
        encontrados.cliente = 'Elegí un cliente de la lista o cargalo como nuevo.'
      }
      if (!vehiculoForm.marca.trim()) encontrados.marca = 'Ingresá la marca.'
      if (!vehiculoForm.modelo.trim()) encontrados.modelo = 'Ingresá el modelo.'
      const anio = vehiculoForm.anio.trim()
      if (anio && (!/^\d{4}$/.test(anio) || Number(anio) < 1900 || Number(anio) > 2100)) {
        encontrados.anio = 'Revisá el año (por ejemplo 2017).'
      }
    }
    return encontrados
  }

  function mensajeParcial(problema) {
    const a = avance.current
    const hechos = []
    if (a.clienteId) hechos.push('el cliente')
    if (a.vehiculoId) hechos.push('el vehículo')
    if (a.orden) hechos.push(`la orden${a.orden.codigo ? ` ${a.orden.codigo}` : ''}`)
    const prefijo = hechos.length ? `Ya se creó ${hechos.join(', ')}. ` : ''
    return `${prefijo}No se pudo terminar: ${problema.message} Podés reintentar, no se duplica lo ya creado.`
  }

  async function recibirAuto() {
    const encontrados = validar()
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    setGuardando(true)
    setErrorApi('')
    const a = avance.current
    const inic = inicialRef.current
    try {
      let clienteId = vehiculo?.cliente_id ?? clienteElegido?.id ?? a.clienteId ?? null
      if (clienteId == null) {
        const creado = await clientesService.crear(
          {
            nombre: clienteForm.nombre.trim(),
            apellido: clienteForm.apellido.trim(),
            dni: clienteForm.dni.trim(),
            telefono: clienteForm.telefono.trim(),
          },
          token,
        )
        clienteId = creado.id
        a.clienteId = creado.id
      }

      let vehiculoId = vehiculo?.id ?? a.vehiculoId ?? null
      if (vehiculoId == null) {
        const creado = await vehiculosService.crear(
          {
            cliente_id: clienteId,
            patente: normalizarPatente(patente),
            marca: vehiculoForm.marca.trim(),
            modelo: vehiculoForm.modelo.trim(),
            anio: vehiculoForm.anio.trim() || null,
          },
          token,
        )
        vehiculoId = creado.id
        a.vehiculoId = creado.id
      }

      let orden = a.orden
      if (!orden) {
        orden = await ordenesService.crear(
          {
            vehiculo_id: vehiculoId,
            mecanico_id: mecanicoId ? Number(mecanicoId) : null,
            descripcion: trabajo.trim(),
            total: 0,
          },
          token,
        )
        a.orden = orden
      }

      if (!a.estadoOk) {
        orden = await ordenesService.cambiarEstado(
          orden.id,
          'Ingresado',
          COMENTARIO_INGRESO,
          token,
        )
        a.estadoOk = true
      }

      // ordenesService no reenvía fecha_estimada_entrega: se actualiza aparte.
      if (entrega && !a.fechaOk) {
        await api.patch(
          `/api/v1/ordenes/${orden.id}`,
          { fecha_estimada_entrega: `${entrega}T12:00:00` },
          token,
        )
        a.fechaOk = true
      }

      if (inic?.turno && !a.turnoOk) {
        await turnosService.cambiarEstado(inic.turno.id, 'en_taller', token)
        a.turnoOk = true
      }

      const chapa = vehiculo?.patente ?? normalizarPatente(patente)
      avisar(`Auto ${chapa} recibido en el taller.`, {
        accion: { texto: 'Ver orden', onClick: () => navigate(`/ordenes/${orden.id}`) },
      })
      onListo?.(orden)
      onCerrar?.()
    } catch (problema) {
      setErrorApi(mensajeParcial(problema))
    } finally {
      setGuardando(false)
    }
  }

  const turno = inicial?.turno
  const esPatenteNueva = !vehiculo && busqueda === 'nueva'
  const mostrarTrabajo = Boolean(vehiculo) || esPatenteNueva

  const bloqueCliente = (
    <div className="space-y-3 rounded-box border border-graphite-600 p-4">
      <h4 className="text-sm font-semibold">Cliente</h4>
      {errores.cliente && <p className="text-sm text-danger">{errores.cliente}</p>}
      {clienteElegido ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            {nombrePersona(clienteElegido)}
            {clienteElegido.dni ? (
              <span className="text-muted"> · DNI {clienteElegido.dni}</span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={limpiarCliente}
            className="shrink-0 text-sm text-amber-texto hover:underline"
          >
            Cambiar
          </button>
        </div>
      ) : clienteModo === 'nuevo' ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Nombre"
              value={clienteForm.nombre}
              onChange={(e) => cambiarClienteForm('nombre', e.target.value)}
              error={errores.clienteNombre}
              disabled={guardando}
              placeholder="Ej.: Juan"
            />
            <Field
              label="Apellido"
              value={clienteForm.apellido}
              onChange={(e) => cambiarClienteForm('apellido', e.target.value)}
              error={errores.clienteApellido}
              disabled={guardando}
              placeholder="Ej.: Pérez"
            />
            <Field
              label="DNI"
              inputMode="numeric"
              value={clienteForm.dni}
              onChange={(e) => cambiarClienteForm('dni', e.target.value)}
              error={errores.clienteDni}
              disabled={guardando}
              placeholder="Ej.: 20111222"
            />
            <Field
              label="Teléfono (opcional)"
              inputMode="tel"
              value={clienteForm.telefono}
              onChange={(e) => cambiarClienteForm('telefono', e.target.value)}
              error={errores.clienteTelefono}
              disabled={guardando}
              placeholder="Ej.: 3874112233"
            />
          </div>
          <button
            type="button"
            onClick={() => setClienteModo('buscar')}
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            ← Buscar un cliente que ya existe
          </button>
        </>
      ) : (
        <>
          <Autocomplete
            label="Cliente"
            value={textoCliente}
            onChange={setTextoCliente}
            onElegir={elegirCliente}
            buscar={buscarClientes}
            minimo={2}
            disabled={guardando}
            placeholder="Nombre o DNI"
            sinResultados="No aparece: podés cargarlo como cliente nuevo."
          />
          <button
            type="button"
            onClick={() => setClienteModo('nuevo')}
            className="text-sm text-amber-texto transition-colors hover:underline"
          >
            Es un cliente nuevo
          </button>
        </>
      )}
    </div>
  )

  const bloqueVehiculo = (
    <div className="space-y-4 rounded-box border border-graphite-600 p-4">
      <h4 className="text-sm font-semibold">Vehículo</h4>
      <p className="text-sm text-muted">
        Patente{' '}
        <span className="font-mono font-semibold text-ink">
          {normalizarPatente(patente)}
        </span>
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Autocomplete
          label="Marca"
          value={vehiculoForm.marca}
          onChange={(valor) => cambiarVehiculoForm('marca', valor)}
          buscar={buscarMarcas}
          error={errores.marca}
          disabled={guardando}
          placeholder="Ej.: Ford"
          sinResultados="No está en el catálogo, podés escribirla igual."
        />
        <Autocomplete
          label="Modelo"
          value={vehiculoForm.modelo}
          onChange={(valor) => cambiarVehiculoForm('modelo', valor)}
          buscar={buscarModelos}
          error={errores.modelo}
          disabled={guardando}
          placeholder="Ej.: Focus"
          sinResultados="No está en el catálogo, podés escribirlo igual."
        />
        <Field
          label="Año (opcional)"
          inputMode="numeric"
          value={vehiculoForm.anio}
          onChange={(e) => cambiarVehiculoForm('anio', e.target.value)}
          error={errores.anio}
          disabled={guardando}
          placeholder="Ej.: 2018"
        />
      </div>
    </div>
  )

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={turno ? 'Recibir auto del turno' : 'Recibir auto'}
      descripcion={
        turno?.hora
          ? `Turno de las ${turno.hora}. Al confirmar, el auto queda ingresado y el turno pasa a "en el taller".`
          : 'Escribí la patente y el trabajo; el auto queda ingresado en el taller.'
      }
      ancho="max-w-xl"
    >
      <div className="space-y-6">
        <section className="space-y-4">
          <EncabezadoPaso numero={1} texto="¿Qué auto es?" />
          {vehiculo ? (
            <div className="rounded-box border border-graphite-600 bg-graphite-700 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-lg font-semibold text-amber-texto">
                    {vehiculo.patente}
                  </p>
                  <p className="mt-0.5 text-sm">{detalleVehiculo(vehiculo)}</p>
                  <p className="mt-1 text-xs text-muted">
                    Titular: {titular ? nombrePersona(titular) : 'Cargando…'}
                    {titular?.dni ? ` · DNI ${titular.dni}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cambiarVehiculo}
                  className="shrink-0 text-sm text-amber-texto transition-colors hover:underline"
                >
                  Cambiar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="ingreso-patente"
                  className="mb-1.5 block text-sm font-medium text-ink"
                >
                  Patente
                </label>
                <div className="flex items-start gap-2">
                  <Autocomplete
                    id="ingreso-patente"
                    className="min-w-0 flex-1"
                    value={patente}
                    onChange={alCambiarPatente}
                    onElegir={elegirSugerenciaPatente}
                    onEnter={buscarAhora}
                    onBlur={alSalirPatente}
                    opciones={opcionesPatente}
                    minimo={2}
                    error={errores.patente || errorBusqueda}
                    placeholder="Ej.: AB123CD"
                    disabled={guardando || cargandoVehiculoTurno}
                    sinResultados={
                      catalogosListos
                        ? 'Ningún auto coincide con eso.'
                        : 'Cargando autos…'
                    }
                    flotante={false}
                    opcionClassName="flex min-h-11 flex-col justify-center"
                  />
                  <Button
                    type="button"
                    variante="secundario"
                    onClick={buscarAhora}
                    disabled={guardando || busqueda === 'buscando' || cargandoVehiculoTurno}
                    className="h-11 shrink-0"
                  >
                    Buscar
                  </Button>
                </div>
              </div>

              {busqueda === 'buscando' && (
                <p className="text-sm text-muted">Buscando el auto…</p>
              )}
              {cargandoVehiculoTurno && (
                <p className="text-sm text-muted">Cargando el vehículo del turno…</p>
              )}
              {esPatenteNueva && (
                <>
                  <Alert tipo="info">Patente nueva, cargamos el auto.</Alert>
                  {bloqueCliente}
                  {bloqueVehiculo}
                </>
              )}
            </div>
          )}
        </section>

        {mostrarTrabajo && (
          <section className="space-y-4">
            <EncabezadoPaso numero={2} texto="¿Qué trabajo hacemos?" />
            <div className="flex flex-wrap gap-2">
              {SUGERENCIAS_TRABAJO.map((sugerencia) => (
                <button
                  key={sugerencia}
                  type="button"
                  onClick={() => agregarChip(sugerencia)}
                  disabled={guardando}
                  className="rounded-full border border-graphite-600 px-3 py-1 text-xs text-muted transition-colors hover:border-amber hover:text-amber-texto"
                >
                  {sugerencia}
                </button>
              ))}
            </div>
            <Textarea
              label="Trabajo a realizar"
              value={trabajo}
              onChange={(e) => {
                setTrabajo(e.target.value)
                if (errores.trabajo) {
                  setErrores((previo) => ({ ...previo, trabajo: undefined }))
                }
              }}
              error={errores.trabajo}
              disabled={guardando}
              placeholder="Service completo: aceite, filtros y revisión de frenos."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Mecánico (opcional)"
                value={mecanicoId}
                onChange={(e) => setMecanicoId(e.target.value)}
                disabled={guardando}
                opciones={[
                  { valor: '', texto: 'Sin asignar' },
                  ...mecanicos.map((mecanico) => ({
                    valor: mecanico.id,
                    texto: `${mecanico.apellido}, ${mecanico.nombre}`,
                  })),
                ]}
              />
              <Field
                label="Entrega estimada (opcional)"
                type="date"
                min={hoy}
                value={entrega}
                onChange={(e) => setEntrega(e.target.value)}
                disabled={guardando}
              />
            </div>
          </section>
        )}

        {errorApi && <Alert>{errorApi}</Alert>}

        <div className="flex justify-end gap-2 border-t border-graphite-700 pt-4">
          <Button
            type="button"
            variante="fantasma"
            onClick={onCerrar}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={recibirAuto} cargando={guardando}>
            Recibir auto
          </Button>
        </div>
      </div>
    </Modal>
  )
}
