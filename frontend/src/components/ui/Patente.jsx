// Patente estilo Mercosur: banda azul con "REPÚBLICA ARGENTINA" y letras mono.
// El texto de la patente queda tal cual llega (sin reformatear) para que se lea
// y se busque igual que antes; la banda es decorativa y va aria-hidden.
// Uso: <Patente valor={vehiculo.patente} tamano="md" />
const TAMANOS = {
  sm: { caja: 'text-xs', banda: 'text-[0.4rem] py-px', letras: 'px-1.5 py-0.5 tracking-[0.12em]' },
  md: { caja: 'text-base', banda: 'text-[0.5rem] py-px', letras: 'px-2 py-0.5 tracking-[0.14em]' },
  lg: { caja: 'text-2xl', banda: 'text-[0.6rem] py-0.5', letras: 'px-3 py-1 tracking-[0.16em]' },
}

export default function Patente({ valor, tamano = 'md', className = '' }) {
  if (!valor) return null
  const t = TAMANOS[tamano] ?? TAMANOS.md
  return (
    <span
      className={`inline-flex shrink-0 flex-col overflow-hidden rounded-[0.3em] border border-[#1b1d21]/70 bg-white align-middle leading-none text-[#1b1d21] shadow-sm ${t.caja} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`block whitespace-nowrap bg-[#1f4fa0] px-1 text-center font-sans font-semibold uppercase tracking-wider text-white ${t.banda}`}
      >
        República Argentina
      </span>
      <span className={`block whitespace-nowrap text-center font-mono font-bold uppercase ${t.letras}`}>{valor}</span>
    </span>
  )
}
