// Intención de contratar en la encuesta de fin de demo (docs/Oferta.md).
export const INTENCIONES = [
  { valor: 'contratar', texto: 'Piensa contratar', tono: 'ok' },
  { valor: 'tal_vez', texto: 'Tal vez', tono: 'ambar' },
  { valor: 'no', texto: 'No piensa contratar', tono: 'peligro' },
]

export function intencionDe(valor) {
  return INTENCIONES.find((intencion) => intencion.valor === valor) ?? null
}

// El taller puede venir como objeto { id, nombre } o en campos sueltos.
export function tallerDe(encuesta) {
  const taller = encuesta?.taller
  if (taller && typeof taller === 'object') return { id: taller.id ?? encuesta.taller_id, nombre: taller.nombre }
  return {
    id: encuesta?.taller_id,
    nombre: encuesta?.taller_nombre ?? (typeof taller === 'string' ? taller : null),
  }
}
