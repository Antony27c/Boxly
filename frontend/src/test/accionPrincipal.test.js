import { describe, expect, it } from 'vitest'
import { accionPrincipal } from '@/services/ordenes'

const orden = (extra) => ({ id: 1, estado: 'Pendiente', mecanico_id: null, mecanico: '', ...extra })

describe('accionPrincipal', () => {
  it('pendiente: recepción y admin reciben el auto; el mecánico no tiene acción', () => {
    expect(accionPrincipal(orden(), 'recepcion')).toMatchObject({ tipo: 'etapa', destino: 'Ingresado' })
    expect(accionPrincipal(orden(), 'administrador')).toMatchObject({ texto: 'Recibir auto' })
    expect(accionPrincipal(orden(), 'mecanico')).toBeNull()
  })

  it('ingresado sin mecánico: mostrador asigna', () => {
    const o = orden({ estado: 'Ingresado' })
    expect(accionPrincipal(o, 'recepcion')).toMatchObject({ tipo: 'asignar' })
    expect(accionPrincipal(o, 'mecanico')).toBeNull()
  })

  it('ingresado con mecánico: el mecánico empieza el diagnóstico', () => {
    const o = orden({ estado: 'Ingresado', mecanico_id: 3, mecanico: 'Mario' })
    expect(accionPrincipal(o, 'mecanico')).toMatchObject({ destino: 'En diagnóstico' })
    expect(accionPrincipal(o, 'recepcion')).toBeNull()
  })

  it('en diagnóstico: el mecánico marca listo, con secundaria y carga de trabajo', () => {
    const a = accionPrincipal(orden({ estado: 'En diagnóstico', mecanico_id: 3 }), 'mecanico')
    expect(a).toMatchObject({ destino: 'Listo', secundaria: { destino: 'Esperando repuestos' }, trabajo: { tipo: 'abrir' } })
    expect(accionPrincipal(orden({ estado: 'En diagnóstico' }), 'administrador')).toBeNull()
  })

  it('esperando repuestos: el mecánico marca listo', () => {
    expect(accionPrincipal(orden({ estado: 'Esperando repuestos' }), 'mecanico')).toMatchObject({ destino: 'Listo' })
  })

  it('listo sin cobro: mostrador emite, mecánico propone', () => {
    const o = orden({ estado: 'Listo', cobro_estado: null })
    expect(accionPrincipal(o, 'recepcion')).toMatchObject({ tipo: 'cobro', texto: 'Emitir cobro' })
    expect(accionPrincipal(o, 'mecanico')).toMatchObject({ texto: 'Proponer cobro' })
  })

  it('listo con cobro propuesto: el admin aprueba, recepción revisa, el mecánico nada', () => {
    const o = orden({ estado: 'Listo', cobro_estado: 'pendiente' })
    expect(accionPrincipal(o, 'administrador')).toMatchObject({ texto: 'Aprobar cobro' })
    expect(accionPrincipal(o, 'recepcion')).toMatchObject({ texto: 'Revisar cobro' })
    expect(accionPrincipal(o, 'mecanico')).toBeNull()
  })

  it('listo con cobro aprobado o pagada: mostrador entrega', () => {
    const aprobado = orden({ estado: 'Listo', cobro_estado: 'aprobado', costo_final: 1000 })
    const pagada = orden({ estado: 'Listo', pagada: true })
    expect(accionPrincipal(aprobado, 'recepcion')).toMatchObject({ destino: 'Entregado' })
    expect(accionPrincipal(pagada, 'administrador')).toMatchObject({ texto: 'Entregar' })
    expect(accionPrincipal(pagada, 'mecanico')).toBeNull()
  })

  it('cerradas: ninguna acción', () => {
    expect(accionPrincipal(orden({ estado: 'Entregado' }), 'administrador')).toBeNull()
    expect(accionPrincipal(orden({ estado: 'Cancelado' }), 'recepcion')).toBeNull()
    expect(accionPrincipal(null, 'recepcion')).toBeNull()
  })
})
