import Button from '@/components/ui/Button'

/* Barra de paginación accesible: anterior/siguiente, el rango visible
   ("Mostrando X a Y de Z") y la página actual dentro de un <nav> rotulado. */
export default function Paginacion({
  pagina,
  paginas,
  desde,
  hasta,
  total,
  onPagina,
  className = '',
}) {
  return (
    <nav
      aria-label="Paginación"
      className={`flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      <p className="text-sm text-muted">
        Mostrando {desde} a {hasta} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Button variante="secundario" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)}>
          ← Anterior
        </Button>
        <span className="text-sm text-muted">
          Página {pagina} de {paginas}
        </span>
        <Button variante="secundario" disabled={pagina >= paginas} onClick={() => onPagina(pagina + 1)}>
          Siguiente →
        </Button>
      </div>
    </nav>
  )
}
