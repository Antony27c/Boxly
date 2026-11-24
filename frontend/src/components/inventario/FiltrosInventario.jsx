import Field from '@/components/ui/Field'

/* Búsqueda, "Sólo stock bajo" y (para quien edita) "Mostrar inactivos". */
export default function FiltrosInventario({ filtros, puedeEditar }) {
  return (
    <div className="mt-6 flex flex-wrap items-end gap-4">
      <Field
        label="Buscar por nombre o código"
        data-lectura
        type="search"
        className="w-full sm:max-w-sm"
        placeholder="Ej.: Filtro de aceite"
        value={filtros.busqueda}
        onChange={(e) => filtros.setBusqueda(e.target.value)}
      />
      <label className="flex items-center gap-2 pb-3 text-sm">
        <input
          type="checkbox"
          checked={filtros.soloBajo}
          onChange={(e) => filtros.setSoloBajo(e.target.checked)}
          className="accent-amber"
        />
        Sólo stock bajo
      </label>
      {puedeEditar && (
        <label className="flex items-center gap-2 pb-3 text-sm">
          <input
            type="checkbox"
            checked={filtros.verInactivos}
            onChange={(e) => filtros.setVerInactivos(e.target.checked)}
            className="accent-amber"
          />
          Mostrar inactivos
        </label>
      )}
    </div>
  )
}
