import { describe, expect, it } from 'vitest'
import {
  autoListo,
  autoRecibido,
  cuandoTurno,
  mensajeOrden,
  mensajeTurno,
  recordatorioTurno,
  saludo,
  trabajosACotizar,
  turnoConfirmado,
} from '@/lib/plantillasWhatsapp'
import { linkWhatsApp, normalizarTelefonoAR, puedeUsarWhatsApp } from '@/lib/whatsapp'

describe('normalizarTelefonoAR', () => {
  it.each([
    ['11 4444-0000', '5491144440000'],
    ['011 15 4444-0000', '5491144440000'],
    ['011-15-4444-0000', '5491144440000'],
    ['+54 9 11 4444-0000', '5491144440000'],
    ['+54 11 15 4444 0000', '5491144440000'],
    ['5491144440000', '5491144440000'],
    ['(0351) 15-555-1234', '5493515551234'],
    ['0351 555 1234', '5493515551234'],
    ['+54 9 341 555-1234', '5493415551234'],
    ['0054 9 221 412-3456', '5492214123456'],
    ['02966 15 41-2345', '5492966412345'],
    ['261.555.1234', '5492615551234'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarTelefonoAR(entrada)).toBe(esperado)
  })

  it.each([
    [null],
    [undefined],
    [''],
    ['   '],
    ['4444-0000'], // sin código de área
    ['15 4444-0000'], // celular sin código de área
    ['123'],
    ['+1 415 555 2671'], // no es argentino
  ])('%s → null', (entrada) => {
    expect(normalizarTelefonoAR(entrada)).toBeNull()
  })
})

describe('linkWhatsApp', () => {
  it('codifica el texto completo (acentos, signos, saltos y &)', () => {
    const texto = '¡Hola, Ana! ¿Venís mañana? Aceite & filtro\nhttps://boxly.ar/portal?x=1'
    const link = linkWhatsApp('011 15 4444-0000', texto)
    expect(link).toBe(`https://wa.me/5491144440000?text=${encodeURIComponent(texto)}`)
    expect(link).not.toMatch(/[ ¡¿&\n]/)
    expect(decodeURIComponent(new URL(link).searchParams.get('text'))).toBe(texto)
  })

  it('sin texto no agrega el parámetro', () => {
    expect(linkWhatsApp('1144440000', '  ')).toBe('https://wa.me/5491144440000')
  })

  it('con un teléfono inválido devuelve null', () => {
    expect(linkWhatsApp('4444-0000', 'Hola')).toBeNull()
  })
})

describe('puedeUsarWhatsApp', () => {
  it('recepción y el administrador sí; el mecánico y el cliente no', () => {
    expect(puedeUsarWhatsApp('administrador')).toBe(true)
    expect(puedeUsarWhatsApp('recepcion')).toBe(true)
    expect(puedeUsarWhatsApp('mecanico')).toBe(false)
    expect(puedeUsarWhatsApp('cliente')).toBe(false)
    expect(puedeUsarWhatsApp(undefined)).toBe(false)
  })
})

const DATOS = {
  cliente: 'Ana',
  vehiculo: 'Fiat Cronos',
  patente: 'AB123CD',
  fecha: '2026-11-24',
  hora: '10:00',
  taller: 'Taller Don Pepe',
  portal: 'https://boxly.ar/portal',
}

describe('plantillas de WhatsApp', () => {
  it('cuandoTurno arma el día de la semana sin correrse por la zona horaria', () => {
    expect(cuandoTurno('2026-11-24', '10:00')).toBe('el martes 24/11 a las 10:00')
    expect(cuandoTurno('2026-11-29', '')).toBe('el domingo 29/11')
    expect(cuandoTurno('', '')).toBe('')
  })

  it('turno confirmado', () => {
    expect(turnoConfirmado(DATOS)).toBe(
      '¡Hola, Ana! Te escribimos de Taller Don Pepe. Te confirmamos el turno para tu Fiat Cronos (AB123CD) ' +
        'el martes 24/11 a las 10:00. Si no podés venir, avisanos por acá. ¡Gracias!',
    )
  })

  it('recordatorio del turno', () => {
    expect(recordatorioTurno(DATOS)).toBe(
      '¡Hola, Ana! Te escribimos de Taller Don Pepe. Te recordamos el turno para tu Fiat Cronos (AB123CD) ' +
        'el martes 24/11 a las 10:00. ¡Te esperamos!',
    )
  })

  it('auto recibido', () => {
    expect(autoRecibido(DATOS)).toBe(
      '¡Hola, Ana! Te escribimos de Taller Don Pepe. Ya recibimos tu Fiat Cronos (AB123CD) en el taller. ' +
        'Podés seguir cómo va el trabajo en https://boxly.ar/portal',
    )
  })

  it('trabajos a cotizar', () => {
    expect(trabajosACotizar(DATOS)).toBe(
      '¡Hola, Ana! Te escribimos de Taller Don Pepe. Revisamos tu Fiat Cronos (AB123CD) y tenemos trabajos ' +
        'para cotizarte. Te pasamos el detalle por acá y también lo ves en https://boxly.ar/portal',
    )
  })

  it('auto listo', () => {
    expect(autoListo(DATOS)).toBe(
      '¡Hola, Ana! Te escribimos de Taller Don Pepe. Tu Fiat Cronos (AB123CD) ya está listo para retirar. ' +
        'El detalle del trabajo está en https://boxly.ar/portal',
    )
  })

  it('saludo libre', () => {
    expect(saludo(DATOS)).toBe('¡Hola, Ana! Te escribimos de Taller Don Pepe.')
  })

  it('se acomodan si faltan datos', () => {
    expect(saludo({})).toBe('¡Hola!')
    expect(autoListo({ patente: 'AB123CD' })).toBe('¡Hola! Tu vehículo (AB123CD) ya está listo para retirar.')
    expect(turnoConfirmado({ cliente: 'Ana' })).toBe(
      '¡Hola, Ana! Te confirmamos el turno para tu vehículo. Si no podés venir, avisanos por acá. ¡Gracias!',
    )
  })

  it('mensajeOrden elige la plantilla según el estado', () => {
    expect(mensajeOrden({ estado: 'Ingresado' }, DATOS)).toBe(autoRecibido(DATOS))
    expect(mensajeOrden({ estado: 'Esperando repuestos' }, DATOS)).toBe(autoRecibido(DATOS))
    expect(mensajeOrden({ estado: 'En diagnóstico' }, DATOS)).toBe(trabajosACotizar(DATOS))
    expect(mensajeOrden({ estado: 'Esperando repuestos', lineas_a_cotizar: 2 }, DATOS)).toBe(trabajosACotizar(DATOS))
    expect(mensajeOrden({ estado: 'Listo', lineas_a_cotizar: 0 }, DATOS)).toBe(autoListo(DATOS))
    expect(mensajeOrden({ estado: 'Entregado' }, DATOS)).toBe(saludo(DATOS))
  })

  it('mensajeTurno: pendiente se confirma, confirmado se recuerda, el resto no tiene mensaje', () => {
    expect(mensajeTurno({ estado: 'pendiente' }, DATOS)).toBe(turnoConfirmado(DATOS))
    expect(mensajeTurno({ estado: 'confirmado' }, DATOS)).toBe(recordatorioTurno(DATOS))
    expect(mensajeTurno({ estado: 'cancelado' }, DATOS)).toBeNull()
    expect(mensajeTurno({ estado: 'completado' }, DATOS)).toBeNull()
  })
})
