import Icono from '@/components/ui/Icono'

const estilos = {
  error: 'border-danger/50 bg-danger/10 text-danger',
  warning: 'border-amber/50 bg-amber/10 text-amber-texto',
  info: 'border-graphite-500 bg-graphite-700 text-muted',
  ok: 'border-ok/50 bg-ok/10 text-ok',
  success: 'border-ok/50 bg-ok/10 text-ok',
}

const ICONOS = {
  error: 'alerta',
  warning: 'alerta',
  info: 'info',
  ok: 'check',
  success: 'check',
}

export default function Alert({ children, tipo = 'error' }) {
  // role=alert interrumpe al lector de pantalla: solo errores y advertencias.
  const rol = tipo === 'error' || tipo === 'warning' ? 'alert' : 'status'
  return (
    <div
      role={rol}
      className={`flex items-start gap-2.5 rounded-box border px-3.5 py-3 text-sm ${estilos[tipo] ?? estilos.info}`}
    >
      <Icono
        nombre={ICONOS[tipo] ?? 'info'}
        className="mt-0.5 h-4 w-4 shrink-0"
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
