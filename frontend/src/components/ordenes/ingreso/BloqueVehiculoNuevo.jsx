import Autocomplete from '@/components/ui/Autocomplete'
import Field from '@/components/ui/Field'
import { normalizarPatente } from './formato'

/* Marca, modelo y año del auto de una patente nueva. */
export default function BloqueVehiculoNuevo({ patente, vehiculo, errores, guardando }) {
  return (
    <div className="space-y-4 rounded-box border border-graphite-600 p-4">
      <h4 className="text-sm font-semibold">Vehículo</h4>
      <p className="text-sm text-muted">
        Patente{' '}
        <span className="font-mono font-semibold text-ink">{normalizarPatente(patente)}</span>
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Autocomplete
          label="Marca"
          value={vehiculo.form.marca}
          onChange={(valor) => vehiculo.cambiar('marca', valor)}
          buscar={vehiculo.buscarMarcas}
          error={errores.marca}
          disabled={guardando}
          placeholder="Ej.: Ford"
          sinResultados="No está en el catálogo, podés escribirla igual."
        />
        <Autocomplete
          label="Modelo"
          value={vehiculo.form.modelo}
          onChange={(valor) => vehiculo.cambiar('modelo', valor)}
          buscar={vehiculo.buscarModelos}
          error={errores.modelo}
          disabled={guardando}
          placeholder="Ej.: Focus"
          sinResultados="No está en el catálogo, podés escribirlo igual."
        />
        <Field
          label="Año (opcional)"
          inputMode="numeric"
          value={vehiculo.form.anio}
          onChange={(e) => vehiculo.cambiar('anio', e.target.value)}
          error={errores.anio}
          disabled={guardando}
          placeholder="Ej.: 2018"
        />
      </div>
    </div>
  )
}
