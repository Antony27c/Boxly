import { useMemo, useState } from 'react'
import Vacio from '@/components/ui/Vacio'
import MejorMecanico from '@/components/metricas/MejorMecanico'
import TarjetaDash from '@/components/dashboard/TarjetaDash'
import Odometro from '@/components/graficos/Odometro'
import Termometro from '@/components/graficos/Termometro'
import { horas, pesos } from '@/utils/formato'

const METRICAS = [
  {
    clave: 'facturado',
    texto: 'Facturado',
    formato: pesos,
    valor: (m) => m.facturado,
    mayorEsMejor: true,
  },
  {
    clave: 'cerradas',
    texto: 'Cerradas',
    formato: (v) => v,
    valor: (m) => m.ordenes_cerradas,
    mayorEsMejor: true,
  },
  {
    clave: 'tiempo',
    texto: 'Tiempo promedio',
    formato: horas,
    valor: (m) => m.tiempo_promedio_horas,
    mayorEsMejor: false,
  },
]

const LEDS = 24

// Órdenes que un mecánico lleva a la vez sin que el taller se "recaliente":
// la carga es en curso / (mecánicos × este cupo).
const ORDENES_POR_MECANICO = 3

const CLASE_CHIP = (activo) =>
  `min-h-[40px] shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
    activo
      ? 'border-amber bg-amber/10 text-amber-texto'
      : 'border-graphite-600 text-muted hover:border-graphite-500 hover:text-ink'
  }`

function iniciales(nombre) {
  const partes = String(nombre ?? '')
    .replace(',', ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return partes
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
}

/**
 * Tarjeta "Equipo": ranking de mecánicos ordenado por la métrica elegida
 * (Facturado, Cerradas o Tiempo promedio — en este último menos es mejor),
 * con barra proporcional y la medalla del mejor mecánico del trimestre.
 */
export default function Equipo({ mecanicos, mejor, className = '', indice = 0 }) {
  const [metrica, setMetrica] = useState('facturado')
  const datos = mecanicos?.datos ?? null
  const elegido = METRICAS.find((m) => m.clave === metrica) ?? METRICAS[0]

  const filas = useMemo(() => {
    const lista = (datos ?? []).map((m) => ({ ...m, valor: elegido.valor(m) }))
    const conValor = lista
      .filter((m) => m.valor !== null && m.valor !== undefined)
      .sort((a, b) => (elegido.mayorEsMejor ? b.valor - a.valor : a.valor - b.valor))
    const sinValor = lista.filter((m) => m.valor === null || m.valor === undefined)
    const maximo = Math.max(...conValor.map((m) => Number(m.valor) || 0), 0)
    return { filas: [...conValor, ...sinValor], maximo }
  }, [datos, elegido])

  const mejorDatos = mejor && !mejor.error ? mejor.datos : null
  const enCurso = (datos ?? []).reduce((s, m) => s + (m.ordenes_en_curso ?? 0), 0)
  const capacidad = (datos?.length ?? 0) * ORDENES_POR_MECANICO
  const carga = capacidad ? Math.min(1, enCurso / capacidad) : 0

  return (
    <TarjetaDash
      titulo="Equipo"
      icono="usuarios"
      indice={indice}
      className={className}
      cargando={Boolean(mecanicos?.cargando && !datos)}
      error={mecanicos?.error ?? ''}
      onReintentar={mecanicos?.recargar}
    >
      {datos && (
        <>
          {mejorDatos && (
            <div className="mb-4">
              <MejorMecanico mejor={mejorDatos} />
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Órdenes cerradas</p>
              <div className="mt-1">
                <Odometro
                  valor={datos.reduce((s, m) => s + (m.ordenes_cerradas ?? 0), 0)}
                  enteros={4}
                  etiqueta="Órdenes cerradas del equipo en el período"
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">En curso ahora</p>
              <div className="mt-1">
                <Odometro valor={enCurso} enteros={3} etiqueta="Órdenes en curso del equipo" />
              </div>
            </div>
            {capacidad > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Carga del taller</p>
                <div className="mt-1 flex items-center gap-2">
                  <Termometro fraccion={carga} etiqueta="Carga del taller" className="w-16" />
                  <span className="text-sm font-semibold tabular-nums text-ink" aria-hidden="true">
                    {Math.round(carga * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Ordenar por">
            {METRICAS.map((m) => (
              <button
                key={m.clave}
                type="button"
                aria-pressed={metrica === m.clave}
                onClick={() => setMetrica(m.clave)}
                className={CLASE_CHIP(metrica === m.clave)}
              >
                {m.texto}
                {m.clave === 'tiempo' ? ' (menor es mejor)' : ''}
              </button>
            ))}
          </div>

          {datos.length === 0 ? (
            <div className="mt-4">
              <Vacio
                titulo="Sin mecánicos"
                mensaje="No hay mecánicos con órdenes en este período."
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {filas.filas.map((m, i) => {
                const sinDato = m.valor === null || m.valor === undefined
                const ancho =
                  sinDato || !filas.maximo ? 0 : Math.max((Number(m.valor) / filas.maximo) * 100, 2)
                return (
                  <li key={m.mecanico_id} className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber/15 text-xs font-bold text-amber-texto"
                      aria-hidden="true"
                    >
                      {iniciales(m.nombre)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium text-ink" title={m.nombre}>
                          {m.nombre}
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                          {sinDato ? (
                            <span className="text-xs font-normal text-muted">Sin cerradas</span>
                          ) : (
                            elegido.formato(m.valor)
                          )}
                        </span>
                      </div>
                      {/* Barra de LEDs, como las luces de cambio de un tablero. */}
                      <div
                        className="mt-1.5 flex h-2.5 gap-[2px]"
                        role="img"
                        aria-label={`${m.nombre}: ${sinDato ? 'sin dato' : elegido.formato(m.valor)}`}
                      >
                        {Array.from({ length: LEDS }, (_, j) => {
                          const encendido = j < Math.round((ancho / 100) * LEDS)
                          return (
                            <span
                              key={j}
                              className={`flex-1 rounded-[2px] transition-colors duration-300 ${
                                encendido ? (i === 0 ? 'bg-amber' : 'bg-amber/55') : 'bg-graphite-700'
                              }`}
                              style={{ transitionDelay: `${j * 25}ms` }}
                            />
                          )
                        })}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {m.ordenes_en_curso ?? 0} en curso
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </TarjetaDash>
  )
}
