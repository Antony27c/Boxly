// Segmentos encendidos por carácter (a arriba, b arriba derecha, c abajo
// derecha, d abajo, e abajo izquierda, f arriba izquierda, g medio).
const SEGMENTOS = {
  0: 'abcdef',
  1: 'bc',
  2: 'abdeg',
  3: 'abcdg',
  4: 'bcfg',
  5: 'acdfg',
  6: 'acdefg',
  7: 'abc',
  8: 'abcdefg',
  9: 'abcdfg',
  '-': 'g',
  ' ': '',
}

// Geometría de una celda: 10 x 18 unidades, segmentos de 2 de grosor y una
// columna extra a la derecha para el punto decimal.
const ANCHO = 10
const ALTO = 18
const GROSOR = 2
const HUECO = 0.5
const PASO = 13
const INCLINACION = 6
const CORRIMIENTO = Math.tan((INCLINACION * Math.PI) / 180) * ALTO

const f2 = (v) => Math.round(v * 100) / 100

function horizontal(x, y, largo) {
  const m = GROSOR / 2
  return [
    [x, y],
    [x + m, y - m],
    [x + largo - m, y - m],
    [x + largo, y],
    [x + largo - m, y + m],
    [x + m, y + m],
  ]
}

function vertical(x, y, largo) {
  const m = GROSOR / 2
  return [
    [x, y],
    [x + m, y + m],
    [x + m, y + largo - m],
    [x, y + largo],
    [x - m, y + largo - m],
    [x - m, y + m],
  ]
}

const izq = GROSOR / 2
const der = ANCHO - GROSOR / 2
const medio = ALTO / 2
const largoH = der - izq - 2 * HUECO
const largoV = medio - izq - 2 * HUECO

const FORMAS = {
  a: horizontal(izq + HUECO, izq, largoH),
  b: vertical(der, izq + HUECO, largoV),
  c: vertical(der, medio + HUECO, largoV),
  d: horizontal(izq + HUECO, ALTO - izq, largoH),
  e: vertical(izq, medio + HUECO, largoV),
  f: vertical(izq, izq + HUECO, largoV),
  g: horizontal(izq + HUECO, medio, largoH),
}

const puntos = (forma, dx) => forma.map(([x, y]) => `${f2(x + dx)},${f2(y)}`).join(' ')

// Separa el texto en celdas: cada dígito ocupa una y la coma o el punto se
// enciende en la celda anterior, como en los displays de verdad.
function celdas(valor) {
  const lista = []
  for (const c of String(valor)) {
    if (c === ',' || c === '.') {
      if (lista.length === 0) lista.push({ caracter: ' ', punto: false })
      lista[lista.length - 1].punto = true
    } else {
      lista.push({ caracter: SEGMENTOS[c] === undefined ? ' ' : c, punto: false })
    }
  }
  return lista
}

/**
 * Display de 7 segmentos en SVG. Es decorativo (aria-hidden): el valor
 * legible va en el aria-label del contenedor. Los segmentos apagados quedan
 * visibles muy tenues; `resaltar` recibe el índice de celda y devuelve true
 * para las que llevan fondo (por ejemplo, la décima de un odómetro).
 * Se puede anidar dentro de otro SVG pasando x, y, width y height.
 */
export default function SieteSegmentos({
  valor,
  className = '',
  encendido = 'fill-amber',
  apagado = 'fill-amber/10',
  fondoResaltado = 'fill-amber/15',
  resaltar,
  ...resto
}) {
  const lista = celdas(valor)
  // Un margen de 1 alrededor para que el fondo resaltado no se recorte.
  const ancho = f2(Math.max(1, lista.length) * PASO + 1 + CORRIMIENTO)
  const alto = ALTO + 2
  const anidado = resto.width !== undefined || resto.height !== undefined

  return (
    <svg
      viewBox={`-1 -1 ${ancho} ${alto}`}
      className={className}
      style={anidado ? undefined : { aspectRatio: `${ancho} / ${alto}` }}
      aria-hidden="true"
      focusable="false"
      data-valor={lista.map((c) => c.caracter + (c.punto ? '.' : '')).join('')}
      {...resto}
    >
      <g transform={`translate(${f2(CORRIMIENTO)} 0) skewX(-${INCLINACION})`}>
        {lista.map((c, i) => {
          const dx = i * PASO
          const prendidos = SEGMENTOS[c.caracter]
          return (
            <g key={i} data-digito={c.caracter}>
              {resaltar?.(i) && (
                <rect x={dx - 1} y={-1} width={ANCHO + 2} height={ALTO + 2} rx="1.5" className={fondoResaltado} />
              )}
              {Object.entries(FORMAS).map(([nombre, forma]) => {
                const prendido = prendidos.includes(nombre)
                return (
                  <polygon
                    key={nombre}
                    points={puntos(forma, dx)}
                    data-segmento={nombre}
                    data-encendido={prendido ? 'true' : 'false'}
                    className={prendido ? encendido : apagado}
                  />
                )
              })}
              <circle
                cx={dx + ANCHO + 1.4}
                cy={ALTO - izq}
                r={GROSOR / 2 + 0.1}
                data-segmento="punto"
                data-encendido={c.punto ? 'true' : 'false'}
                className={c.punto ? encendido : apagado}
              />
            </g>
          )
        })}
      </g>
    </svg>
  )
}
