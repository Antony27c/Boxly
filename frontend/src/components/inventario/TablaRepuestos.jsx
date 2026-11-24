import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { tieneStockBajo } from '@/services/repuestos'
import { pesos } from '@/utils/formato'
import VarillaStock from './VarillaStock'

/* Escritorio: tabla de repuestos con stock, mínimo y acciones. La columna de
   precio la ve solo quien edita: el mecánico no ve montos (MC1). */
export default function TablaRepuestos({ repuestos, cargando, puedeEditar, acciones }) {
  return (
    <div
      className={`mt-6 hidden overflow-x-auto rounded-box border border-graphite-700 bg-graphite-800 transition-opacity sm:block ${
        cargando ? 'opacity-60' : ''
      }`}
    >
      <table className="w-full text-left text-sm">
        <thead className="border-b border-graphite-700 text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Código</th>
            <th className="px-4 py-3 font-medium">Repuesto</th>
            {puedeEditar && <th className="px-4 py-3 text-right font-medium">Precio</th>}
            <th className="px-4 py-3 text-right font-medium">Stock</th>
            <th className="px-4 py-3 text-right font-medium">Mínimo</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {repuestos.map((repuesto) => {
            const inactivo = repuesto.activo === false
            const bajo = !inactivo && tieneStockBajo(repuesto)
            return (
              <tr
                key={repuesto.id}
                className={`border-b border-graphite-700 last:border-0 ${inactivo ? 'opacity-60' : ''}`}
              >
                <td className="px-4 py-3 font-mono text-xs">{repuesto.codigo}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">
                    {repuesto.nombre}
                    {inactivo && (
                      <span className="ml-2">
                        <Badge tono="neutro">Inactivo</Badge>
                      </span>
                    )}
                  </p>
                  {repuesto.descripcion && <p className="text-xs text-muted">{repuesto.descripcion}</p>}
                </td>
                {puedeEditar && <td className="px-4 py-3 text-right">{pesos(repuesto.precio)}</td>}
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                    <VarillaStock stock={repuesto.stock} minimo={repuesto.stock_minimo} />
                    <span className={bajo ? 'font-semibold text-danger' : 'font-semibold'}>
                      {repuesto.stock}
                    </span>
                    {bajo && <Badge tono="peligro">{repuesto.stock === 0 ? 'Sin stock' : 'Stock bajo'}</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-muted">{repuesto.stock_minimo}</td>
                <td className="px-4 py-3 text-right">
                  {puedeEditar && (
                    <div className="flex flex-wrap justify-end gap-1">
                      {!inactivo && (
                        <Button variante="secundario" onClick={() => acciones.ingresar(repuesto)}>
                          Ingresar stock
                        </Button>
                      )}
                      <Button variante="fantasma" onClick={() => acciones.editar(repuesto)}>
                        Editar
                      </Button>
                      {inactivo ? (
                        <Button variante="fantasma" onClick={() => acciones.activar(repuesto)}>
                          Activar
                        </Button>
                      ) : (
                        <Button variante="fantasma" onClick={() => acciones.desactivar(repuesto)}>
                          Desactivar
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
