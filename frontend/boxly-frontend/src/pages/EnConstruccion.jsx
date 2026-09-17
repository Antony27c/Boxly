export default function EnConstruccion({ modulo, sprint }) {
  return (
    <div className="animate-bay-in rounded-box border border-dashed border-graphite-600 p-10 text-center">
      <h1 className="text-xl font-semibold">{modulo}</h1>
      <p className="mx-auto mt-2 max-w-md text-muted">
        Este módulo se desarrolla en el {sprint}. La ruta ya está creada para que la pantalla
        se enchufe sin tocar el ruteo.
      </p>
    </div>
  )
}
