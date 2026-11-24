import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'

// Las fuentes (Archivo) las sirve la propia app con @fontsource/archivo
// (src/main.jsx): ningún archivo del front puede pedirlas a un servidor de
// fuentes de terceros, que además expondría la IP de los usuarios.
const PROHIBIDO = /googleapis|gstatic/i

// Vitest corre con cwd = frontend/.
const RAIZ = process.cwd()

function archivosCss(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivosCss(ruta)
    return ruta.endsWith('.css') ? [ruta] : []
  })
}

describe('Fuentes servidas por la app', () => {
  it('index.html no enlaza servidores de fuentes de terceros', () => {
    const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
    expect(html).not.toMatch(PROHIBIDO)
  })

  it('ningún CSS importa ni enlaza fuentes de terceros', () => {
    const css = archivosCss(join(RAIZ, 'src'))
    expect(css.length).toBeGreaterThan(0)
    for (const ruta of css) {
      expect(readFileSync(ruta, 'utf8'), ruta).not.toMatch(PROHIBIDO)
    }
  })
})
