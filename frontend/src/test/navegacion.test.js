import { describe, expect, it } from 'vitest'
import {
  etiquetaRol,
  inicioSegunRol,
  menuSegunRol,
  tieneAcceso,
} from '@/routes/navegacion'

const textos = (items) => items.map((item) => item.texto)
const rutas = (items) => items.map((item) => item.a)

describe('menuSegunRol', () => {
  it('recepción: Hoy, Órdenes, Turnos, Clientes y Vehículos; el resto en Más', () => {
    const { principales, mas } = menuSegunRol('recepcion')
    expect(rutas(principales)).toEqual(['/hoy', '/ordenes', '/turnos', '/clientes', '/vehiculos'])
    expect(rutas(mas)).toEqual(['/inventario', '/horarios', '/dashboard'])
  })

  it('administrador: mismos principales que recepción y Dashboard/Usuarios en Más', () => {
    const { principales, mas } = menuSegunRol('administrador')
    expect(rutas(principales)).toEqual(['/hoy', '/ordenes', '/turnos', '/clientes', '/vehiculos'])
    expect(rutas(mas)).toEqual(['/inventario', '/horarios', '/dashboard', '/usuarios'])
  })

  it('mecánico: Mi trabajo en /hoy, sin Turnos ni Clientes', () => {
    const { principales, mas } = menuSegunRol('mecanico')
    expect(principales[0]).toEqual({ a: '/hoy', texto: 'Mi trabajo', icono: 'hoy' })
    expect(rutas(principales)).toEqual(['/hoy', '/ordenes', '/inventario'])
    expect(rutas(mas)).toEqual(['/horarios'])
    expect(textos(principales)).not.toContain('Turnos')
    expect(textos(principales)).not.toContain('Clientes')
  })

  it('cliente: solo Mis órdenes', () => {
    const { principales, mas } = menuSegunRol('cliente')
    expect(principales).toEqual([{ a: '/portal', texto: 'Mis órdenes', icono: 'portal' }])
    expect(mas).toEqual([])
  })

  it('rol desconocido: menú vacío', () => {
    expect(menuSegunRol('otro')).toEqual({ principales: [], mas: [] })
    expect(menuSegunRol(undefined)).toEqual({ principales: [], mas: [] })
  })
})

describe('etiquetaRol', () => {
  it('devuelve la etiqueta legible de cada rol', () => {
    expect(etiquetaRol('administrador')).toBe('Administrador')
    expect(etiquetaRol('admin')).toBe('Administrador')
    expect(etiquetaRol('recepcion')).toBe('Recepción')
    expect(etiquetaRol('recepcionista')).toBe('Recepción')
    expect(etiquetaRol('mecanico')).toBe('Mecánico')
    expect(etiquetaRol('mecánico')).toBe('Mecánico')
    expect(etiquetaRol('cliente')).toBe('Cliente')
  })
})

describe('inicioSegunRol', () => {
  it('todo el taller arranca en /hoy y el cliente en /portal', () => {
    for (const rol of ['administrador', 'admin', 'recepcion', 'recepcionista', 'mecanico', 'mecánico']) {
      expect(inicioSegunRol(rol)).toBe('/hoy')
    }
    expect(inicioSegunRol('cliente')).toBe('/portal')
  })
})

describe('tieneAcceso (sin cambios)', () => {
  it('sigue filtrando por lista de roles', () => {
    expect(tieneAcceso(['a', 'b'], 'a')).toBe(true)
    expect(tieneAcceso(['a', 'b'], 'c')).toBe(false)
    expect(tieneAcceso(undefined, 'cualquiera')).toBe(true)
  })
})
