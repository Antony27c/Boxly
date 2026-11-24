import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import { hoyAR } from '@/lib/fechas'
import EncabezadoPaso from './EncabezadoPaso'
import { SUGERENCIAS_TRABAJO } from './formato'

/* Paso 2: qué trabajo se hace, con chips de sugerencias, mecánico y entrega. */
export default function PasoTrabajo({ trabajo, errores, guardando }) {
  return (
    <section className="space-y-4">
      <EncabezadoPaso numero={2} texto="¿Qué trabajo hacemos?" />
      <div className="flex flex-wrap gap-2">
        {SUGERENCIAS_TRABAJO.map((sugerencia) => (
          <button
            key={sugerencia}
            type="button"
            onClick={() => trabajo.agregarChip(sugerencia)}
            disabled={guardando}
            className="rounded-full border border-graphite-600 px-3 py-1 text-xs text-muted transition-colors hover:border-amber hover:text-amber-texto"
          >
            {sugerencia}
          </button>
        ))}
      </div>
      <Textarea
        label="Trabajo a realizar"
        value={trabajo.texto}
        onChange={(e) => trabajo.cambiar(e.target.value)}
        error={errores.trabajo}
        disabled={guardando}
        placeholder="Service completo: aceite, filtros y revisión de frenos."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Mecánico (opcional)"
          value={trabajo.mecanicoId}
          onChange={(e) => trabajo.setMecanicoId(e.target.value)}
          disabled={guardando}
          opciones={[
            { valor: '', texto: 'Sin asignar' },
            ...trabajo.mecanicos.map((mecanico) => ({
              valor: mecanico.id,
              texto: `${mecanico.apellido}, ${mecanico.nombre}`,
            })),
          ]}
        />
        <Field
          label="Entrega estimada (opcional)"
          type="date"
          min={hoyAR()}
          value={trabajo.entrega}
          onChange={(e) => trabajo.setEntrega(e.target.value)}
          disabled={guardando}
        />
      </div>
    </section>
  )
}
