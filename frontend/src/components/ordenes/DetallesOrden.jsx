import { useCallback, useMemo, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Autocomplete from '@/components/ui/Autocomplete'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Select from '@/components/ui/Select'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { formatearMontoAR, MENSAJE_MONTO_INVALIDO, parsearMontoAR } from '@/lib/montos'
import { ROLES_MECANICO, ROLES_MOSTRADOR, tieneAcceso } from '@/routes/navegacion'
import { lineaACotizar, ordenesService, sePuedeEditarDetalle } from '@/services/ordenes'
import { repuestosService } from '@/services/repuestos'
import { pesos } from '@/utils/formato'

const VACIO = {
  tipo: 'trabajo',
  repuesto_id: '',
  descripcion: '',
  cantidad: '1',
  precio_unitario: '',
}

// onCambio: avisa a la página que cambiaron las líneas (el total, las líneas a
// cotizar y con eso si se puede cobrar), para que vuelva a leer la orden.
export default function DetallesOrden({ orden, onCambio }) {
  const { token, usuario } = useAuth()
  const editable = sePuedeEditarDetalle(orden)
  // S3: el mecánico no carga precios; administración y recepción cotizan.
  const esMecanico = tieneAcceso(ROLES_MECANICO, usuario?.rol)
  const puedeCotizar = editable && tieneAcceso(ROLES_MOSTRADOR, usuario?.rol)

  const cargarDetalles = useCallback((t) => ordenesService.detalles(orden.id, t), [orden.id])
  const cargarRepuestos = useCallback(
    (t) => (editable ? repuestosService.listar(t) : Promise.resolve([])),
    [editable],
  )

  const { datos: detalles, cargando, error, recargar } = useRecurso(cargarDetalles)
  const { datos: repuestos, error: errorRepuestos } = useRecurso(cargarRepuestos)

  const [datos, setDatos] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [errorApi, setErrorApi] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [quitando, setQuitando] = useState(null)
  const [textoRepuesto, setTextoRepuesto] = useState('')
  const [cotizando, setCotizando] = useState(null)
  const [precioCotizar, setPrecioCotizar] = useState('')
  const [guardandoCotizar, setGuardandoCotizar] = useState(null)

  const opcionesRepuesto = useMemo(
    () =>
      (repuestos ?? []).map((repuesto) => ({
        valor: repuesto.id,
        texto: repuesto.nombre,
        detalle: `${repuesto.codigo ?? ''} · ${pesos(repuesto.precio)} · stock ${repuesto.stock}`,
      })),
    [repuestos],
  )

  const repuestoElegido = useMemo(
    () => (repuestos ?? []).find((item) => item.id === Number(datos.repuesto_id)),
    [repuestos, datos.repuesto_id],
  )

  const totalLineas = useMemo(
    () => (detalles ?? []).reduce((suma, item) => suma + Number(item.subtotal ?? 0), 0),
    [detalles],
  )
  const lineasACotizar = useMemo(() => (detalles ?? []).filter(lineaACotizar).length, [detalles])

  function cambiar(campo, valor) {
    setDatos((previo) => {
      const siguiente = { ...previo, [campo]: valor }
      if (campo === 'repuesto_id') {
        const repuesto = (repuestos ?? []).find((item) => item.id === Number(valor))
        siguiente.precio_unitario = repuesto ? formatearMontoAR(repuesto.precio) : ''
      }
      return siguiente
    })
    if (errores[campo]) setErrores((previo) => ({ ...previo, [campo]: undefined }))
    if (errorApi) setErrorApi('')
  }

  function validar() {
    const encontrados = {}
    const cantidad = Number(datos.cantidad)
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      encontrados.cantidad = 'La cantidad debe ser un número entero mayor a 0.'
    }
    if (datos.tipo === 'repuesto') {
      if (!datos.repuesto_id) encontrados.repuesto_id = 'Elegí el repuesto.'
    } else if (!datos.descripcion.trim()) {
      encontrados.descripcion = 'Describí el trabajo.'
    }
    // El mecánico no valida precio: no lo carga (el repuesto toma el del
    // inventario y la mano de obra queda a cotizar por recepción).
    if (!esMecanico) {
      if (String(datos.precio_unitario).trim() === '') {
        encontrados.precio_unitario = 'Ingresá el precio.'
      } else if (parsearMontoAR(datos.precio_unitario) === null) {
        encontrados.precio_unitario = MENSAJE_MONTO_INVALIDO
      }
    }
    return encontrados
  }

  async function agregar(evento) {
    evento.preventDefault()
    const encontrados = validar()
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    setGuardando(true)
    setErrorApi('')
    try {
      await ordenesService.agregarDetalle(
        orden.id,
        {
          repuesto_id: datos.tipo === 'repuesto' ? datos.repuesto_id : null,
          descripcion: datos.tipo === 'trabajo' ? datos.descripcion : '',
          cantidad: datos.cantidad,
          ...(esMecanico ? {} : { precio_unitario: parsearMontoAR(datos.precio_unitario) }),
        },
        token,
      )
      setDatos(VACIO)
      setTextoRepuesto('')
      await recargar()
      onCambio?.()
    } catch (problema) {
      setErrorApi(problema.message)
    } finally {
      setGuardando(false)
    }
  }

  async function quitar(detalle) {
    setQuitando(detalle.id)
    setErrorApi('')
    try {
      await ordenesService.quitarDetalle(orden.id, detalle.id, token)
      await recargar()
      onCambio?.()
    } catch (problema) {
      setErrorApi(problema.message)
    } finally {
      setQuitando(null)
    }
  }

  function abrirCotizar(detalle) {
    setCotizando(detalle.id)
    setPrecioCotizar('')
    setErrorApi('')
  }

  async function cotizar(evento, detalle) {
    evento.preventDefault()
    const precio = parsearMontoAR(precioCotizar)
    if (precio === null) {
      setErrorApi(precioCotizar.trim() ? MENSAJE_MONTO_INVALIDO : 'Ingresá el precio.')
      return
    }
    setGuardandoCotizar(detalle.id)
    setErrorApi('')
    try {
      await ordenesService.cotizarDetalle(orden.id, detalle.id, precio, token)
      setCotizando(null)
      setPrecioCotizar('')
      await recargar()
      onCambio?.()
    } catch (problema) {
      setErrorApi(problema.message)
    } finally {
      setGuardandoCotizar(null)
    }
  }

  if (cargando && !detalles) return <Loader texto="Cargando líneas…" />

  if (error) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Button variante="secundario" onClick={recargar}>
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {errorApi && <Alert>{errorApi}</Alert>}
      {errorRepuestos && <Alert>{errorRepuestos}</Alert>}

      {(detalles ?? []).length === 0 ? (
        <p className="text-sm text-muted">
          Todavía no hay trabajos ni repuestos cargados en esta orden.
        </p>
      ) : (
        <ul className="space-y-3">
          {detalles.map((item) => {
            const pendiente = lineaACotizar(item)
            return (
              <li
                key={item.id}
                className="rounded-box border border-graphite-700 p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{item.descripcion}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted">
                      {item.repuesto_id ? 'Repuesto' : 'Mano de obra'} · {item.cantidad}
                      {pendiente ? (
                        ' · precio a definir'
                      ) : (
                        ` × ${pesos(item.precio_unitario)}`
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {pendiente ? (
                      <Badge tono="ambar">A cotizar</Badge>
                    ) : (
                      <span className="font-medium">{pesos(item.subtotal)}</span>
                    )}
                    {puedeCotizar && pendiente && cotizando !== item.id && (
                      <Button variante="fantasma" onClick={() => abrirCotizar(item)}>
                        Cotizar
                      </Button>
                    )}
                    {editable && (
                      <Button
                        variante="fantasma"
                        cargando={quitando === item.id}
                        disabled={guardando}
                        onClick={() => quitar(item)}
                      >
                        Quitar
                      </Button>
                    )}
                  </div>
                </div>
                {cotizando === item.id && (
                  <form
                    onSubmit={(evento) => cotizar(evento, item)}
                    noValidate
                    className="mt-3 flex flex-wrap items-end gap-2 border-t border-graphite-700 pt-3"
                  >
                    <Field
                      label="Precio a cotizar"
                      inputMode="decimal"
                      value={precioCotizar}
                      onChange={(e) => setPrecioCotizar(e.target.value)}
                      disabled={guardandoCotizar === item.id}
                      placeholder="15.000"
                      className="w-full sm:w-44"
                    />
                    <Button type="submit" cargando={guardandoCotizar === item.id}>
                      Guardar precio
                    </Button>
                    <Button
                      type="button"
                      variante="fantasma"
                      onClick={() => setCotizando(null)}
                      disabled={guardandoCotizar === item.id}
                    >
                      Cancelar
                    </Button>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex justify-between border-t border-graphite-700 pt-3 text-sm">
        <span className="text-muted">
          {lineasACotizar > 0 ? `Total parcial · ${lineasACotizar} a cotizar` : 'Total de líneas'}
        </span>
        <span className="font-semibold">{pesos(totalLineas)}</span>
      </div>

      {editable && (
        <form onSubmit={agregar} noValidate className="space-y-4 border-t border-graphite-700 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Tipo de línea"
              value={datos.tipo}
              onChange={(e) => cambiar('tipo', e.target.value)}
              disabled={guardando}
              opciones={[
                { valor: 'trabajo', texto: 'Trabajo / mano de obra' },
                { valor: 'repuesto', texto: 'Repuesto del inventario' },
              ]}
            />
            {datos.tipo === 'repuesto' ? (
              <Autocomplete
                label="Repuesto"
                value={textoRepuesto}
                onChange={(texto) => {
                  setTextoRepuesto(texto)
                  if (datos.repuesto_id) cambiar('repuesto_id', '')
                }}
                onElegir={(opcion) => cambiar('repuesto_id', opcion.valor)}
                opciones={opcionesRepuesto}
                error={errores.repuesto_id}
                disabled={guardando}
                placeholder="Buscá por nombre o código"
                sinResultados="No hay repuestos con ese nombre."
                ayuda={
                  repuestoElegido ? `Stock disponible: ${repuestoElegido.stock}` : undefined
                }
              />
            ) : (
              <Field
                label="Trabajo"
                value={datos.descripcion}
                onChange={(e) => cambiar('descripcion', e.target.value)}
                error={errores.descripcion}
                disabled={guardando}
                placeholder="Ej.: Cambio de pastillas de freno"
              />
            )}
            <Field
              label="Cantidad"
              inputMode="numeric"
              value={datos.cantidad}
              onChange={(e) => cambiar('cantidad', e.target.value)}
              error={errores.cantidad}
              disabled={guardando}
            />
            {esMecanico ? (
              <div className="self-end pb-1">
                <p className="text-xs font-medium text-muted">Precio</p>
                <p className="mt-1 text-sm text-ink">
                  {datos.tipo === 'repuesto' ? 'Precio del inventario' : 'Queda a cotizar por recepción'}
                </p>
              </div>
            ) : (
              <Field
                label="Precio unitario"
                inputMode="decimal"
                value={datos.precio_unitario}
                onChange={(e) => cambiar('precio_unitario', e.target.value)}
                error={errores.precio_unitario}
                disabled={guardando}
                ayuda={datos.tipo === 'repuesto' ? 'Se completa solo; podés cambiarlo.' : undefined}
                placeholder="15.000"
              />
            )}
          </div>
          <div className="flex justify-end">
            <Button type="submit" cargando={guardando}>
              {guardando ? 'Agregando…' : 'Agregar línea'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
