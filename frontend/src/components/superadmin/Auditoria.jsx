import { useCallback, useMemo, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Paginacion from '@/components/ui/Paginacion'
import Select from '@/components/ui/Select'
import Vacio from '@/components/ui/Vacio'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import usePaginacion from '@/hooks/usePaginacion'
import useRecurso from '@/hooks/useRecurso'
import { auditoriaService } from '@/services/auditoria'
import { etiquetaRol } from '@/routes/navegacion'

// Entidades que registra el middleware: el primer segmento después de
// /api/v1/ (ver docs/SuperAdmin.md, sección B2).
const ENTIDADES = [
  { valor: 'ordenes', texto: 'Órdenes' },
  { valor: 'clientes', texto: 'Clientes' },
  { valor: 'vehiculos', texto: 'Vehículos' },
  { valor: 'turnos', texto: 'Turnos' },
  { valor: 'repuestos', texto: 'Repuestos' },
  { valor: 'users', texto: 'Usuarios' },
  { valor: 'pagos', texto: 'Pagos' },
  { valor: 'auth', texto: 'Acceso' },
  { valor: 'taller', texto: 'Datos del taller' },
  { valor: 'admin', texto: 'Administración' },
  { valor: 'catalogo', texto: 'Catálogo' },
  { valor: 'mecanicos', texto: 'Mecánicos' },
  { valor: 'portal', texto: 'Portal del cliente' },
  { valor: 'plataforma', texto: 'Plataforma' },
  { valor: 'soporte', texto: 'Soporte' },
  { valor: 'terminos', texto: 'Términos' },
]

// El middleware solo registra métodos que modifican datos.
const METODOS = ['POST', 'PUT', 'PATCH', 'DELETE']

function etiquetaEntidad(valor) {
  return ENTIDADES.find((entidad) => entidad.valor === valor)?.texto ?? valor ?? 'otros'
}

const VERBOS = { POST: 'Creó', PUT: 'Modificó', PATCH: 'Modificó', DELETE: 'Eliminó' }

/* Frase legible de la acción: "Creó en Órdenes", "Modificó Clientes #12",
   "Eliminó Turnos #3". El login tiene texto propio según salga bien o mal. */
function fraseAccion(registro) {
  const ruta = registro.ruta ?? ''
  if (registro.entidad === 'auth' && ruta.includes('login')) {
    return registro.estado_http >= 400
      ? 'Intento de inicio de sesión fallido'
      : 'Inició sesión'
  }
  const verbo = VERBOS[registro.metodo] ?? registro.metodo
  const etiqueta = etiquetaEntidad(registro.entidad)
  if (registro.entidad_id != null) return `${verbo} ${etiqueta} #${registro.entidad_id}`
  return `${verbo} en ${etiqueta}`
}

function tonoEstado(estado) {
  if (estado >= 500) return 'peligro'
  if (estado >= 400) return 'ambar'
  if (estado >= 200 && estado < 300) return 'ok'
  return 'neutro'
}

function fechaHora(iso) {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Quién hizo la acción: el email (o "Sin sesión") y su rol legible.
function Quien({ registro }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-ink">{registro.usuario_email ?? 'Sin sesión'}</p>
      {registro.rol && <p className="truncate text-xs text-muted">{etiquetaRol(registro.rol)}</p>}
    </div>
  )
}

// Ruta técnica en chico y mono: "DELETE /api/v1/turnos/3".
function RutaTecnica({ registro }) {
  return (
    <span className="font-mono text-xs text-muted">
      {registro.metodo} {registro.ruta}
    </span>
  )
}

/* `ambito` elige el registro: 'taller' es la auditoría del propio taller
   (panel del administrador) y 'plataforma' la de todos los talleres
   (superadmin), que además permite filtrar por taller. */
export default function Auditoria({ ambito = 'taller' }) {
  const { token } = useAuth()
  const esPlataforma = ambito === 'plataforma'
  const [entidad, setEntidad] = useState('')
  const [metodo, setMetodo] = useState('')
  const [tallerId, setTallerId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [soloErrores, setSoloErrores] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [errorExportar, setErrorExportar] = useState('')

  const {
    pagina,
    setPagina,
    reiniciar,
    offset,
    limite,
    paginas,
    desde: desdePagina,
    hasta: hastaPagina,
    total,
    setTotal,
  } = usePaginacion()

  // Solo viajan los filtros activos; el listado les suma limit/offset.
  const filtros = useMemo(() => {
    const activos = {}
    if (entidad) activos.entidad = entidad
    if (metodo) activos.metodo = metodo
    if (esPlataforma && tallerId) activos.taller_id = tallerId
    if (desde) activos.desde = desde
    if (hasta) activos.hasta = hasta
    if (soloErrores) activos.solo_errores = true
    return activos
  }, [entidad, metodo, tallerId, esPlataforma, desde, hasta, soloErrores])
  const hayFiltros = Object.keys(filtros).length > 0

  // En plataforma el selector de taller sale de la lista de talleres; se pide
  // directo con api para no depender de services/plataforma.js (otro frente).
  const cargarTalleres = useCallback(
    (t) => (esPlataforma ? api.get('/api/v1/plataforma/talleres?limit=100', t) : Promise.resolve([])),
    [esPlataforma],
  )
  const { datos: talleres } = useRecurso(cargarTalleres)
  const opcionesTalleres = useMemo(
    () => [
      { valor: '', texto: 'Todos los talleres' },
      ...(talleres ?? []).map((t) => ({ valor: String(t.id), texto: t.nombre })),
    ],
    [talleres],
  )

  const cargarAuditoria = useCallback(
    (t) =>
      auditoriaService
        .listar(ambito, { ...filtros, limit: limite, offset }, t)
        .then(({ items, total: cantidad }) => {
          setTotal(cantidad)
          return items
        }),
    [ambito, filtros, limite, offset, setTotal],
  )
  const { datos: registros, cargando, error, recargar } = useRecurso(cargarAuditoria)
  const lista = registros ?? []

  async function exportar() {
    setExportando(true)
    setErrorExportar('')
    try {
      await auditoriaService.exportar(ambito, filtros, token)
    } catch (problema) {
      setErrorExportar(problema.message)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="animate-bay-in">
      <p className="text-sm text-muted">
        {esPlataforma
          ? 'Cada alta, cambio o baja que hace el sistema en todos los talleres queda registrada acá.'
          : 'Cada alta, cambio o baja que hace el sistema en tu taller queda registrada acá, con quién la hizo.'}
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        {esPlataforma && (
          <Select
            label="Taller"
            className="w-full sm:max-w-52"
            value={tallerId}
            onChange={(e) => {
              setTallerId(e.target.value)
              reiniciar()
            }}
            opciones={opcionesTalleres}
          />
        )}
        <Select
          label="Entidad"
          className="w-full sm:max-w-48"
          value={entidad}
          onChange={(e) => {
            setEntidad(e.target.value)
            reiniciar()
          }}
          opciones={[{ valor: '', texto: 'Todas' }, ...ENTIDADES]}
        />
        <Select
          label="Método"
          className="w-full sm:max-w-36"
          value={metodo}
          onChange={(e) => {
            setMetodo(e.target.value)
            reiniciar()
          }}
          opciones={[
            { valor: '', texto: 'Todos' },
            ...METODOS.map((m) => ({ valor: m, texto: m })),
          ]}
        />
        <Field
          label="Desde"
          type="date"
          className="w-full sm:max-w-40"
          value={desde}
          onChange={(e) => {
            setDesde(e.target.value)
            reiniciar()
          }}
        />
        <Field
          label="Hasta"
          type="date"
          className="w-full sm:max-w-40"
          value={hasta}
          onChange={(e) => {
            setHasta(e.target.value)
            reiniciar()
          }}
        />
        <label className="flex items-center gap-2 pb-3 text-sm">
          <input
            type="checkbox"
            checked={soloErrores}
            onChange={(e) => {
              setSoloErrores(e.target.checked)
              reiniciar()
            }}
            className="accent-amber"
          />
          Solo errores
        </label>
        <Button
          variante="secundario"
          icono="descarga"
          cargando={exportando}
          onClick={exportar}
          className="ml-auto"
        >
          Exportar CSV
        </Button>
      </div>

      {errorExportar && (
        <div className="mt-4">
          <Alert>{errorExportar}</Alert>
        </div>
      )}

      {cargando && !registros ? (
        <Loader texto="Cargando auditoría…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : lista.length === 0 ? (
        <div className="mt-6">
          <Vacio
            icono="historial"
            titulo={hayFiltros ? 'Sin resultados' : 'Todavía no hay movimientos'}
            mensaje={
              hayFiltros
                ? 'Probá con otros filtros.'
                : 'Las acciones del sistema (altas, cambios y bajas) se van a ver acá.'
            }
          />
        </div>
      ) : (
        <div className={`mt-6 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
          <div className="hidden overflow-x-auto rounded-box border border-graphite-700 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-graphite-800 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Quién</th>
                  <th className="px-4 py-3 font-medium">Acción</th>
                  <th className="px-4 py-3 font-medium">Ruta</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-700">
                {lista.map((registro) => (
                  <tr key={registro.id} className="transition-colors hover:bg-graphite-800">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {fechaHora(registro.creado_en)}
                    </td>
                    <td className="px-4 py-3">
                      <Quien registro={registro} />
                    </td>
                    <td className="px-4 py-3">
                      <p>{fraseAccion(registro)}</p>
                      {registro.detalle && (
                        <p className="text-xs text-muted">{registro.detalle}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RutaTecnica registro={registro} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge tono={tonoEstado(registro.estado_http)}>{registro.estado_http}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {registro.ip ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* En celular cada fila se apila como una tarjeta. */}
          <ul className="space-y-3 md:hidden">
            {lista.map((registro) => (
              <li
                key={registro.id}
                className="rounded-box border border-graphite-700 bg-graphite-800 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{fraseAccion(registro)}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {fechaHora(registro.creado_en)}
                    </p>
                  </div>
                  <Badge tono={tonoEstado(registro.estado_http)}>{registro.estado_http}</Badge>
                </div>
                <div className="mt-3">
                  <Quien registro={registro} />
                </div>
                <p className="mt-2">
                  <RutaTecnica registro={registro} />
                </p>
                {registro.detalle && <p className="mt-1 text-xs text-muted">{registro.detalle}</p>}
                {registro.ip && (
                  <p className="mt-1 font-mono text-xs text-muted">IP {registro.ip}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {paginas > 1 && !error && lista.length > 0 && (
        <Paginacion
          className="mt-4"
          pagina={pagina}
          paginas={paginas}
          desde={desdePagina}
          hasta={hastaPagina}
          total={total}
          onPagina={setPagina}
        />
      )}
    </div>
  )
}
