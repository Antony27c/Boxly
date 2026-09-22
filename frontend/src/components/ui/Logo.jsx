export default function Logo({ tamano = 'md' }) {
  const medidas = {
    sm: { caja: 'h-7 w-7', texto: 'text-lg' },
    md: { caja: 'h-9 w-9', texto: 'text-2xl' },
    lg: { caja: 'h-12 w-12', texto: 'text-3xl' },
  }[tamano]

  return (
    <div className="flex items-center gap-2.5">
      {/* La marca es una bahía de taller vista de frente: portón elevado sobre el box */}
      <svg className={medidas.caja} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="2" y="5" width="28" height="22" rx="2" fill="#1D2127" />
        <rect x="6" y="9" width="20" height="4" fill="#F5A524" />
        <rect x="6" y="16" width="20" height="7" fill="#333944" />
        <rect x="6" y="16" width="20" height="2" fill="#F5A524" opacity="0.5" />
      </svg>
      <span className={`${medidas.texto} font-bold leading-none tracking-tight text-ink`}>
        Boxly
      </span>
    </div>
  )
}
