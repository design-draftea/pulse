import type { HelpAssistantLiveSnapshot } from './helpAssistantSnapshot'

export type HelpAssistantActionId = 'entries' | 'movements' | 'previous-rounds'
export type HelpAssistantConfidence = 'high' | 'medium' | 'low'
export type HelpAssistantSourceType =
  | 'account'
  | 'faq'
  | 'glossary'
  | 'live'
  | 'policy'
  | 'product'

export interface HelpAssistantAction {
  id: HelpAssistantActionId
  label: string
}

export interface HelpAssistantContext {
  availableBalanceCents: number
  hasOpenEntries: boolean
  /**
   * Estado real do protótipo no instante da pergunta. Opcional de propósito:
   * sem ele o assistente continua respondendo só com o catálogo de conteúdo,
   * que é o comportamento anterior.
   */
  live?: HelpAssistantLiveSnapshot
}

export interface HelpAssistantSource {
  id: string
  label: string
  type: HelpAssistantSourceType
}

export interface HelpAssistantConversationContext {
  previousSource?: Pick<HelpAssistantSource, 'id' | 'type'>
}

export interface HelpAssistantSuggestion {
  id: string
  label: string
  query: string
}

/** Linha de números destacada acima do texto, com a hora da leitura. */
export interface HelpAssistantHighlight {
  items: Array<{
    label: string
    side?: 'up' | 'down'
    value: string
  }>
  timeLabel?: string
}

export interface HelpAssistantResult {
  action?: HelpAssistantAction
  answer: string
  confidence: HelpAssistantConfidence
  details?: string[]
  highlight?: HelpAssistantHighlight
  source?: HelpAssistantSource
  suggestions: HelpAssistantSuggestion[]
}

export const ACTION_LABELS: Record<HelpAssistantActionId, string> = {
  entries: 'Ver mis entradas',
  movements: 'Ver movimientos',
  'previous-rounds': 'Ver últimas rondas',
}
