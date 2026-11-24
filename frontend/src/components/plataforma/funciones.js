/* Códigos de función del contrato (docs/Oferta.md, "Modelo técnico").
   El código viaja en la API (planes.funciones, funciones_efectivas); acá
   solo se traduce a la etiqueta legible que ve el superadmin. */
export const FUNCIONES = {
  gestion: 'Gestión del taller',
  whatsapp_manual: 'Mensajes de WhatsApp armados (envío manual)',
  whatsapp_automatico: 'Avisos automáticos por WhatsApp',
  arca: 'Facturación electrónica ARCA',
  recordatorios_service: 'Recordatorios automáticos de service',
  marca_propia: 'Personalización de marca',
}

export function etiquetaFuncion(codigo) {
  return FUNCIONES[codigo] ?? codigo
}

/* Tipo de acceso del taller (talleres.tipo_acceso): pago es la suscripción
   normal; demo y piloto son accesos sin cargo otorgados por el superadmin. */
export const TIPOS_ACCESO = {
  pago: { texto: 'Pago', tono: 'ok' },
  demo: { texto: 'Demo', tono: 'ambar' },
  piloto: { texto: 'Piloto', tono: 'neutro' },
}
