export default function Alert({ children, tipo = 'error' }) {
  const estilos = {
    error: 'border-danger/50 bg-danger/10 text-danger',
    ok: 'border-ok/50 bg-ok/10 text-ok',
    info: 'border-graphite-500 bg-graphite-700 text-muted',
  }

  return (
    <div role="alert" className={`rounded-box border px-3.5 py-3 text-sm ${estilos[tipo]}`}>
      {children}
    </div>
  )
}
