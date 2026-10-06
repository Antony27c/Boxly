import IconoAuto from '@/components/ui/IconoAuto'
import { logoDeMarca } from '@/utils/marcas'

function esMuyClaro(hex) {
  const numero = parseInt(hex.slice(1), 16)
  const r = (numero >> 16) & 255
  const g = (numero >> 8) & 255
  const b = numero & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 200
}

export default function LogoMarca({ marca }) {
  const logo = logoDeMarca(marca)
  if (!logo) return <IconoAuto className="h-5 w-5" />

  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-graphite-500 bg-white"
      title={logo.nombre}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill={esMuyClaro(logo.color) ? '#1E2126' : logo.color}
        role="img"
        aria-label={logo.nombre}
      >
        <path d={logo.path} />
      </svg>
    </span>
  )
}
