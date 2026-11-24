import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  CODIGOS_ERROR,
  alErrorDeAcceso,
  api,
  setSoportePerdidoHandler,
  tieneCodigo,
} from '@/lib/api'

const fetchMock = vi.fn()

function respuesta(datos, status) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => (datos === undefined ? '' : JSON.stringify(datos)),
  }
}

async function errorDe(promesa) {
  try {
    await promesa
  } catch (error) {
    return error
  }
  throw new Error('Se esperaba un error')
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  setSoportePerdidoHandler(null)
  vi.unstubAllGlobals()
})

describe('errores con código estable', () => {
  it('el error expone el codigo del JSON y el detail como mensaje', async () => {
    fetchMock.mockResolvedValue(
      respuesta({ detail: 'Tu plan permite hasta 3 usuarios', codigo: 'limite_personal' }, 409),
    )
    const error = await errorDe(api.post('/api/v1/users', {}, 'tok'))
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(409)
    expect(error.codigo).toBe(CODIGOS_ERROR.limitePersonal)
    expect(error.message).toBe('Tu plan permite hasta 3 usuarios')
    expect(tieneCodigo(error, 'limite_personal')).toBe(true)
  })

  it('sin codigo queda en null', async () => {
    fetchMock.mockResolvedValue(respuesta({ detail: 'No encontrado' }, 404))
    const error = await errorDe(api.get('/api/v1/ordenes/1', 'tok'))
    expect(error.codigo).toBeNull()
    expect(tieneCodigo(error, 'limite_personal')).toBe(false)
  })
})

describe('alErrorDeAcceso', () => {
  it('avisa los 403 con la ruta y el método, y se puede desuscribir', async () => {
    const oyente = vi.fn()
    const desuscribir = alErrorDeAcceso(oyente)
    fetchMock.mockResolvedValue(
      respuesta({ detail: 'Otro texto', codigo: 'suscripcion_suspendida' }, 403),
    )

    await errorDe(api.put('/api/v1/ordenes/3', {}, 'tok'))
    expect(oyente).toHaveBeenCalledTimes(1)
    const [error, contexto] = oyente.mock.calls[0]
    expect(error.codigo).toBe('suscripcion_suspendida')
    expect(contexto).toEqual({ ruta: '/api/v1/ordenes/3', metodo: 'PUT' })

    desuscribir()
    await errorDe(api.put('/api/v1/ordenes/3', {}, 'tok'))
    expect(oyente).toHaveBeenCalledTimes(1)
  })

  it('no avisa otros estados', async () => {
    const oyente = vi.fn()
    const desuscribir = alErrorDeAcceso(oyente)
    fetchMock.mockResolvedValue(respuesta({ detail: 'x', codigo: 'limite_personal' }, 409))
    await errorDe(api.post('/api/v1/users', {}, 'tok'))
    expect(oyente).not.toHaveBeenCalled()
    desuscribir()
  })

  it('un oyente que falla no tapa el error del request', async () => {
    const desuscribir = alErrorDeAcceso(() => {
      throw new Error('roto')
    })
    fetchMock.mockResolvedValue(respuesta({ detail: 'Sin permiso' }, 403))
    const error = await errorDe(api.get('/api/v1/ordenes', 'tok'))
    expect(error).toBeInstanceOf(ApiError)
    expect(error.message).toBe('Sin permiso')
    desuscribir()
  })

  it('no reescribe los métodos del cliente api', () => {
    const antes = { ...api }
    const desuscribir = alErrorDeAcceso(() => {})
    desuscribir()
    expect({ ...api }).toEqual(antes)
  })
})

describe('modo soporte perdido', () => {
  it('sale del modo soporte con el código soporte_sin_acceso', async () => {
    const perdido = vi.fn()
    setSoportePerdidoHandler(perdido)
    fetchMock.mockResolvedValue(
      respuesta({ detail: 'El taller no te dio acceso de soporte', codigo: 'soporte_sin_acceso' }, 403),
    )
    await errorDe(api.get('/api/v1/ordenes', 'tok'))
    expect(perdido).toHaveBeenCalledWith('El taller no te dio acceso de soporte')
  })

  it('el texto solo, sin el código, ya no alcanza', async () => {
    const perdido = vi.fn()
    setSoportePerdidoHandler(perdido)
    fetchMock.mockResolvedValue(respuesta({ detail: 'El taller no te dio acceso de soporte' }, 403))
    await errorDe(api.get('/api/v1/ordenes', 'tok'))
    expect(perdido).not.toHaveBeenCalled()
  })
})

// Nadie reconoce un error del servidor comparando su texto: para eso está el
// `codigo`. Busca en src (sin los tests) regex, match, includes o search
// aplicados al mensaje o al detail de un error.
describe('sin regex sobre textos del servidor', () => {
  // vitest corre desde frontend/.
  const RAIZ = join(process.cwd(), 'src')
  const SOSPECHOSOS = [
    // /texto/.test(error.message), PATRON.test(String(detalle ?? ''))
    /\.(test|match|search)\(\s*(String\()?\s*[\w.?]*\b(message|detail|detalle|mensaje)\b/,
    // error.message.match(...), detalle?.includes(...), String(detail ?? '').search(...)
    /\b(message|detail|detalle|mensaje)\b(\s*\?\?\s*'')?\)?\??\.(match|includes|search|startsWith|endsWith)\(/,
  ]

  function archivos(dir) {
    return readdirSync(dir).flatMap((nombre) => {
      const ruta = join(dir, nombre)
      if (statSync(ruta).isDirectory()) return nombre === 'test' ? [] : archivos(ruta)
      return /\.(jsx?|tsx?)$/.test(nombre) && !/\.test\./.test(nombre) ? [ruta] : []
    })
  }

  it('ningún archivo de src compara el texto de un error', () => {
    const hallazgos = []
    for (const ruta of archivos(RAIZ)) {
      readFileSync(ruta, 'utf8')
        .split('\n')
        .forEach((linea, i) => {
          if (SOSPECHOSOS.some((patron) => patron.test(linea))) {
            hallazgos.push(`${relative(RAIZ, ruta)}:${i + 1}: ${linea.trim()}`)
          }
        })
    }
    expect(hallazgos).toEqual([])
  })

  it('el chequeo detecta el patrón viejo', () => {
    const viejas = [
      "PATRON_BLOQUEO.test(error.message) &&",
      "/acceso de soporte/i.test(String(detalle ?? ''))",
      "return /plan permite hasta/i.test(problema?.message ?? '')",
      "if (error.message.includes('vencida')) {",
    ]
    for (const linea of viejas) {
      expect(SOSPECHOSOS.some((patron) => patron.test(linea))).toBe(true)
    }
  })
})
