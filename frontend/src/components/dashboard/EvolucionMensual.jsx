import { useMemo, useState } from 'react'
import { GraficoBarrasDobles } from '@/components/graficos/GraficoBarras'
import TarjetaDash from '@/components/dashboard/TarjetaDash'
import Button from '@/components/ui/Button'
import { nombreMes, pesos } from '@/utils/formato'

const SERIES = [
  { clave: 'ingresos', texto: 'Ingresos', color: 'serie-1' },
  { clave: 'egresos', texto: 'Egresos', color: 'serie-2' },
]

/**
 * Tarjeta "Evolución mensual": barras dobles de ingresos y egresos por mes
 * con leyenda, y un botón que despliega la tabla mes a mes con el balance.
 */
export default function EvolucionMensual({ finanzas, className = '', indice = 0 }) {
  const [tablaVisible, setTablaVisible] = useState(false)
  const datos = finanzas?.datos ?? null

  const barras = useMemo(
    () =>
      (datos?.mensual ?? []).map((m) => ({
        // Las etiquetas del eje quedan cortas: "nov 2026" -> "nov".
        etiqueta: nombreMes(m.mes).split(' ')[0],
        ingresos: Number(m.ingresos ?? 0),
        egresos: Number(m.egresos ?? 0),
        balance: Number(m.balance ?? 0),
        mes: m.mes,
      })),
    [datos],
  )

  return (
    <TarjetaDash
      id="evolucion"
      titulo="Evolución mensual"
      icono="historial"
      indice={indice}
      className={className}
      accion={
        barras.length > 0 ? (
          <Button
            variante="fantasma"
            className="min-h-[40px] px-3"
            aria-expanded={tablaVisible}
            onClick={() => setTablaVisible((v) => !v)}
          >
            {tablaVisible ? 'Ocultar tabla' : 'Ver tabla'}
          </Button>
        ) : null
      }
      cargando={Boolean(finanzas?.cargando && !datos)}
      error={finanzas?.error ?? ''}
      onReintentar={finanzas?.recargar}
    >
      {datos && (
        <>
          {barras.length > 0 ? (
            <>
              <GraficoBarrasDobles
                datos={barras}
                series={SERIES}
                formato={pesos}
                alto={200}
                titulo="Ingresos y egresos por mes"
              />
              {tablaVisible && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[340px] text-sm">
                    <thead className="border-b border-graphite-700 text-left text-muted">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Mes</th>
                        <th className="py-2 pr-3 text-right font-medium">Ingresos</th>
                        <th className="py-2 pr-3 text-right font-medium">Egresos</th>
                        <th className="py-2 text-right font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {barras.map((m) => (
                        <tr key={m.mes} className="border-b border-graphite-700 last:border-0">
                          <td className="py-2 pr-3 text-ink">{nombreMes(m.mes)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{pesos(m.ingresos)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{pesos(m.egresos)}</td>
                          <td
                            className={`py-2 text-right tabular-nums ${
                              m.balance < 0 ? 'text-danger' : 'text-ink'
                            }`}
                          >
                            {pesos(m.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">No hay movimientos en este período.</p>
          )}
        </>
      )}
    </TarjetaDash>
  )
}
