import { useCallback, useMemo, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Ficha } from '@/components/ui/Ficha'
import Icono from '@/components/ui/Icono'
import { useAuth } from '@/context/AuthContext'
import { useSoloLectura } from '@/context/SoloLecturaContext'
import useRecurso from '@/hooks/useRecurso'
import { formatearFechaHora } from '@/lib/fechas'
import { repuestosService } from '@/services/repuestos'

/* Avisos internos de stock mínimo sin leer. `habilitado` en false (mecánico)
   no consulta la API: el endpoint es solo de administrador y recepción.
   "Entendido" saca el aviso de la lista cuando la API confirma; si falla,
   queda en la lista con el error a la vista. */
// eslint-disable-next-line react-refresh/only-export-components
export function useAvisosStock(habilitado = true) {
  const { token } = useAuth()
  const cargar = useCallback(
    (t) => (habilitado ? repuestosService.avisos(t) : Promise.resolve([])),
    [habilitado],
  )
  const { datos, cargando, error, recargar } = useRecurso(cargar)
  const [leidos, setLeidos] = useState(() => new Set())
  const [enCurso, setEnCurso] = useState(() => new Set())
  const [errorMarcar, setErrorMarcar] = useState('')

  const avisos = useMemo(
    () => (datos ?? []).filter((aviso) => !aviso.leida_en && !leidos.has(aviso.id)),
    [datos, leidos],
  )

  const marcarLeido = useCallback(
    async (id) => {
      if (enCurso.has(id)) return
      setErrorMarcar('')
      setEnCurso((previos) => new Set(previos).add(id))
      try {
        await repuestosService.marcarLeido(id, token)
        setLeidos((previos) => new Set(previos).add(id))
      } catch (problema) {
        setErrorMarcar(problema.message)
      } finally {
        setEnCurso((previos) => {
          const proximos = new Set(previos)
          proximos.delete(id)
          return proximos
        })
      }
    },
    [enCurso, token],
  )

  return {
    avisos: habilitado ? avisos : [],
    cargando: habilitado && cargando,
    error: habilitado ? error || errorMarcar : '',
    enCurso,
    marcarLeido,
    recargar,
  }
}

function FilaAviso({ aviso, marcando, soloLectura, onEntendido }) {
  return (
    <Ficha
      acento="amber"
      className="!flex-row flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink [overflow-wrap:anywhere]">
          {aviso.mensaje}
        </span>
        <time dateTime={aviso.creado_en} className="mt-1 block text-xs text-muted">
          {formatearFechaHora(aviso.creado_en)}
        </time>
      </span>
      <Button
        variante="secundario"
        className="min-h-10 shrink-0 px-3 py-2 text-xs max-sm:w-full"
        cargando={marcando}
        disabled={soloLectura}
        onClick={() => onEntendido(aviso.id)}
      >
        Entendido
      </Button>
    </Ficha>
  )
}

/* Lista de avisos con su botón "Entendido". Recibe el estado de
   useAvisosStock para que la página comparta el contador con otros lugares. */
export default function AvisosStock({
  avisos,
  error = '',
  enCurso = new Set(),
  onEntendido,
  className = '',
  id = 'avisos-stock',
}) {
  const { activo: soloLectura } = useSoloLectura()
  if (avisos.length === 0 && !error) return null

  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className={`min-w-0 rounded-box border border-graphite-700 bg-graphite-800 p-4 ${className}`}
    >
      <h2 id={`${id}-titulo`} className="flex items-center gap-2 text-sm font-semibold">
        <Icono nombre="alerta" className="h-4 w-4 text-amber-texto" />
        Avisos de stock mínimo
        <Badge tono={avisos.length > 0 ? 'ambar' : 'neutro'}>{avisos.length}</Badge>
      </h2>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {avisos.length > 0 && (
        <ul className="mt-3 space-y-2">
          {avisos.map((aviso) => (
            <FilaAviso
              key={aviso.id}
              aviso={aviso}
              marcando={enCurso.has(aviso.id)}
              soloLectura={soloLectura}
              onEntendido={onEntendido}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
