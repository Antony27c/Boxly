import { useSearchParams } from 'react-router-dom'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Auditoria from '@/components/superadmin/Auditoria'
import ConfigTaller from '@/components/superadmin/ConfigTaller'
import ResumenSistema from '@/components/superadmin/ResumenSistema'

// Panel de control del superadmin. Cada pestaña es un componente propio;
// la pestaña activa queda en la URL (?pestana=) para poder compartirla.
const PESTANAS = [
  { id: 'resumen', texto: 'Resumen', Componente: ResumenSistema },
  { id: 'auditoria', texto: 'Auditoría', Componente: Auditoria },
  { id: 'taller', texto: 'Datos del taller', Componente: ConfigTaller },
]

export default function Admin() {
  const [parametros, setParametros] = useSearchParams()
  const activa = PESTANAS.find((p) => p.id === parametros.get('pestana')) ?? PESTANAS[0]
  const { Componente } = activa

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Panel de control"
        descripcion="Estado del sistema, registro de acciones y datos del taller."
        icono="ajustes"
      />
      <div role="tablist" aria-label="Secciones del panel" className="flex flex-wrap gap-2 border-b border-[var(--borde,#e5e7eb)]">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === activa.id}
            onClick={() => setParametros({ pestana: p.id }, { replace: true })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              p.id === activa.id ? 'border-current' : 'border-transparent opacity-70 hover:opacity-100'
            }`}
          >
            {p.texto}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        <Componente />
      </div>
    </div>
  )
}
