import {
  helpFaqItems,
  helpGlossaryItems,
  helpProductItems,
} from '../content/help/es-MX/helpContent.ts'

export type HelpAssistantActionId = 'entries' | 'movements' | 'previous-rounds'
export type HelpAssistantConfidence = 'high' | 'medium' | 'low'
export type HelpAssistantSourceType = 'account' | 'faq' | 'glossary' | 'policy' | 'product'

export interface HelpAssistantAction {
  id: HelpAssistantActionId
  label: string
}

export interface HelpAssistantContext {
  availableBalanceCents: number
  hasOpenEntries: boolean
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

export interface HelpAssistantResult {
  action?: HelpAssistantAction
  answer: string
  confidence: HelpAssistantConfidence
  source?: HelpAssistantSource
  suggestions: HelpAssistantSuggestion[]
}

type QueryIntent = 'definition' | 'explanation' | 'navigation' | 'unknown'

interface HelpKnowledgeItem {
  actionId?: HelpAssistantActionId
  aliases: string[]
  answer: string
  examples: string[]
  id: string
  keywords: string[]
  preferredIntent: QueryIntent
  sourceLabel: string
  sourceType: 'faq' | 'glossary' | 'product'
  title: string
}

interface RankedKnowledgeItem {
  item: HelpKnowledgeItem
  score: number
}

const HIGH_CONFIDENCE_THRESHOLD = 0.72
const MEDIUM_CONFIDENCE_THRESHOLD = 0.38
const HIGH_CONFIDENCE_GAP = 0.1

const STOP_WORDS = new Set([
  'a',
  'al',
  'como',
  'con',
  'cual',
  'cuando',
  'de',
  'del',
  'donde',
  'el',
  'en',
  'es',
  'esta',
  'este',
  'la',
  'las',
  'lo',
  'los',
  'me',
  'mi',
  'para',
  'por',
  'puedo',
  'que',
  'se',
  'si',
  'su',
  'un',
  'una',
  'y',
  'ya',
])

const DEFAULT_SUGGESTION_IDS = [
  'faq:how-round-works',
  'product:previous-rounds',
  'faq:what-is-up-down',
]

const ACTION_LABELS: Record<HelpAssistantActionId, string> = {
  entries: 'Ver mis entradas',
  movements: 'Ver movimientos',
  'previous-rounds': 'Ver últimas rondas',
}

const balanceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const normalizeHelpText = (value: string) => value
  .normalize('NFD')
  .replace(/\p{Mark}+/gu, '')
  .toLocaleLowerCase('es-MX')
  .replace(/[^a-z0-9$%]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ')
  .replace(/\bdiez\b/g, '10')

const inferFaqIntent = (question: string): QueryIntent => {
  const normalizedQuestion = normalizeHelpText(question)

  if (normalizedQuestion.startsWith('donde')) return 'navigation'
  if (
    normalizedQuestion.startsWith('que es')
    || normalizedQuestion.startsWith('que significa')
  ) return 'definition'

  return 'explanation'
}

const knowledgeItems: HelpKnowledgeItem[] = [
  ...helpFaqItems.map((item): HelpKnowledgeItem => ({
    actionId: item.id === 'where-to-check-entries' ? 'entries' : undefined,
    aliases: item.keywords,
    answer: item.answer,
    examples: item.examples,
    id: item.id,
    keywords: item.keywords,
    preferredIntent: inferFaqIntent(item.question),
    sourceLabel: 'Preguntas frecuentes',
    sourceType: 'faq',
    title: item.question,
  })),
  ...helpGlossaryItems.map((item): HelpKnowledgeItem => ({
    aliases: item.keywords,
    answer: item.description,
    examples: item.examples,
    id: item.id,
    keywords: item.keywords,
    preferredIntent: 'definition',
    sourceLabel: 'Glosario',
    sourceType: 'glossary',
    title: item.title,
  })),
  ...helpProductItems.map((item): HelpKnowledgeItem => ({
    actionId: item.action,
    aliases: item.aliases,
    answer: item.description,
    examples: item.examples,
    id: item.id,
    keywords: item.keywords,
    preferredIntent: item.action ? 'navigation' : 'explanation',
    sourceLabel: 'Ayuda de Pulse',
    sourceType: 'product',
    title: item.title,
  })),
]

const tokenize = (value: string) => normalizeHelpText(value)
  .split(' ')
  .filter((token) => token.length > 0 && !STOP_WORDS.has(token))

const editDistance = (first: string, second: string) => {
  if (first === second) return 0
  if (Math.abs(first.length - second.length) > 1) return 2

  const previous = Array.from({ length: second.length + 1 }, (_, index) => index)

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = [firstIndex]

    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      current[secondIndex] = Math.min(
        (current[secondIndex - 1] ?? 0) + 1,
        (previous[secondIndex] ?? 0) + 1,
        (previous[secondIndex - 1] ?? 0)
          + (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1),
      )
    }

    previous.splice(0, previous.length, ...current)
  }

  return previous[second.length] ?? 2
}

const tokenSimilarity = (queryToken: string, knowledgeToken: string) => {
  if (queryToken === knowledgeToken) return 1
  if (queryToken.length < 5 || knowledgeToken.length < 5) return 0
  return editDistance(queryToken, knowledgeToken) <= 1 ? 0.82 : 0
}

const bestTokenCoverage = (queryTokens: string[], knowledgeTokens: string[]) => {
  if (queryTokens.length === 0 || knowledgeTokens.length === 0) return 0

  const matchedWeight = queryTokens.reduce((total, queryToken) => {
    const bestMatch = knowledgeTokens.reduce((best, knowledgeToken) => (
      Math.max(best, tokenSimilarity(queryToken, knowledgeToken))
    ), 0)
    return total + bestMatch
  }, 0)

  return matchedWeight / queryTokens.length
}

const detectIntent = (query: string): QueryIntent => {
  if (/^(?:y |entonces |ahora )?(?:que es|que son|que significa|define|explicame)\b/.test(query)) {
    return 'definition'
  }

  if (
    /\b(?:donde|mostrar|muestra|muestrame|ver|consultar|ir)\b/.test(query)
    || query.startsWith('quiero ver')
  ) return 'navigation'

  if (/^(?:como|cuando|cuanto|por que|para que|que pasa)\b/.test(query)) {
    return 'explanation'
  }

  return 'unknown'
}

const stripDiscoursePrefix = (query: string) => query
  .replace(/^(?:y|entonces|ahora|bueno|oye)\s+/, '')
  .trim()

const extractConcept = (query: string, intent: QueryIntent) => {
  let concept = stripDiscoursePrefix(query)

  if (intent === 'definition') {
    concept = concept.replace(
      /^(?:que es|que son|que significa|define|explicame(?: que es)?)\s+/,
      '',
    )
  }

  return concept.replace(/^(?:el|la|los|las|un|una)\s+/, '').trim()
}

const intentPreference = (item: HelpKnowledgeItem, intent: QueryIntent) => {
  if (intent === 'unknown') return 0
  return item.preferredIntent === intent ? 0.08 : 0
}

const exactUtteranceMatch = (query: string, intent: QueryIntent) => {
  const rankedMatches = knowledgeItems.flatMap((item) => {
    const titleMatch = normalizeHelpText(item.title) === query
    const exampleMatch = item.examples.some((example) => normalizeHelpText(example) === query)
    const aliasMatch = item.aliases.some((alias) => normalizeHelpText(alias) === query)

    if (!titleMatch && !exampleMatch && !aliasMatch) return []

    return [{
      item,
      score: (titleMatch ? 3 : exampleMatch ? 2.6 : 2.3)
        + intentPreference(item, intent),
    }]
  }).sort((first, second) => second.score - first.score)

  const bestMatch = rankedMatches[0]
  const secondMatch = rankedMatches[1]

  if (!bestMatch || (secondMatch && bestMatch.score === secondMatch.score)) return undefined
  return bestMatch.item
}

const exactConceptMatch = (concept: string, intent: QueryIntent) => {
  if (!concept || tokenize(concept).length > 4) return undefined

  const rankedMatches = knowledgeItems.flatMap((item) => {
    const titleMatch = normalizeHelpText(item.title) === concept
    const aliasMatch = item.aliases.some((alias) => normalizeHelpText(alias) === concept)

    if (!titleMatch && !aliasMatch) return []

    return [{
      item,
      score: (titleMatch ? 3 : 2.2) + intentPreference(item, intent),
    }]
  }).sort((first, second) => second.score - first.score)

  const bestMatch = rankedMatches[0]
  const secondMatch = rankedMatches[1]

  if (!bestMatch || (secondMatch && bestMatch.score === secondMatch.score)) return undefined
  return bestMatch.item
}

const scoreKnowledgeItem = (
  query: string,
  intent: QueryIntent,
  item: HelpKnowledgeItem,
) => {
  const normalizedTitle = normalizeHelpText(item.title)
  const normalizedExamples = item.examples.map(normalizeHelpText)
  const normalizedAliases = item.aliases.map(normalizeHelpText)
  const normalizedKeywords = item.keywords.map(normalizeHelpText)

  if (
    editDistance(query, normalizedTitle) <= 1
    || normalizedExamples.some((example) => editDistance(query, example) <= 1)
  ) return 0.96

  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return 0

  const phraseGroups: Array<{ phrases: string[]; weight: number }> = [
    { phrases: [normalizedTitle], weight: 0.9 },
    { phrases: normalizedAliases, weight: 0.88 },
    { phrases: normalizedKeywords, weight: 0.84 },
    { phrases: normalizedExamples, weight: 0.82 },
    { phrases: [normalizeHelpText(item.answer)], weight: 0.62 },
  ]

  const containsPhraseScore = phraseGroups.reduce((best, group) => {
    const matchingPhrase = group.phrases.some((phrase) => {
      const phraseTokenCount = tokenize(phrase).length
      return queryTokens.length >= 2
        && phraseTokenCount >= 2
        && (query.includes(phrase) || phrase.includes(query))
    })
    return matchingPhrase ? Math.max(best, group.weight + 0.02) : best
  }, 0)

  const tokenScore = phraseGroups.reduce((best, group) => {
    const groupTokens = [...new Set(group.phrases.flatMap(tokenize))]
    const coverage = bestTokenCoverage(queryTokens, groupTokens)
    return Math.max(best, coverage * group.weight)
  }, 0)

  const scoreWithIntent = Math.min(
    0.99,
    Math.max(containsPhraseScore, tokenScore) + intentPreference(item, intent),
  )

  // Uma palavra genérica pode ocorrer em vários documentos. Conceitos únicos
  // já foram resolvidos pela etapa de alias exato; o restante precisa de contexto.
  return queryTokens.length === 1 ? Math.min(scoreWithIntent, 0.64) : scoreWithIntent
}

const rankKnowledge = (query: string, intent: QueryIntent) => knowledgeItems
  .map((item): RankedKnowledgeItem => ({
    item,
    score: scoreKnowledgeItem(query, intent, item),
  }))
  .sort((first, second) => second.score - first.score)

const hasHighConfidence = (
  rankedItems: RankedKnowledgeItem[],
  minimumGap = HIGH_CONFIDENCE_GAP,
) => {
  const bestMatch = rankedItems[0]
  if (!bestMatch || bestMatch.score < HIGH_CONFIDENCE_THRESHOLD) return false
  if (bestMatch.score >= 0.94) return true

  const secondScore = rankedItems[1]?.score ?? 0
  return bestMatch.score - secondScore >= minimumGap
}

const isContextualFollowUp = (query: string) => {
  const usefulTokens = tokenize(query)

  return /^(?:y|entonces|pero|tambien)\b/.test(query)
    || (
      usefulTokens.length <= 2
      && /\b(?:cambia|funciona|gana|pierde|termina|veo)\b/.test(query)
    )
}

const rankContextualKnowledge = (
  query: string,
  previousItem: HelpKnowledgeItem,
) => {
  const expandedQuery = `${normalizeHelpText(previousItem.title)} ${query}`
  const intent = detectIntent(query)

  return rankKnowledge(expandedQuery, intent)
    .map((rankedItem) => ({
      ...rankedItem,
      score: Math.min(
        0.99,
        rankedItem.score + (rankedItem.item === previousItem ? 0.3 : 0),
      ),
    }))
    .sort((first, second) => second.score - first.score)
}

const toSuggestion = (item: HelpKnowledgeItem): HelpAssistantSuggestion => ({
  id: `${item.sourceType}:${item.id}`,
  label: item.title,
  query: item.title,
})

const defaultSuggestions = () => DEFAULT_SUGGESTION_IDS
  .map((suggestionId) => knowledgeItems.find(
    (item) => `${item.sourceType}:${item.id}` === suggestionId,
  ))
  .filter((item): item is HelpKnowledgeItem => item !== undefined)
  .map(toSuggestion)

const includesAny = (query: string, terms: string[]) => terms.some((term) => (
  query.includes(normalizeHelpText(term))
))

const asksForRecommendation = (query: string) => (
  includesAny(query, [
    'cuál conviene',
    'cuál es mejor',
    'conviene up',
    'conviene down',
    'mejor up',
    'mejor down',
    'qué me recomiendas',
    'me recomiendas up',
    'me recomiendas down',
    'recomiéndame',
    'debo comprar',
    'debería comprar',
    'debería elegir',
    'compro up o down',
    'elijo up o down',
  ])
  && includesAny(query, ['up', 'down', 'arriba', 'abajo', 'comprar'])
)

const asksForPrediction = (query: string) => includesAny(query, [
  'predice',
  'predicción de bitcoin',
  'pronóstico',
  'bitcoin va a subir',
  'bitcoin va a bajar',
  'bitcoin subirá',
  'bitcoin bajará',
])

const asksForBalance = (query: string) => (
  !includesAny(query, [
    'movimiento',
    'operación',
    'operaciones',
    'historial',
    'compra',
    'venta',
  ])
  && includesAny(query, [
      'mi saldo',
      'saldo disponible',
      'saldo tengo',
      'cuánto saldo',
      'cuánto dinero tengo',
      'cuánto tengo disponible',
    ])
)

const asksForOpenEntries = (query: string) => (
  includesAny(query, [
    'mis entradas abiertas',
    'tengo entradas',
    'tengo una entrada',
    'tengo alguna entrada',
    'tengo una posición',
    'mi posición abierta',
  ])
)

const getKnowledgeItemFromSource = (
  source: HelpAssistantConversationContext['previousSource'],
) => {
  if (!source || !['faq', 'glossary', 'product'].includes(source.type)) return undefined
  return knowledgeItems.find((item) => (
    item.id === source.id && item.sourceType === source.type
  ))
}

const toKnowledgeResult = (item: HelpKnowledgeItem): HelpAssistantResult => ({
  action: item.actionId
    ? { id: item.actionId, label: ACTION_LABELS[item.actionId] }
    : undefined,
  answer: item.answer,
  confidence: 'high',
  source: {
    id: item.id,
    label: `${item.sourceLabel} · ${item.title}`,
    type: item.sourceType,
  },
  suggestions: [],
})

export const askHelpAssistant = (
  rawQuery: string,
  context: HelpAssistantContext,
  conversation: HelpAssistantConversationContext = {},
): HelpAssistantResult => {
  const query = normalizeHelpText(rawQuery)

  if (asksForRecommendation(query) || asksForPrediction(query)) {
    return {
      answer: 'Puedo explicar cómo funcionan UP y DOWN, pero no puedo recomendar una opción ni predecir el precio de Bitcoin. La decisión depende de ti.',
      confidence: 'high',
      source: {
        id: 'responsible-use',
        label: 'Ayuda de Pulse · Uso responsable',
        type: 'policy',
      },
      suggestions: [],
    }
  }

  if (asksForBalance(query)) {
    return {
      answer: `Tu saldo disponible es ${balanceFormatter.format(context.availableBalanceCents / 100)}. También puedes consultarlo en la parte superior de Pulse.`,
      confidence: 'high',
      source: {
        id: 'available-balance',
        label: 'Tu cuenta · Saldo disponible',
        type: 'account',
      },
      suggestions: [],
    }
  }

  if (asksForOpenEntries(query)) {
    return {
      action: { id: 'entries', label: ACTION_LABELS.entries },
      answer: context.hasOpenEntries
        ? 'Sí. Tienes al menos una entrada abierta. Puedes consultarla en la sección Entradas.'
        : 'Ahora no tienes entradas abiertas. Cuando participes en una ronda, podrás consultarlas en la sección Entradas.',
      confidence: 'high',
      source: {
        id: 'open-entries',
        label: 'Tu cuenta · Entradas',
        type: 'account',
      },
      suggestions: [],
    }
  }

  const intent = detectIntent(query)
  const exactMatch = exactUtteranceMatch(query, intent)
    ?? exactConceptMatch(extractConcept(query, intent), intent)

  if (exactMatch) return toKnowledgeResult(exactMatch)

  const rankedItems = rankKnowledge(query, intent)
  if (hasHighConfidence(rankedItems)) return toKnowledgeResult(rankedItems[0].item)

  const previousItem = getKnowledgeItemFromSource(conversation.previousSource)
  if (previousItem && isContextualFollowUp(query)) {
    const contextualItems = rankContextualKnowledge(query, previousItem)
    const previousRank = contextualItems.find(({ item }) => item === previousItem)
    const bestContextualRank = contextualItems[0]

    if (
      previousRank
      && previousRank.score >= HIGH_CONFIDENCE_THRESHOLD
      && previousRank.score >= bestContextualRank.score - 0.08
    ) return toKnowledgeResult(previousItem)

    if (hasHighConfidence(contextualItems, 0.04)) {
      return toKnowledgeResult(bestContextualRank.item)
    }
  }

  const possibleMatches = rankedItems
    .filter(({ score }) => score >= MEDIUM_CONFIDENCE_THRESHOLD)
    .slice(0, 3)
    .map(({ item }) => toSuggestion(item))

  if (possibleMatches.length > 0) {
    return {
      answer: '¿Te refieres a alguna de estas preguntas?',
      confidence: 'medium',
      suggestions: possibleMatches,
    }
  }

  return {
    answer: 'No encontré una respuesta segura. Puedes consultar las preguntas frecuentes o el glosario.',
    confidence: 'low',
    suggestions: defaultSuggestions(),
  }
}
