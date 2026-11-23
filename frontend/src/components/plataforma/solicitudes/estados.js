// Estados de una solicitud de demo (docs/Landing.md) y cómo se muestran.
export const ESTADOS_SOLICITUD = [
  { valor: 'nueva', texto: 'Nueva', plural: 'Nuevas', tono: 'ambar', acento: 'amber' },
  { valor: 'contactada', texto: 'Contactada', plural: 'Contactadas', tono: 'neutro', acento: 'azul' },
  { valor: 'convertida', texto: 'Convertida', plural: 'Convertidas', tono: 'ok', acento: 'ok' },
  { valor: 'descartada', texto: 'Descartada', plural: 'Descartadas', tono: 'peligro', acento: 'neutro' },
]

export function estadoSolicitud(valor) {
  return (
    ESTADOS_SOLICITUD.find((estado) => estado.valor === valor) ?? {
      valor,
      texto: valor ?? '—',
      plural: valor ?? '—',
      tono: 'neutro',
      acento: 'neutro',
    }
  )
}
