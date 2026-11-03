import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { nombreEstado, ordenesService } from '@/services/ordenes'

const RESULTADOS = {
  enviado: { texto: 'Enviado', tono: 'ok' },
  fallido: { texto: 'Falló', tono: 'peligro' },
  omitido: { texto: 'No enviado', tono: 'neutro' },
}

function fechaHora(fecha) {
  return new Date(fecha).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AvisosOrden({ ordenId, avisos, puedeEnviar, onEnviado }) {
  const { token } = useAuth()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function enviar() {
    setEnviando(true)
    setError('')
    try {
      await ordenesService.enviarAviso(ordenId, token)
      await onEnviado()
    } catch (problema) {
      setError(problema.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="space-y-3 border-t border-graphite-700 pt-4" aria-label="Avisos al cliente">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Avisos por email al cliente</h3>
        {puedeEnviar && (
          <Button variante="secundario" cargando={enviando} onClick={enviar}>
            Enviar aviso al cliente
          </Button>
        )}
      </div>
      {error && <Alert>{error}</Alert>}
      {avisos.length === 0 ? (
        <p className="text-sm text-muted">Todavía no se envió ningún aviso de esta orden.</p>
      ) : (
        <ul className="space-y-2">
          {avisos.map((aviso) => {
            const resultado = RESULTADOS[aviso.resultado] ?? RESULTADOS.omitido
            return (
              <li key={aviso.id} className="rounded-box border border-graphite-700 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tono={resultado.tono}>{resultado.texto}</Badge>
                  <time dateTime={aviso.creado_en} className="text-xs text-muted">
                    {fechaHora(aviso.creado_en)}
                  </time>
                </div>
                <p className="mt-1">{aviso.asunto}</p>
                <p className="text-xs text-muted">
                  Para {aviso.destinatario} · estado {nombreEstado(aviso.estado_orden)} ·{' '}
                  {aviso.manual ? `reenviado por ${aviso.enviado_por_nombre ?? 'el administrador'}` : 'automático'}
                </p>
                {aviso.error && <p className="mt-1 text-xs text-danger">{aviso.error}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
