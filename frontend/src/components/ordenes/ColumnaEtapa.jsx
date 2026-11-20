import { useEffect, useId, useRef, useState } from 'react'
import TarjetaOrden from '@/components/ordenes/TarjetaOrden'
import Badge from '@/components/ui/Badge'
import Icono from '@/components/ui/Icono'
import { DESCRIPCION_ESTADOS } from '@/services/ordenes'
import '@/styles/ordenes.css'

// Quién hace avanzar cada etapa, para la ayuda del encabezado.
const QUIEN_MUEVE = {
  Pendiente: 'La mueve recepción al recibir el auto.',
  Ingresado: 'La asigna recepción; el mecánico arranca el diagnóstico.',
  'En diagnóstico': 'La mueve el mecánico.',
  'Esperando repuestos': 'La mueve el mecánico.',
  Listo: 'La cierra recepción o administración al entregar el auto.',
}

export function IconoInfo({ estado, titulo, tooltipAlaDerecha = false }) {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef(null)
  const id = useId()
  const descripcion = DESCRIPCION_ESTADOS[estado]

  useEffect(() => {
    if (!abierto) return undefined
    function alClickAfuera(evento) {
      if (contenedor.current && !contenedor.current.contains(evento.target)) setAbierto(false)
    }
    function alTeclado(evento) {
      if (evento.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', alClickAfuera)
    document.addEventListener('keydown', alTeclado)
    return () => {
      document.removeEventListener('mousedown', alClickAfuera)
      document.removeEventListener('keydown', alTeclado)
    }
  }, [abierto])

  return (
    <span ref={contenedor} className="relative inline-flex">
      <button
        type="button"
        aria-label={`Qué significa la etapa ${titulo}`}
        aria-expanded={abierto}
        aria-describedby={abierto ? id : undefined}
        title={descripcion}
        onClick={() => setAbierto((valor) => !valor)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-graphite-500 text-xs italic text-muted transition-colors hover:border-amber hover:text-amber-texto"
      >
        i
      </button>
      {abierto && (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-6 z-30 w-56 rounded-box border border-graphite-600 bg-graphite-800 p-3 text-xs font-normal normal-case text-muted shadow-lift ${
            tooltipAlaDerecha ? 'right-0' : 'left-1/2 -translate-x-1/2'
          }`}
        >
          {descripcion}
          {QUIEN_MUEVE[estado] && <span className="mt-1 block text-ink">{QUIEN_MUEVE[estado]}</span>}
        </span>
      )}
    </span>
  )
}

// Panel de la etapa activa: en escritorio ocupa el espacio libre a la
// derecha de la lista de etapas y muestra las tarjetas en grilla; en celular
// ocupa todo el ancho bajo las pestañas. El tablero lo remonta al cambiar de
// etapa (key={etapa}), así la animación de entrada se repite en cada cambio.
export default function ColumnaEtapa({
  estado,
  titulo,
  icono,
  numero,
  textoVacio,
  ordenes = [],
  vehiculosPorId,
  clientesPorId,
  usuario,
  onAccion,
  onEditar,
  onEliminar,
  className = '',
}) {
  return (
    <section
      aria-label={titulo}
      className={`box-taller min-w-0 flex-1 md:rounded-box md:border-2 md:border-dashed md:border-amber/30 md:p-4 ${className}`}
    >
      {numero && (
        <div aria-hidden="true" className="mb-1.5 flex items-center gap-2 px-1 max-md:hidden">
          <span className="font-mono text-[0.65rem] font-bold tracking-[0.2em] text-amber-texto">
            BOX {numero}
          </span>
          <span className="h-0.5 flex-1 rounded-full bg-amber/30" />
        </div>
      )}
      <header className="mb-2 flex items-center gap-1.5 px-1 max-md:hidden">
        {icono && <Icono nombre={icono} className="h-4 w-4 shrink-0 text-amber-texto" />}
        <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
        {/* key={cantidad}: al cambiar el número el badge se remonta y el pop se repite. */}
        <Badge key={ordenes.length} tono="neutro" className="animate-pop-in">
          {ordenes.length}
        </Badge>
        <IconoInfo estado={estado} titulo={titulo} />
      </header>
      {ordenes.length === 0 ? (
        <p className="px-1 text-sm text-muted">{textoVacio}</p>
      ) : (
        <ul className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 2xl:grid-cols-3">
          {ordenes.map((orden) => {
            const vehiculo = vehiculosPorId?.get(orden.vehiculo_id)
            const cliente = vehiculo ? clientesPorId?.get(vehiculo.cliente_id) : null
            return (
              <TarjetaOrden
                key={orden.id}
                orden={orden}
                vehiculo={vehiculo}
                cliente={cliente}
                usuario={usuario}
                onAccion={onAccion}
                onEditar={onEditar}
                onEliminar={onEliminar}
              />
            )
          })}
        </ul>
      )}
    </section>
  )
}
