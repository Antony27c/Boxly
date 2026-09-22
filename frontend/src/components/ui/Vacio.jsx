export default function Vacio({ titulo, mensaje, accion }) {
  return (
    <div className="rounded-box border border-dashed border-graphite-600 px-6 py-12 text-center">
      <h3 className="font-semibold">{titulo}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{mensaje}</p>
      {accion && <div className="mt-5 flex justify-center">{accion}</div>}
    </div>
  )
}
