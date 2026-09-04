import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  askHelpAssistant,
  type HelpAssistantActionId,
  type HelpAssistantContext,
  type HelpAssistantResult,
  type HelpAssistantSource,
  type HelpAssistantSuggestion,
} from '../../services/helpAssistant'
import './HelpAssistant.css'

const RESPONSE_DELAY_MS = 2_000

const INTRO_SUGGESTIONS: HelpAssistantSuggestion[] = [
  {
    id: 'intro-round',
    label: '¿Cómo funciona una ronda?',
    query: '¿Cómo funciona una ronda de 15 minutos?',
  },
  {
    id: 'intro-previous-rounds',
    label: '¿Qué son las últimas 10 rondas?',
    query: '¿Qué son las últimas 10 rondas?',
  },
  {
    id: 'intro-up-down',
    label: '¿Qué significa UP o DOWN?',
    query: '¿Qué significa elegir UP o DOWN?',
  },
]

interface HelpAssistantMessage {
  id: number
  isLoading?: boolean
  result?: HelpAssistantResult
  role: 'assistant' | 'user'
  text: string
}

interface HelpAssistantProps {
  context: HelpAssistantContext
  isActive: boolean
  onNavigate: (action: HelpAssistantActionId) => void
  onOpenFaq: (id: string) => void
  onOpenGlossary: () => void
}

export function HelpAssistant({
  context,
  isActive,
  onNavigate,
  onOpenFaq,
  onOpenGlossary,
}: HelpAssistantProps) {
  const [inputValue, setInputValue] = useState('')
  const [isResponding, setIsResponding] = useState(false)
  const [messages, setMessages] = useState<HelpAssistantMessage[]>([])
  const messageIdRef = useRef(0)
  const responseTimerRef = useRef<number | null>(null)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const previousSourceRef = useRef<Pick<HelpAssistantSource, 'id' | 'type'> | null>(null)

  useEffect(() => {
    if (!isActive) return undefined

    const focusTimer = window.setTimeout(() => {
      headingRef.current?.focus({ preventScroll: true })
    }, 320)

    return () => window.clearTimeout(focusTimer)
  }, [isActive])

  useEffect(() => {
    if (messages.length === 0) return
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    messagesEndRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'end',
    })
  }, [messages])

  useEffect(() => () => {
    if (responseTimerRef.current !== null) {
      window.clearTimeout(responseTimerRef.current)
    }
  }, [])

  const ask = useCallback((query: string) => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery || responseTimerRef.current !== null) return

    const result = askHelpAssistant(trimmedQuery, context, {
      previousSource: previousSourceRef.current ?? undefined,
    })
    const userMessageId = messageIdRef.current + 1
    const assistantMessageId = userMessageId + 1
    messageIdRef.current = assistantMessageId

    setMessages((current) => [
      ...current,
      { id: userMessageId, role: 'user', text: trimmedQuery },
      {
        id: assistantMessageId,
        isLoading: true,
        role: 'assistant',
        text: '',
      },
    ])
    setInputValue('')
    setIsResponding(true)

    responseTimerRef.current = window.setTimeout(() => {
      responseTimerRef.current = null

      if (
        result.confidence === 'high'
        && result.source
        && ['faq', 'glossary', 'product'].includes(result.source.type)
      ) {
        previousSourceRef.current = {
          id: result.source.id,
          type: result.source.type,
        }
      }

      setMessages((current) => current.map((message) => (
        message.id === assistantMessageId
          ? {
              id: assistantMessageId,
              result,
              role: 'assistant',
              text: result.answer,
            }
          : message
      )))
      setIsResponding(false)
    }, RESPONSE_DELAY_MS)
  }, [context])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    ask(inputValue)
  }

  const handleSourceClick = (result: HelpAssistantResult) => {
    if (result.source?.type === 'faq') {
      onOpenFaq(result.source.id)
      return
    }
    if (result.source?.type === 'glossary') onOpenGlossary()
  }

  const renderSuggestion = (suggestion: HelpAssistantSuggestion) => (
    <button
      className="help-assistant__suggestion"
      key={suggestion.id}
      type="button"
      onClick={() => ask(suggestion.query)}
    >
      {suggestion.label}
    </button>
  )

  return (
    <section className="help-assistant" aria-label="Asistente de ayuda de Pulse">
      <div className="help-assistant__scroll">
        <div className="help-assistant__intro">
          <h3 ref={headingRef} tabIndex={-1}>Hola, soy el asistente de Pulse</h3>
          <p>
            Puedo ayudarte con rondas, precios, el gráfico, entradas y movimientos.
            No puedo recomendarte elegir UP o DOWN.
          </p>
        </div>

        {messages.length === 0 ? (
          <div className="help-assistant__starter" aria-label="Preguntas sugeridas">
            <span>Prueba con una pregunta</span>
            <div className="help-assistant__suggestions">
              {INTRO_SUGGESTIONS.map(renderSuggestion)}
            </div>
          </div>
        ) : (
          <div className="help-assistant__messages" aria-label="Conversación">
            {messages.map((message) => (
              <article
                className={[
                  'help-assistant__message',
                  `help-assistant__message--${message.role}`,
                  message.isLoading
                    ? 'help-assistant__message--loading'
                    : message.role === 'assistant'
                      ? 'help-assistant__message--revealed'
                      : '',
                ].filter(Boolean).join(' ')}
                key={message.id}
                aria-label={message.isLoading ? 'Pulse está preparando una respuesta' : undefined}
                role={message.role === 'assistant' ? 'status' : undefined}
              >
                {message.isLoading ? (
                  <span className="help-assistant__typing" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  <p>{message.text}</p>
                )}

                {message.result?.suggestions.length ? (
                  <div className="help-assistant__suggestions">
                    {message.result.suggestions.map(renderSuggestion)}
                  </div>
                ) : null}

                {message.result?.source ? (
                  message.result.source.type === 'faq'
                    || message.result.source.type === 'glossary' ? (
                      <button
                        className="help-assistant__source"
                        type="button"
                        onClick={() => handleSourceClick(message.result!)}
                      >
                        Fuente: {message.result.source.label}
                      </button>
                    ) : (
                      <span className="help-assistant__source-label">
                        Fuente: {message.result.source.label}
                      </span>
                    )
                ) : null}

                {message.result?.action ? (
                  <button
                    className="help-assistant__action"
                    type="button"
                    onClick={() => onNavigate(message.result!.action!.id)}
                  >
                    {message.result.action.label}
                  </button>
                ) : null}
              </article>
            ))}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
        )}
      </div>

      <form className="help-assistant__composer" onSubmit={handleSubmit}>
        <label className="help-assistant__visually-hidden" htmlFor="help-assistant-question">
          Escribe tu pregunta sobre Pulse
        </label>
        <input
          id="help-assistant-question"
          type="text"
          value={inputValue}
          maxLength={180}
          placeholder="Escribe tu pregunta"
          autoComplete="off"
          enterKeyHint="send"
          onChange={(event) => setInputValue(event.target.value)}
        />
        <button type="submit" disabled={!inputValue.trim() || isResponding}>
          Enviar
        </button>
      </form>
    </section>
  )
}
