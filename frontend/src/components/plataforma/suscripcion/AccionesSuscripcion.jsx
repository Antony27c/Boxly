import Button from '@/components/ui/Button'

/* Botones de acción sobre la suscripción del taller: cada uno abre su modal
   en la página que compone esta sección. */
const ACCIONES = [
  { tipo: 'acceso', texto: 'Cambiar acceso', icono: 'llave' },
  { tipo: 'plan', texto: 'Cambiar plan', icono: 'ajustes' },
  { tipo: 'pago', texto: 'Registrar pago o cortesía', icono: 'dinero' },
  { tipo: 'vencimiento', texto: 'Ajustar vencimiento', icono: 'horarios' },
]

export default function AccionesSuscripcion({ onSeleccionar }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {ACCIONES.map(({ tipo, texto, icono }) => (
        <Button key={tipo} variante="secundario" icono={icono} onClick={() => onSeleccionar(tipo)}>
          {texto}
        </Button>
      ))}
    </div>
  )
}
