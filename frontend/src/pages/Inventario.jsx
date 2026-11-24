import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import FormularioRepuesto from '@/components/inventario/FormularioRepuesto'
import VarillaStock from '@/components/inventario/VarillaStock'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import { BOTON_PIE, Chip, Chips, Ficha, FichaCabecera, FichaPie } from '@/components/ui/Ficha'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Paginacion from '@/components/ui/Paginacion'
import Vacio from '@/components/ui/Vacio'
import { useAuth } from '@/context/AuthContext'
import usePaginacion from '@/hooks/usePaginacion'
import useRecurso from '@/hooks/useRecurso'
import { ROLES_MOSTRADOR, tieneAcceso } from '@/routes/navegacion'
import { repuestosService, tieneStockBajo } from '@/services/repuestos'
import { pesos } from '@/utils/formato'
import { STOCK_MAXIMO } from '@/utils/validation'

// Mismo criterio de niveles que la varilla (VarillaStock), que no lo exporta:
// rojo bajo el mínimo o sin stock, ámbar hasta 1,5 veces el mínimo, verde arriba.
function nivelDeStock({ stock, stock_minimo: minimo }) {
  const s = Number(stock) || 0
  const m = Number(minimo) || 0
  if (s <= 0 || s < m) return 'danger'
  return s <= m * 1.5 ? 'amber' : 'ok'
}

const TONO_CHIP_STOCK = { danger: 'peligro', amber: 'ambar', ok: 'ok', neutro: 'neutro' }

export default function Inventario() {
  const { token, usuario } = useAuth()
  const puedeEditar = tieneAcceso(ROLES_MOSTRADOR, usuario?.rol)
  const [parametros, setParametros] = useSearchParams()

  // ---------- Filtros ----------
  const [busqueda, setBusqueda] = useState('')
  const [soloBajo, setSoloBajo] = useState(false)
  const [verInactivos, setVerInactivos] = useState(false)

  // ---------- Alta / edición ----------
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState(null)
  const [guardandoRepuesto, setGuardandoRepuesto] = useState(false)

  // ---------- Ingreso de stock ----------
  const [aIngresar, setAIngresar] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [errorCantidad, setErrorCantidad] = useState('')
  const [errorIngreso, setErrorIngreso] = useState('')
  const [guardando, setGuardando] = useState(false)

  // ---------- Desactivar ----------
  const [aDesactivar, setADesactivar] = useState(null)
  const [errorDesactivar, setErrorDesactivar] = useState('')
  const [procesando, setProcesando] = useState(false)

  const [aviso, setAviso] = useState('')
  const [errorAccion, setErrorAccion] = useState('')

  // Con búsqueda o el filtro de stock bajo se trabaja con la lista completa
  // (los filtros son del lado del cliente); si no, se pagina en el servidor.
  const modoCompleto = busqueda.trim() !== '' || soloBajo
  const { pagina, setPagina, offset, limite, paginas, desde, hasta, total, setTotal } =
    usePaginacion()

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
  const recargarTodo = useCallback(async () => {
    await Promise.all([recargar(), recargarStockBajo()])
  }, [recargar, recargarStockBajo])

  // La alerta de stock bajo solo cuenta repuestos activos
  const conStockBajo = useMemo(
    () => (stockBajo ?? []).filter((r) => r.activo !== false && tieneStockBajo(r)),
    [stockBajo],
  )

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return (repuestos ?? [])
      .filter((repuesto) => !soloBajo || (repuesto.activo !== false && tieneStockBajo(repuesto)))
      .filter(
        (repuesto) =>
          !termino ||
          `${repuesto.codigo} ${repuesto.nombre} ${repuesto.descripcion ?? ''}`
            .toLowerCase()
            .includes(termino),
      )
      .sort(
        (a, b) =>
          Number(b.activo !== false && tieneStockBajo(b)) - Number(a.activo !== false && tieneStockBajo(a)) ||
          a.nombre.localeCompare(b.nombre),
      )
  }, [repuestos, busqueda, soloBajo])

  // ---------- Alta y edición ----------
  function abrirNuevo() {
    setEnEdicion(null)
    setAviso('')
    setErrorAccion('')
    setFormularioAbierto(true)
  }

  function abrirEdicion(repuesto) {
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

  // ---------- Activar / desactivar ----------
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

  // ---------- Ingreso de stock ----------
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
    if (Number(aIngresar.stock) + numero > STOCK_MAXIMO) {
      setErrorCantidad('Con esa cantidad el stock supera el máximo permitido.')
      return
    }
    setGuardando(true)
    setErrorIngreso('')
    try {
      await repuestosService.ingresarStock(aIngresar, numero, token)
      setAviso(`Ingresaron ${numero} unidades de ${aIngresar.nombre}.`)
      setAIngresar(null)
      await recargarTodo()
    } catch (problema) {
      setErrorIngreso(problema.message)
    } finally {
      setGuardando(false)
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

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Inventario"
        descripcion="Repuestos del taller, stock disponible e ingresos de mercadería."
        acciones={puedeEditar ? <Button onClick={abrirNuevo}>Nuevo repuesto</Button> : undefined}
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
          data-lectura
          type="search"
          className="w-full sm:max-w-sm"
          placeholder="Ej.: Filtro de aceite"
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
        {puedeEditar && (
          <label className="flex items-center gap-2 pb-3 text-sm">
            <input
              type="checkbox"
              checked={verInactivos}
              onChange={(e) => setVerInactivos(e.target.checked)}
              className="accent-amber"
            />
            Mostrar inactivos
          </label>
        )}
      </div>

      {aviso && (
        <div className="mt-4">
          <Alert tipo="ok">{aviso}</Alert>
        </div>
      )}
      {errorAccion && (
        <div className="mt-4">
          <Alert>{errorAccion}</Alert>
        </div>
      )}

      {cargando && !repuestos ? (
        <Loader texto="Cargando inventario…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargarTodo}>
            Reintentar
          </Button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="mt-6">
          <Vacio
            titulo={
              busqueda || soloBajo ? 'Sin resultados' : 'El inventario está vacío'
            }
            mensaje={
              busqueda || soloBajo
                ? 'Probá con otro nombre o código, o sacá el filtro de stock bajo.'
                : 'Acá cargás los repuestos que más usa el taller: al armar una orden los buscás por nombre y descuentan stock solos.'
            }
            accion={
              puedeEditar ? (
                <Button onClick={abrirNuevo}>
                  {busqueda || soloBajo ? 'Nuevo repuesto' : 'Cargar el primer repuesto'}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
        {/* Celular: una tarjeta por repuesto, sin tabla que obligue a deslizar de costado. */}
        <ul className={`mt-6 space-y-3 sm:hidden ${cargando ? 'opacity-60' : ''}`}>
          {filtrados.map((repuesto) => {
            const inactivo = repuesto.activo === false
            const bajo = !inactivo && tieneStockBajo(repuesto)
            const nivel = inactivo ? 'neutro' : nivelDeStock(repuesto)
            return (
              <Ficha key={repuesto.id} acento={nivel} className={inactivo ? 'opacity-60' : ''}>
                <FichaCabecera
                  antetitulo={repuesto.codigo}
                  titulo={repuesto.nombre}
                  className="px-4 pb-3 pt-4 [&_h3]:whitespace-normal [&_h3]:text-xl"
                  aside={<VarillaStock stock={repuesto.stock} minimo={repuesto.stock_minimo} className="h-auto w-20" />}
                >
                  {repuesto.descripcion && <p className="mt-1 text-sm text-muted">{repuesto.descripcion}</p>}
                  <Chips>
                    <Chip mono>{pesos(repuesto.precio)}</Chip>
                    <Chip tono={TONO_CHIP_STOCK[nivel]}>
                      Stock <span className="font-mono font-semibold">{repuesto.stock}</span> · mín. {repuesto.stock_minimo}
                    </Chip>
                    {inactivo && <Chip>Inactivo</Chip>}
                    {bajo && <Chip tono="peligro">{repuesto.stock === 0 ? 'Sin stock' : 'Stock bajo'}</Chip>}
                  </Chips>
                </FichaCabecera>
                {puedeEditar && (
                  <FichaPie>
                    {!inactivo && (
                      <Button variante="secundario" className={BOTON_PIE} onClick={() => abrirIngreso(repuesto)}>
                        Ingresar stock
                      </Button>
                    )}
                    <span className="ml-auto flex gap-1">
                      <Button variante="fantasma" className={BOTON_PIE} onClick={() => abrirEdicion(repuesto)}>
                        Editar
                      </Button>
                      {inactivo ? (
                        <Button variante="fantasma" className={BOTON_PIE} onClick={() => activar(repuesto)}>
                          Activar
                        </Button>
                      ) : (
                        <Button
                          variante="fantasma"
                          className={`${BOTON_PIE} hover:!text-danger`}
                          onClick={() => {
                            setErrorDesactivar('')
                            setADesactivar(repuesto)
                          }}
                        >
                          Desactivar
                        </Button>
                      )}
                    </span>
                  </FichaPie>
                )}
              </Ficha>
            )
          })}
        </ul>
        <div
          className={`mt-6 hidden overflow-x-auto rounded-box border border-graphite-700 bg-graphite-800 transition-opacity sm:block ${
            cargando ? 'opacity-60' : ''
          }`}
        >
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
                const inactivo = repuesto.activo === false
                const bajo = !inactivo && tieneStockBajo(repuesto)
                return (
                  <tr
                    key={repuesto.id}
                    className={`border-b border-graphite-700 last:border-0 ${inactivo ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{repuesto.codigo}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">
                        {repuesto.nombre}
                        {inactivo && (
                          <span className="ml-2">
                            <Badge tono="neutro">Inactivo</Badge>
                          </span>
                        )}
                      </p>
                      {repuesto.descripcion && <p className="text-xs text-muted">{repuesto.descripcion}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">{pesos(repuesto.precio)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                        <VarillaStock stock={repuesto.stock} minimo={repuesto.stock_minimo} />
                        <span className={bajo ? 'font-semibold text-danger' : 'font-semibold'}>
                          {repuesto.stock}
                        </span>
                        {bajo && <Badge tono="peligro">{repuesto.stock === 0 ? 'Sin stock' : 'Stock bajo'}</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{repuesto.stock_minimo}</td>
                    <td className="px-4 py-3 text-right">
                      {puedeEditar && (
                        <div className="flex flex-wrap justify-end gap-1">
                          {!inactivo && (
                            <Button variante="secundario" onClick={() => abrirIngreso(repuesto)}>
                              Ingresar stock
                            </Button>
                          )}
                          <Button variante="fantasma" onClick={() => abrirEdicion(repuesto)}>
                            Editar
                          </Button>
                          {inactivo ? (
                            <Button variante="fantasma" onClick={() => activar(repuesto)}>
                              Activar
                            </Button>
                          ) : (
                            <Button
                              variante="fantasma"
                              onClick={() => {
                                setErrorDesactivar('')
                                setADesactivar(repuesto)
                              }}
                            >
                              Desactivar
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {!modoCompleto && paginas > 1 && !error && filtrados.length > 0 && (
        <Paginacion
          className="mt-4"
          pagina={pagina}
          paginas={paginas}
          desde={desde}
          hasta={hasta}
          total={total}
          onPagina={setPagina}
        />
      )}

      {/* Alta y edición */}
      <Modal
        abierto={formularioAbierto}
        titulo={enEdicion ? 'Editar repuesto' : 'Nuevo repuesto'}
        descripcion="El código es único: no puede repetirse entre repuestos."
        onCerrar={cerrarFormulario}
      >
        {/* key: al cambiar de repuesto el formulario se reinicia con los datos correctos */}
        <FormularioRepuesto
          key={enEdicion?.id ?? 'nuevo'}
          repuesto={enEdicion}
          onGuardar={guardar}
          onCancelar={cerrarFormulario}
        />
      </Modal>

      {/* Ingreso de stock */}
      <Modal
        abierto={Boolean(aIngresar)}
        titulo={`Ingreso de stock · ${aIngresar?.nombre ?? ''}`}
        descripcion={`Stock actual: ${aIngresar?.stock ?? 0} unidades (mínimo ${aIngresar?.stock_minimo ?? 0}).`}
        onCerrar={() => !guardando && setAIngresar(null)}
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

      {/* Desactivar */}
      <Confirmacion
        abierto={Boolean(aDesactivar)}
        titulo="Desactivar repuesto"
        mensaje={`¿Desactivar "${aDesactivar?.nombre ?? ''}"? Deja de aparecer al armar órdenes, pero se conserva en las órdenes anteriores. Podés volver a activarlo cuando quieras.`}
        error={errorDesactivar}
        procesando={procesando}
        textoConfirmar="Desactivar"
        onConfirmar={confirmarDesactivar}
        onCerrar={() => setADesactivar(null)}
      />
    </div>
  )
}
