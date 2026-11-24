import Autocomplete from '@/components/ui/Autocomplete'
import Field from '@/components/ui/Field'
import { nombrePersona } from './formato'

/* Cliente de una patente nueva: uno que ya existe (buscado) o uno nuevo. */
export default function BloqueCliente({ cliente, errores, guardando }) {
  return (
    <div className="space-y-3 rounded-box border border-graphite-600 p-4">
      <h4 className="text-sm font-semibold">Cliente</h4>
      {errores.cliente && <p className="text-sm text-danger">{errores.cliente}</p>}
      {cliente.elegido ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            {nombrePersona(cliente.elegido)}
            {cliente.elegido.dni ? (
              <span className="text-muted"> · DNI {cliente.elegido.dni}</span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={cliente.limpiar}
            className="shrink-0 text-sm text-amber-texto hover:underline"
          >
            Cambiar
          </button>
        </div>
      ) : cliente.modo === 'nuevo' ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Nombre"
              value={cliente.form.nombre}
              onChange={(e) => cliente.cambiarForm('nombre', e.target.value)}
              error={errores.clienteNombre}
              disabled={guardando}
              placeholder="Ej.: Juan"
            />
            <Field
              label="Apellido"
              value={cliente.form.apellido}
              onChange={(e) => cliente.cambiarForm('apellido', e.target.value)}
              error={errores.clienteApellido}
              disabled={guardando}
              placeholder="Ej.: Pérez"
            />
            <Field
              label="DNI"
              inputMode="numeric"
              value={cliente.form.dni}
              onChange={(e) => cliente.cambiarForm('dni', e.target.value)}
              error={errores.clienteDni}
              disabled={guardando}
              placeholder="Ej.: 20111222"
            />
            <Field
              label="Teléfono (opcional)"
              inputMode="tel"
              value={cliente.form.telefono}
              onChange={(e) => cliente.cambiarForm('telefono', e.target.value)}
              error={errores.clienteTelefono}
              disabled={guardando}
              placeholder="Ej.: 3874112233"
            />
          </div>
          <button
            type="button"
            onClick={() => cliente.setModo('buscar')}
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            ← Buscar un cliente que ya existe
          </button>
        </>
      ) : (
        <>
          <Autocomplete
            label="Cliente"
            value={cliente.texto}
            onChange={cliente.setTexto}
            onElegir={cliente.elegir}
            buscar={cliente.buscar}
            minimo={2}
            disabled={guardando}
            placeholder="Nombre o DNI"
            sinResultados="No aparece: podés cargarlo como cliente nuevo."
          />
          <button
            type="button"
            onClick={() => cliente.setModo('nuevo')}
            className="text-sm text-amber-texto transition-colors hover:underline"
          >
            Es un cliente nuevo
          </button>
        </>
      )}
    </div>
  )
}
