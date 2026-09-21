const estilos = {
  neutro: 'border-graphite-500 bg-graphite-700 text-muted',
  ambar: 'border-amber/50 bg-amber/10 text-amber',
  ok: 'border-ok/50 bg-ok/10 text-ok',
  peligro: 'border-danger/50 bg-danger/10 text-danger',
}

export default function Badge({ children, tono = 'neutro' }) {
  return (
    <span
      className={`inline-flex items-center rounded-box border px-2 py-0.5 text-xs font-medium ${estilos[tono]}`}
    >
      {children}
    </span>
  )
}
