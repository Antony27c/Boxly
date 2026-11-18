import SieteSegmentos from '@/components/graficos/SieteSegmentos'

/**
 * Cuentakilómetros: el número en un display de 7 segmentos, con ceros a la
 * izquierda. Los decimales van en una celda resaltada, como la décima de un
 * odómetro. `variante="acento"` es para usarlo sobre la tarjeta dorada.
 */
export default function Odometro({ valor, enteros = 4, decimales = 0, unidad = '', etiqueta, variante = 'normal' }) {
  const numero = Math.max(0, Number(valor) || 0)
  const maximo = 10 ** enteros - 10 ** -decimales
  const texto = Math.min(numero, maximo).toFixed(decimales).padStart(enteros + (decimales ? decimales + 1 : 0), '0')

  const acento = variante === 'acento'
  const legible = `${numero.toLocaleString('es-AR', { maximumFractionDigits: decimales })}${unidad ? ` ${unidad}` : ''}`

  return (
    <span className="inline-flex items-center gap-2" role="img" aria-label={etiqueta ? `${etiqueta}: ${legible}` : legible}>
      <span
        aria-hidden="true"
        className={`inline-flex rounded-md text-base bg-sobre-amber px-1.5 py-1 shadow-inner ${acento ? '' : 'border border-graphite-600'}`}
      >
        <SieteSegmentos valor={texto} className="block h-[1.4em]" resaltar={(i) => i >= enteros} />
      </span>
      {unidad && <span className={`text-sm font-medium ${acento ? 'text-sobre-amber/80' : 'text-muted'}`}>{unidad}</span>}
    </span>
  )
}
