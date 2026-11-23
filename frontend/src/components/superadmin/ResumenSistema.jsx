import { useCallback } from 'react'
import TarjetaDash from '@/components/dashboard/TarjetaDash'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Icono from '@/components/ui/Icono'
import Loader from '@/components/ui/Loader'
import useRecurso from '@/hooks/useRecurso'
import { etiquetaRol } from '@/routes/navegacion'
import { sistemaService } from '@/services/sistema'

// Conteos del sistema (docs/SuperAdmin.md, B4). "Órdenes abiertas" va primera
// y con tarjeta de acento: es el número que hay que mirar todos los días.
const CONTEOS = [
  { clave: 'ordenes_abiertas', texto: 'Órdenes abiertas', icono: 'ordenes', acento: true },
  { clave: 'ordenes', texto: 'Órdenes', icono: 'ordenes' },
  { clave: 'usuarios', texto: 'Usuarios', icono: 'usuarios' },
  { clave: 'clientes', texto: 'Clientes', icono: 'clientes' },
  { clave: 'vehiculos', texto: 'Vehículos', icono: 'vehiculos' },
  { clave: 'turnos', texto: 'Turnos', icono: 'turnos' },
  { clave: 'repuestos', texto: 'Repuestos', icono: 'inventario' },
  { clave: 'pagos', texto: 'Pagos', icono: 'dinero' },
]

const INTEGRACIONES = [
  { clave: 'email', texto: 'Email', icono: 'correo' },
  { clave: 'mercadopago', texto: 'Mercado Pago', icono: 'dinero' },
  { clave: 'rate_limit', texto: 'Límite de intentos', icono: 'info' },
]

// Estados posibles de un taller (docs/Plataforma.md): activo y suspendido hoy;
// cualquier otro se muestra con la primera letra en mayúscula.
const ETIQUETAS_TALLER = { activo: 'Activo', suspendido: 'Suspendido' }

function numero(valor) {
  return Number(valor ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

// "3,3 MB" / "850 KB" / "512 B": la unidad más legible según el tamaño.
function tamanoLegible(bytes) {
  const n = Number(bytes ?? 0)
  if (n >= 1024 * 1024) {
    return `${(n / (1024 * 1024)).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`
  }
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${numero(n)} B`
}

// Fila de definición de la cabecera: etiqueta chica arriba, dato abajo.
function Dato({ etiqueta, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{etiqueta}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{children}</dd>
    </div>
  )
}

// Luz de estado con texto (no solo color): verde si responde, roja si no.
function EstadoBase({ db }) {
  const ok = Boolean(db?.ok)
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-ok' : 'bg-danger'}`}
      />
      <span>{ok ? 'Conectada' : 'Sin conexión'}</span>
      {db?.motor && <span className="font-normal text-muted">· {db.motor}</span>}
    </span>
  )
}

function Roles({ porRol }) {
  const roles = Object.entries(porRol ?? {})
  if (roles.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay usuarios.</p>
  }
  return (
    <ul className="divide-y divide-graphite-700">
      {roles.map(([rol, cantidad]) => (
        <li key={rol} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <span className="text-sm text-ink">{etiquetaRol(rol)}</span>
          <Badge>{numero(cantidad)}</Badge>
        </li>
      ))}
    </ul>
  )
}

function etiquetaEstadoTaller(estado) {
  const clave = String(estado ?? '').toLowerCase()
  return ETIQUETAS_TALLER[clave] ?? (clave ? clave[0].toUpperCase() + clave.slice(1) : '—')
}

/* "talleres por estado" del sistema de plataforma: puede venir como mapa
   { activo: 2, suspendido: 1 } o como lista [{ estado, total }]; se normaliza
   a filas [estado, cantidad]. */
function filasTalleres(talleres) {
  if (Array.isArray(talleres)) {
    return talleres.map((t) => [t.estado ?? t.nombre, t.total ?? t.cantidad ?? 0])
  }
  return Object.entries(talleres ?? {})
}

function Talleres({ datos }) {
  const filas = filasTalleres(datos)
  if (filas.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay talleres.</p>
  }
  return (
    <ul className="divide-y divide-graphite-700">
      {filas.map(([estado, cantidad]) => (
        <li key={estado} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <span className="text-sm text-ink">{etiquetaEstadoTaller(estado)}</span>
          <Badge>{numero(cantidad)}</Badge>
        </li>
      ))}
    </ul>
  )
}

function Integraciones({ datos }) {
  return (
    <ul className="divide-y divide-graphite-700">
      {INTEGRACIONES.map((integracion) => {
        const configurada = Boolean(datos?.[integracion.clave])
        return (
          <li
            key={integracion.clave}
            className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
          >
            <Icono nombre={integracion.icono} className="h-4 w-4 shrink-0 text-amber" />
            <span className="min-w-0 flex-1 text-sm text-ink">{integracion.texto}</span>
            <Badge tono={configurada ? 'ok' : 'neutro'}>
              {configurada ? 'Configurado' : 'Sin configurar'}
            </Badge>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Salud de la plataforma (superadmin, docs/Plataforma.md P3): estado del
 * sistema, conteos agregados de todos los talleres, talleres por estado,
 * usuarios por rol, espacio de fotos e integraciones. Sin botón de respaldo:
 * la descarga de datos del propio taller vive en RespaldoTaller.
 */
export default function ResumenSistema() {
  const cargar = useCallback((t) => sistemaService.obtener(t), [])
  const { datos, error, recargar } = useRecurso(cargar)

  if (!datos) {
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
    return <Loader texto="Cargando el sistema…" />
  }

  const conteos = datos.conteos ?? {}
  const uploads = datos.uploads ?? {}

  return (
    <div className="space-y-5">
      <TarjetaDash titulo="Estado del sistema" icono="info" indice={0}>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Versión">{datos.version ?? '—'}</Dato>
          <Dato etiqueta="Entorno">{datos.entorno ?? '—'}</Dato>
          <Dato etiqueta="Base de datos">
            <EstadoBase db={datos.db} />
          </Dato>
          <Dato etiqueta="Revisión de migración">
            <span className="font-mono text-xs font-semibold">
              {datos.db?.revision ?? '—'}
            </span>
          </Dato>
        </dl>
      </TarjetaDash>

      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        {CONTEOS.map((item, indice) => (
          <TarjetaDash
            key={item.clave}
            titulo={item.texto}
            icono={item.icono}
            acento={item.acento}
            indice={indice + 1}
          >
            <p
              className={`text-4xl font-semibold tracking-tight tabular-nums ${
                item.acento ? 'text-sobre-amber' : 'text-ink'
              }`}
            >
              {numero(conteos[item.clave])}
            </p>
          </TarjetaDash>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <TarjetaDash titulo="Usuarios por rol" icono="usuarios" indice={9}>
          <Roles porRol={datos.usuarios_por_rol} />
        </TarjetaDash>

        <TarjetaDash titulo="Talleres" icono="herramienta" indice={10}>
          <Talleres datos={datos.talleres} />
        </TarjetaDash>

        <TarjetaDash titulo="Fotos subidas" icono="foto" indice={11}>
          <p className="text-4xl font-semibold tracking-tight tabular-nums text-ink">
            {tamanoLegible(uploads.bytes)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {numero(uploads.archivos)} {Number(uploads.archivos ?? 0) === 1 ? 'archivo' : 'archivos'}
          </p>
        </TarjetaDash>

        <TarjetaDash titulo="Integraciones" icono="ajustes" indice={12}>
          <Integraciones datos={datos.integraciones} />
        </TarjetaDash>
      </div>
    </div>
  )
}
