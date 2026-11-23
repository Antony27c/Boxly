import { useSearchParams } from 'react-router-dom'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Auditoria from '@/components/superadmin/Auditoria'
import ConfigTaller from '@/components/superadmin/ConfigTaller'
import RespaldoTaller from '@/components/superadmin/RespaldoTaller'

// Panel del taller del administrador (ruta /admin, ROLES_ADMIN): datos del
// taller, auditoría del propio taller y respaldo de sus datos
// (docs/Plataforma.md, P3). Cada pestaña es un componente propio; la pestaña
// activa queda en la URL (?pestana=) para poder compartirla.
const PESTANAS = [
  { id: 'taller', texto: 'Datos del taller', Componente: ConfigTaller },
  { id: 'auditoria', texto: 'Auditoría', Componente: Auditoria, props: { ambito: 'taller' } },
  { id: 'respaldo', texto: 'Respaldo', Componente: RespaldoTaller },
]

export default function Admin() {
  const [parametros, setParametros] = useSearchParams()
  const activa = PESTANAS.find((p) => p.id === parametros.get('pestana')) ?? PESTANAS[0]
  const { Componente, props } = activa

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Panel del taller"
        descripcion="Datos del taller, registro de acciones y respaldo de tus datos."
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
        <Componente {...(props ?? {})} />
      </div>
    </div>
  )
}
