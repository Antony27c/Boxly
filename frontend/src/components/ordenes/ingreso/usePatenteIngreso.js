import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { clientesService } from '@/services/clientes'
import { vehiculosService } from '@/services/vehiculos'
import { MENSAJE_FORMATO_PATENTE, PATENTE, normalizarPatente } from './formato'
import { PATENTE_NUEVA, armarOpcionesPatente } from './opcionesPatente'

/**
 * Paso 1 del ingreso rápido: la patente, su búsqueda (sola con debounce o con
 * "Buscar"), las sugerencias y el vehículo elegido con su titular.
 * `limpiarError` borra el error de la patente que marcó la validación.
 */
export default function usePatenteIngreso({ abierto, inicial, token, limpiarError }) {
  const consultaPatente = useRef(0)
  // Patente confirmada como "nueva" desde una sugerencia: frena la búsqueda
  // automática para que no vuelva a preguntar por la misma chapa.
  const placaNueva = useRef('')
  // Última patente que se buscó en el servidor: la búsqueda automática no la
  // repite (sin esto, tras "Buscar" el debounce volvía a buscarla y volvía a
  // montar los bloques del cliente, borrando lo que ya se había tipeado).
  const patenteBuscada = useRef('')

  const [patente, setPatente] = useState('')
  const [vehiculo, setVehiculo] = useState(null)
  const [titular, setTitular] = useState(null)
  const [busqueda, setBusqueda] = useState('ociosa') // ociosa | buscando | encontrada | nueva | error
  const [errorBusqueda, setErrorBusqueda] = useState('')
  const [vehiculosBase, setVehiculosBase] = useState([])
  const [clientesBase, setClientesBase] = useState([])
  const [catalogosListos, setCatalogosListos] = useState(false)
  // true solo mientras viaja la carga inicial del vehículo del turno:
  // bloquea la patente para que una búsqueda a mano no pise ese resultado.
  const [cargandoVehiculoTurno, setCargandoVehiculoTurno] = useState(false)

  // Cada apertura arranca limpio ("ajustar estado durante el render").
  const [previoAbierto, setPrevioAbierto] = useState(false)
  if (abierto !== previoAbierto) {
    setPrevioAbierto(abierto)
    if (abierto) {
      setPatente('')
      setVehiculo(null)
      setTitular(null)
      setBusqueda('ociosa')
      setErrorBusqueda('')
      setVehiculosBase([])
      setClientesBase([])
      setCatalogosListos(false)
      setCargandoVehiculoTurno(Boolean(inicial?.vehiculoId))
    }
  }

  useEffect(() => {
    if (!abierto) return
    placaNueva.current = ''
    patenteBuscada.current = ''
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
  }, [abierto, token])

  /** Carga el vehículo que trae el turno; si falla, el que llama muestra el error. */
  const cargarVehiculoTurno = useCallback(
    (vehiculoId) =>
      vehiculosService
        .obtener(vehiculoId, token)
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
        .finally(() => setCargandoVehiculoTurno(false)),
    [token],
  )

  // Elige el vehículo y trae su titular, salvo que mientras tanto haya otra consulta.
  const usarVehiculo = useCallback(
    (encontrado, numero) => {
      setVehiculo(encontrado)
      setTitular(null)
      setBusqueda('encontrada')
      clientesService
        .obtener(encontrado.cliente_id, token)
        .then((c) => {
          if (consultaPatente.current === numero) setTitular(c)
        })
        .catch(() => {})
    },
    [token],
  )

  const buscar = useCallback(
    async (limpia) => {
      const numero = ++consultaPatente.current
      patenteBuscada.current = limpia
      setBusqueda('buscando')
      setErrorBusqueda('')
      try {
        const params = new URLSearchParams({ q: limpia, limit: '10' })
        const lista = await api.get(`/api/v1/vehiculos?${params}`, token)
        if (numero !== consultaPatente.current) return
        const exacto = (lista ?? []).find((v) => normalizarPatente(v.patente) === limpia) ?? null
        if (exacto) {
          usarVehiculo(exacto, numero)
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
    [token, usarVehiculo],
  )

  const mapaClientes = useMemo(
    () => new Map((clientesBase ?? []).map((cliente) => [Number(cliente.id), cliente])),
    [clientesBase],
  )
  const opciones = useMemo(
    () => armarOpcionesPatente({ patente, catalogosListos, vehiculosBase, mapaClientes }),
    [catalogosListos, patente, vehiculosBase, mapaClientes],
  )

  function elegirSugerencia(opcion) {
    if (opcion.valor === PATENTE_NUEVA) {
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
      opcion.vehiculo ?? vehiculosBase.find((v) => Number(v.id) === Number(opcion.valor))
    if (encontrado) {
      setErrorBusqueda('')
      usarVehiculo(encontrado, ++consultaPatente.current)
    }
  }

  function cambiar(valor) {
    const limpio = normalizarPatente(valor)
    placaNueva.current = ''
    if (limpio !== patenteBuscada.current) patenteBuscada.current = ''
    consultaPatente.current += 1
    setPatente(limpio)
    setErrorBusqueda('')
    limpiarError()
    if (!PATENTE.test(limpio)) setBusqueda('ociosa')
  }

  // Al salir del campo con un valor escrito pero inválido recién ahí
  // aparece el error de formato; vacío o válido no muestran nada.
  function salir() {
    const limpio = normalizarPatente(patente)
    if (limpio && !PATENTE.test(limpio)) setErrorBusqueda(MENSAJE_FORMATO_PATENTE)
  }

  // Al escribir la patente se busca sola (debounce ~300ms); `vehiculo`
  // elegido frena la búsqueda. El estado 'ociosa' lo deja `cambiar`
  // cuando el texto deja de tener formato válido.
  useEffect(() => {
    if (!abierto || vehiculo) return
    const limpia = normalizarPatente(patente)
    const yaResuelta = () => placaNueva.current === limpia || patenteBuscada.current === limpia
    if (!PATENTE.test(limpia) || yaResuelta()) return
    const temporizador = setTimeout(() => {
      // Mientras corría la espera la persona pudo elegir "patente nueva" o
      // tocar "Buscar": en esos casos no hay nada que buscar.
      if (!yaResuelta()) buscar(limpia)
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
      setErrorBusqueda(MENSAJE_FORMATO_PATENTE)
      return
    }
    buscar(limpia)
  }

  function cambiarVehiculo() {
    placaNueva.current = ''
    patenteBuscada.current = ''
    setVehiculo(null)
    setTitular(null)
    setPatente('')
    setBusqueda('ociosa')
    setErrorBusqueda('')
  }

  return {
    patente,
    vehiculo,
    titular,
    busqueda,
    errorBusqueda,
    catalogosListos,
    cargandoVehiculoTurno,
    opciones,
    cargarVehiculoTurno,
    cambiar,
    salir,
    elegirSugerencia,
    buscarAhora,
    cambiarVehiculo,
  }
}
