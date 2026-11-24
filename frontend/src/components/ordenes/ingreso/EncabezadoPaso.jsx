export default function EncabezadoPaso({ numero, texto }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber/15 text-xs font-bold text-amber-texto">
        {numero}
      </span>
      {texto}
    </h3>
  )
}
