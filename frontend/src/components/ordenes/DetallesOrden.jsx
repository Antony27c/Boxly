import { useCallback, useMemo, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Autocomplete from '@/components/ui/Autocomplete'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Select from '@/components/ui/Select'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { ordenesService, sePuedeEditarDetalle } from '@/services/ordenes'
import { repuestosService } from '@/services/repuestos'

const VACIO = {
  tipo: 'trabajo',
  repuesto_id: '',
  descripcion: '',
  cantidad: '1',
  precio_unitario: '',
}

function pesos(valor) {
  return `$ ${Number(valor ?? 0).toLocaleString('es-AR')}`
}

export default function DetallesOrden({ orden }) {
  const { token } = useAuth()
  const editable = sePuedeEditarDetalle(orden)

  const cargarDetalles = useCallback((t) => ordenesService.detalles(orden.id, t), [orden.id])
  const cargarRepuestos = useCallback(
    (t) => (editable ? repuestosService.listar(t) : Promise.resolve([])),
    [editable],
  )

  const { datos: detalles, cargando, error, recargar } = useRecurso(cargarDetalles)
  const { datos: repuestos } = useRecurso(cargarRepuestos)

  const [datos, setDatos] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [errorApi, setErrorApi] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [quitando, setQuitando] = useState(null)
  const [textoRepuesto, setTextoRepuesto] = useState('')

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

  function cambiar(campo, valor) {
    setDatos((previo) => {
      const siguiente = { ...previo, [campo]: valor }
      if (campo === 'repuesto_id') {
        const repuesto = (repuestos ?? []).find((item) => item.id === Number(valor))
        siguiente.precio_unitario = repuesto ? String(repuesto.precio) : ''
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
    if (String(datos.precio_unitario).trim() === '') {
      encontrados.precio_unitario = 'Ingresá el precio.'
    } else if (Number.isNaN(Number(datos.precio_unitario)) || Number(datos.precio_unitario) < 0) {
      encontrados.precio_unitario = 'El precio debe ser un número mayor o igual a 0.'
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
          precio_unitario: datos.precio_unitario,
        },
        token,
      )
      setDatos(VACIO)
      setTextoRepuesto('')
      await recargar()
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
    } catch (problema) {
      setErrorApi(problema.message)
    } finally {
      setQuitando(null)
    }
  }

  if (cargando) return <Loader texto="Cargando líneas…" />

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

      {(detalles ?? []).length === 0 ? (
        <p className="text-sm text-muted">
          Todavía no hay trabajos ni repuestos cargados en esta orden.
        </p>
      ) : (
        <ul className="space-y-3">
          {detalles.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-box border border-graphite-700 p-3 text-sm"
            >
              <div>
                <p className="font-medium">{item.descripcion}</p>
                <p className="mt-0.5 text-muted">
                  {item.repuesto_id ? 'Repuesto' : 'Mano de obra'} · {item.cantidad} ×{' '}
                  {pesos(item.precio_unitario)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-medium">{pesos(item.subtotal)}</span>
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
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-between border-t border-graphite-700 pt-3 text-sm">
        <span className="text-muted">Total de líneas</span>
        <span className="font-semibold">{pesos(totalLineas)}</span>
      </div>

      {editable && (
        <form onSubmit={agregar} noValidate className="space-y-4 border-t border-graphite-700 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
                placeholder="Cambio de pastillas de freno"
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
            <Field
              label="Precio unitario"
              inputMode="decimal"
              value={datos.precio_unitario}
              onChange={(e) => cambiar('precio_unitario', e.target.value)}
              error={errores.precio_unitario}
              disabled={guardando}
              ayuda={datos.tipo === 'repuesto' ? 'Se completa solo; podés cambiarlo.' : undefined}
              placeholder="15000"
            />
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
