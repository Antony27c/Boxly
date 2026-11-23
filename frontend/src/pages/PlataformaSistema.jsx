import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import ResumenSistema from '@/components/superadmin/ResumenSistema'
import Auditoria from '@/components/superadmin/Auditoria'

// Sistema de la plataforma (superadmin, docs/Plataforma.md P3): salud
// agregada de todos los talleres y la auditoría de la plataforma, que se
// puede filtrar por taller.
export default function PlataformaSistema() {
  return (
    <div className="space-y-8">
      <EncabezadoPagina
        titulo="Sistema"
        descripcion="Salud de la plataforma y registro de acciones de todos los talleres."
        icono="dashboard"
      />
      <ResumenSistema />
      <Auditoria ambito="plataforma" />
    </div>
  )
}
