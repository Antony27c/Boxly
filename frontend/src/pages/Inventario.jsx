import { useCallback, useMemo, useState } from 'react'
import FormularioRepuesto from '@/components/inventario/FormularioRepuesto'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
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
  const numero = Number(valor ?? 0)
  // Con centavos se muestran siempre 2 decimales ($ 45.999,50); sin centavos, ninguno ($ 50.000)
  const decimales = Number.isInteger(numero) ? 0 : 2
  return `$ ${numero.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`
}

export default function Inventario() {
  const { token, usuario } = useAuth()
  const puedeEditar = tieneAcceso(ROLES_MOSTRADOR, usuario?.rol)

  // ---------- Filtros ----------
  const [busqueda, setBusqueda] = useState('')
  const [soloBajo, setSoloBajo] = useState(false)
  const [verInactivos, setVerInactivos] = useState(false)

  // ---------- Alta / edición ----------
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState(null)

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

  // Al tildar "Mostrar inactivos" cambia la función de carga y useRecurso vuelve a pedir los datos
  const cargar = useCallback(
    (t) => (verInactivos ? repuestosService.listarTodos(t) : repuestosService.listar(t)),
    [verInactivos],
  )
  const { datos: repuestos, cargando, error, recargar } = useRecurso(cargar)

  // La alerta de stock bajo solo cuenta repuestos activos
  const conStockBajo = useMemo(
    () => (repuestos ?? []).filter((r) => r.activo !== false && tieneStockBajo(r)),
    [repuestos],
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
    if (enEdicion) {
      await repuestosService.actualizar(enEdicion.id, datosRepuesto, token)
      setAviso('Repuesto actualizado.')
    } else {
      await repuestosService.crear(datosRepuesto, token)
      setAviso('Repuesto creado.')
    }
    setFormularioAbierto(false)
    setEnEdicion(null)
    await recargar()
  }

  // ---------- Activar / desactivar ----------
  async function activar(repuesto) {
    setErrorAccion('')
    setAviso('')
    try {
      await repuestosService.cambiarEstado(repuesto.id, true, token)
      setAviso(`"${repuesto.nombre}" volvió a estar activo.`)
      await recargar()
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
      await recargar()
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
          <Vacio
            titulo="Sin repuestos para mostrar"
            mensaje="Probá con otra búsqueda, sacá el filtro o cargá un repuesto nuevo."
            accion={puedeEditar ? <Button onClick={abrirNuevo}>Nuevo repuesto</Button> : undefined}
          />
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
                const inactivo = repuesto.activo === false
                const bajo = !inactivo && tieneStockBajo(repuesto)
                return (
                  <tr
                    key={repuesto.id}
                    className={`border-b border-graphite-700 last:border-0 ${inactivo ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{repuesto.codigo}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">
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
      )}

      {/* Alta y edición */}
      <Modal
        abierto={formularioAbierto}
        titulo={enEdicion ? 'Editar repuesto' : 'Nuevo repuesto'}
        descripcion="El código es único: no puede repetirse entre repuestos."
        onCerrar={() => setFormularioAbierto(false)}
      >
        {/* key: al cambiar de repuesto el formulario se reinicia con los datos correctos */}
        <FormularioRepuesto
          key={enEdicion?.id ?? 'nuevo'}
          repuesto={enEdicion}
          onGuardar={guardar}
          onCancelar={() => setFormularioAbierto(false)}
        />
      </Modal>

      {/* Ingreso de stock */}
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
