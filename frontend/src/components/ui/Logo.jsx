import logo from '@/assets/logo-boxly.png'

export default function Logo({ tamano = 'md' }) {
  const medidas = {
    sm: { caja: 'h-8 w-8', texto: 'text-lg' },
    md: { caja: 'h-10 w-10', texto: 'text-2xl' },
    lg: { caja: 'h-14 w-14', texto: 'text-3xl' },
  }[tamano]

  return (
    <div className="flex items-center gap-2.5">
      <img src={logo} alt="Boxly" className={`${medidas.caja} object-contain`} />
      <span className={`${medidas.texto} font-bold leading-none tracking-tight text-ink`}>
        Boxly
      </span>
    </div>
  )
}
