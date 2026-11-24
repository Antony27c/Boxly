import Patente from '@/components/ui/Patente'
import { iniciales } from '@/utils/ficha'

// Modelo del auto como título, la marca chica en dorado arriba y la patente
// como chapa al lado. Sin patente queda `sinPatente` (p. ej. "Orden #id").
export function DatoVehiculo({ marca, modelo, patente, sinPatente = null }) {
  const titulo = modelo || marca
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
      {titulo && (
        <span className="min-w-0 leading-tight">
          {modelo && marca && (
            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-texto">
              {marca}
            </span>
          )}
          <span className="block truncate text-base font-extrabold tracking-tight text-ink">{titulo}</span>
        </span>
      )}
      {patente ? <Patente valor={patente} tamano="sm" className="shrink-0" /> : sinPatente}
    </span>
  )
}

// Segunda línea: avatar chico con iniciales, el nombre y el detalle en gris.
// `persona` ({ nombre, apellido } o texto) arma las iniciales; por defecto, el nombre.
export function LineaPersona({ nombre, persona = nombre, detalle }) {
  const letras = iniciales(persona)
  if (!nombre && !detalle) return null
  return (
    <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted">
      {letras && (
        <span
          aria-hidden="true"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber/15 text-[10px] font-bold text-amber-texto"
        >
          {letras}
        </span>
      )}
      {nombre && <span className="max-w-[55%] shrink-0 truncate font-semibold text-ink">{nombre}</span>}
      {detalle && <span className="min-w-0 truncate">{nombre ? `· ${detalle}` : detalle}</span>}
    </span>
  )
}

export function DatoOrden({ orden, detalle = '' }) {
  return (
    <>
      <DatoVehiculo
        marca={orden.vehiculo_marca}
        modelo={orden.vehiculo_modelo}
        patente={orden.vehiculo_patente}
        sinPatente={
          <span className="font-mono text-sm font-semibold text-amber-texto">Orden #{orden.id}</span>
        }
      />
      <LineaPersona
        nombre={orden.cliente_nombre}
        detalle={[orden.descripcion, detalle].filter(Boolean).join(' · ')}
      />
    </>
  )
}
