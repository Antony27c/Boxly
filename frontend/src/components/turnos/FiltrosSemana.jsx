import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { ESTADOS_TURNO } from '@/services/turnos'
import { ETIQUETAS_ESTADO } from '@/utils/etiquetas'

/* Navegación entre semanas y filtro por estado de la agenda. */
export default function FiltrosSemana({ semana, estadoFiltro, onCambiarEstado }) {
  return (
    <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
      <div className="grid w-full grid-cols-3 items-center gap-2 sm:flex sm:w-auto [&>button]:px-3 sm:[&>button]:px-5">
        <Button variante="secundario" onClick={semana.anterior}>
          ←<span className="hidden sm:inline"> Semana anterior</span>
          <span className="sm:hidden"> Anterior</span>
        </Button>
        <Button variante="fantasma" onClick={semana.actual}>
          Esta semana
        </Button>
        <Button variante="secundario" onClick={semana.siguiente}>
          <span className="hidden sm:inline">Semana siguiente </span>
          <span className="sm:hidden">Siguiente </span>→
        </Button>
      </div>
      <Select
        label="Estado"
        className="w-full sm:w-52"
        value={estadoFiltro}
        data-lectura
        onChange={(e) => onCambiarEstado(e.target.value)}
        opciones={[
          { valor: '', texto: 'Todos los estados' },
          ...ESTADOS_TURNO.map((estado) => ({
            valor: estado,
            texto: ETIQUETAS_ESTADO[estado],
          })),
        ]}
      />
    </div>
  )
}
