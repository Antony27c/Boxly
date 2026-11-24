import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAvisosStock } from '@/components/inventario/AvisosStock'
import { useAuth } from '@/context/AuthContext'
import usePaginacion from '@/hooks/usePaginacion'
import useRecurso from '@/hooks/useRecurso'
import { ROLES_MOSTRADOR, tieneAcceso } from '@/routes/navegacion'
import { repuestosService, tieneStockBajo } from '@/services/repuestos'
import useIngresoStock from './useIngresoStock'

const bajoYActivo = (repuesto) => repuesto.activo !== false && tieneStockBajo(repuesto)

/**
 * Estado y llamadas del inventario: filtros, listado (paginado en el servidor
 * o completo si hay búsqueda o filtro de stock bajo), alta/edición,
 * activar/desactivar, ingreso de stock y avisos de stock mínimo.
 */
export default function useInventario() {
  const { token, usuario } = useAuth()
  const puedeEditar = tieneAcceso(ROLES_MOSTRADOR, usuario?.rol)
  const [parametros, setParametros] = useSearchParams()

  const [busqueda, setBusqueda] = useState('')
  const [soloBajo, setSoloBajo] = useState(false)
  const [verInactivos, setVerInactivos] = useState(false)

  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState(null)
  const [guardandoRepuesto, setGuardandoRepuesto] = useState(false)

  const [aDesactivar, setADesactivar] = useState(null)
  const [errorDesactivar, setErrorDesactivar] = useState('')
  const [procesando, setProcesando] = useState(false)

  const [aviso, setAviso] = useState('')
  const [errorAccion, setErrorAccion] = useState('')

  // Con búsqueda o el filtro de stock bajo se trabaja con la lista completa
  // (los filtros son del lado del cliente); si no, se pagina en el servidor.
  const modoCompleto = busqueda.trim() !== '' || soloBajo
  const paginacion = usePaginacion()
  const { offset, limite, setTotal } = paginacion

  // Al tildar "Mostrar inactivos" cambia la función de carga y useRecurso vuelve a pedir los datos
  const cargar = useCallback(
    (t) => {
      if (modoCompleto) {
        return verInactivos ? repuestosService.listarTodos(t) : repuestosService.listar(t)
      }
      return repuestosService
        .listarPaginado({ limit: limite, offset, ...(verInactivos ? {} : { solo_activos: true }) }, t)
        .then(({ items, total: cantidad }) => {
          setTotal(cantidad)
          return items
        })
    },
    [modoCompleto, verInactivos, limite, offset, setTotal],
  )
  const { datos: repuestos, cargando, error, recargar } = useRecurso(cargar)

  // El aviso de stock bajo usa el endpoint dedicado: con paginación la página
  // actual no alcanza para contar todos los repuestos bajos.
  const cargarStockBajo = useCallback((t) => repuestosService.stockBajo(t), [])
  const { datos: stockBajo, recargar: recargarStockBajo } = useRecurso(cargarStockBajo)
  // Avisos de stock mínimo sin leer: solo administrador y recepción.
  const avisosStock = useAvisosStock(puedeEditar)
  const recargarTodo = useCallback(async () => {
    await Promise.all([recargar(), recargarStockBajo()])
  }, [recargar, recargarStockBajo])

  // La alerta de stock bajo solo cuenta repuestos activos
  const conStockBajo = useMemo(() => (stockBajo ?? []).filter(bajoYActivo), [stockBajo])

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return (repuestos ?? [])
      .filter((repuesto) => !soloBajo || bajoYActivo(repuesto))
      .filter(
        (repuesto) =>
          !termino ||
          `${repuesto.codigo} ${repuesto.nombre} ${repuesto.descripcion ?? ''}`
            .toLowerCase()
            .includes(termino),
      )
      .sort(
        (a, b) => Number(bajoYActivo(b)) - Number(bajoYActivo(a)) || a.nombre.localeCompare(b.nombre),
      )
  }, [repuestos, busqueda, soloBajo])

  const ingreso = useIngresoStock({ token, setAviso, recargarTodo })

  function abrirFormulario(repuesto) {
    setEnEdicion(repuesto)
    setAviso('')
    setErrorAccion('')
    setFormularioAbierto(true)
  }

  // Si la API rechaza (ej. código repetido) el error sube al formulario, que lo muestra.
  // Solo se cierra el modal y se recarga la lista cuando se guardó bien.
  async function guardar(datosRepuesto) {
    setGuardandoRepuesto(true)
    try {
      if (enEdicion) {
        await repuestosService.actualizar(enEdicion.id, datosRepuesto, token)
        setAviso('Repuesto actualizado.')
      } else {
        await repuestosService.crear(datosRepuesto, token)
        setAviso('Repuesto creado.')
      }
    } finally {
      setGuardandoRepuesto(false)
    }
    setFormularioAbierto(false)
    setEnEdicion(null)
    await recargarTodo()
  }

  // Mientras se guarda no se cierra el modal (Escape, ✕ o clic afuera): si la API
  // devuelve un error, el formulario tiene que seguir abierto para mostrarlo.
  function cerrarFormulario() {
    if (!guardandoRepuesto) setFormularioAbierto(false)
  }

  async function activar(repuesto) {
    setErrorAccion('')
    setAviso('')
    try {
      await repuestosService.cambiarEstado(repuesto.id, true, token)
      setAviso(`"${repuesto.nombre}" volvió a estar activo.`)
      await recargarTodo()
    } catch (problema) {
      setErrorAccion(problema.message)
    }
  }

  function pedirDesactivar(repuesto) {
    setErrorDesactivar('')
    setADesactivar(repuesto)
  }

  async function confirmarDesactivar() {
    setProcesando(true)
    setErrorDesactivar('')
    try {
      await repuestosService.cambiarEstado(aDesactivar.id, false, token)
      setAviso(`"${aDesactivar.nombre}" se desactivó. Ya no aparece al armar órdenes.`)
      setADesactivar(null)
      await recargarTodo()
    } catch (problema) {
      setErrorDesactivar(problema.message)
    } finally {
      setProcesando(false)
    }
  }

  // ?nuevo=1 (por ejemplo desde la checklist de primeros pasos) abre el
  // formulario de alta una vez; el efecto de abajo limpia el parámetro.
  const quiereNuevo = parametros.get('nuevo') === '1'
  if (quiereNuevo && puedeEditar && !formularioAbierto) {
    setEnEdicion(null)
    setFormularioAbierto(true)
  }
  useEffect(() => {
    if (!quiereNuevo) return
    const proximos = new URLSearchParams(parametros)
    proximos.delete('nuevo')
    setParametros(proximos, { replace: true })
  }, [quiereNuevo, parametros, setParametros])

  return {
    puedeEditar,
    filtros: {
      busqueda,
      setBusqueda,
      soloBajo,
      setSoloBajo,
      verInactivos,
      setVerInactivos,
      hayFiltro: Boolean(busqueda || soloBajo),
    },
    repuestos,
    filtrados,
    cargando,
    error,
    recargarTodo,
    conStockBajo,
    avisosStock,
    aviso,
    errorAccion,
    paginacion,
    mostrarPaginacion: !modoCompleto && paginacion.paginas > 1 && !error && filtrados.length > 0,
    acciones: {
      ingresar: ingreso.abrir,
      editar: abrirFormulario,
      activar,
      desactivar: pedirDesactivar,
    },
    abrirNuevo: () => abrirFormulario(null),
    formulario: {
      abierto: formularioAbierto,
      enEdicion,
      guardar,
      cerrar: cerrarFormulario,
    },
    ingreso,
    desactivacion: {
      repuesto: aDesactivar,
      error: errorDesactivar,
      procesando,
      confirmar: confirmarDesactivar,
      cerrar: () => setADesactivar(null),
    },
  }
}
