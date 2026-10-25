import { useCallback, useMemo, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Vacio from '@/components/ui/Vacio'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { ROLES_MOSTRADOR, tieneAcceso } from '@/routes/navegacion'
import { repuestosService, tieneStockBajo } from '@/services/repuestos'

function pesos(valor) {
  return `$ ${Number(valor ?? 0).toLocaleString('es-AR')}`
}

export default function Inventario() {
  const { token, usuario } = useAuth()
  const puedeIngresar = tieneAcceso(ROLES_MOSTRADOR, usuario?.rol)
  const [busqueda, setBusqueda] = useState('')
  const [soloBajo, setSoloBajo] = useState(false)
  const [aIngresar, setAIngresar] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [errorCantidad, setErrorCantidad] = useState('')
  const [errorIngreso, setErrorIngreso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')

  const cargar = useCallback((t) => repuestosService.listar(t), [])
  const { datos: repuestos, cargando, error, recargar } = useRecurso(cargar)

  const conStockBajo = useMemo(() => (repuestos ?? []).filter(tieneStockBajo), [repuestos])

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return (repuestos ?? [])
      .filter((repuesto) => !soloBajo || tieneStockBajo(repuesto))
      .filter(
        (repuesto) =>
          !termino ||
          `${repuesto.codigo} ${repuesto.nombre} ${repuesto.descripcion ?? ''}`
            .toLowerCase()
            .includes(termino),
      )
      .sort((a, b) => Number(tieneStockBajo(b)) - Number(tieneStockBajo(a)) || a.nombre.localeCompare(b.nombre))
  }, [repuestos, busqueda, soloBajo])

  function abrirIngreso(repuesto) {
    setAIngresar(repuesto)
    setCantidad('')
    setErrorCantidad('')
    setErrorIngreso('')
  }

  async function ingresar(evento) {
    evento.preventDefault()
    const numero = Number(cantidad)
    if (!Number.isInteger(numero) || numero < 1) {
      setErrorCantidad('Ingresá una cantidad entera mayor a 0.')
      return
    }
    setGuardando(true)
    setErrorIngreso('')
    try {
      await repuestosService.ingresarStock(aIngresar, numero, token)
      setAviso(`Ingresaron ${numero} unidades de ${aIngresar.nombre}.`)
      setAIngresar(null)
      await recargar()
    } catch (problema) {
      setErrorIngreso(problema.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Inventario"
        descripcion="Repuestos del taller, stock disponible e ingresos de mercadería."
      />

      {conStockBajo.length > 0 && (
        <div className="mt-4">
          <Alert>
            {conStockBajo.length === 1
              ? `"${conStockBajo[0].nombre}" está en el stock mínimo o por debajo.`
              : `${conStockBajo.length} repuestos están en el stock mínimo o por debajo.`}{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => setSoloBajo(true)}
            >
              Ver cuáles
            </button>
          </Alert>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <Field
          label="Buscar por nombre o código"
          type="search"
          className="w-full sm:max-w-sm"
          placeholder="Filtro de aceite"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <label className="flex items-center gap-2 pb-3 text-sm">
          <input
            type="checkbox"
            checked={soloBajo}
            onChange={(e) => setSoloBajo(e.target.checked)}
            className="accent-amber"
          />
          Sólo stock bajo
        </label>
      </div>

      {aviso && (
        <div className="mt-4">
          <Alert tipo="ok">{aviso}</Alert>
        </div>
      )}

      {cargando ? (
        <Loader texto="Cargando inventario…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="mt-6">
          <Vacio titulo="Sin repuestos para mostrar" mensaje="Probá con otra búsqueda o sacá el filtro." />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-box border border-graphite-700 bg-graphite-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-graphite-700 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Repuesto</th>
                <th className="px-4 py-3 text-right font-medium">Precio</th>
                <th className="px-4 py-3 text-right font-medium">Stock</th>
                <th className="px-4 py-3 text-right font-medium">Mínimo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((repuesto) => {
                const bajo = tieneStockBajo(repuesto)
                return (
                  <tr key={repuesto.id} className="border-b border-graphite-700 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{repuesto.codigo}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{repuesto.nombre}</p>
                      {repuesto.descripcion && <p className="text-xs text-muted">{repuesto.descripcion}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">{pesos(repuesto.precio)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={bajo ? 'font-semibold text-danger' : 'font-semibold'}>
                        {repuesto.stock}
                      </span>
                      {bajo && (
                        <span className="ml-2">
                          <Badge tono="peligro">{repuesto.stock === 0 ? 'Sin stock' : 'Stock bajo'}</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{repuesto.stock_minimo}</td>
                    <td className="px-4 py-3 text-right">
                      {puedeIngresar && (
                        <Button variante="secundario" onClick={() => abrirIngreso(repuesto)}>
                          Ingresar stock
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        abierto={Boolean(aIngresar)}
        titulo={`Ingreso de stock · ${aIngresar?.nombre ?? ''}`}
        descripcion={`Stock actual: ${aIngresar?.stock ?? 0} unidades (mínimo ${aIngresar?.stock_minimo ?? 0}).`}
        onCerrar={() => setAIngresar(null)}
      >
        <form onSubmit={ingresar} noValidate className="space-y-4">
          {errorIngreso && <Alert>{errorIngreso}</Alert>}
          <Field
            label="Cantidad que ingresa"
            inputMode="numeric"
            value={cantidad}
            onChange={(e) => {
              setCantidad(e.target.value)
              if (errorCantidad) setErrorCantidad('')
            }}
            error={errorCantidad}
            disabled={guardando}
            placeholder="10"
            ayuda={
              Number(cantidad) > 0
                ? `Queda en ${Number(aIngresar?.stock ?? 0) + Number(cantidad)} unidades.`
                : undefined
            }
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variante="fantasma" onClick={() => setAIngresar(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" cargando={guardando}>
              {guardando ? 'Guardando…' : 'Ingresar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
