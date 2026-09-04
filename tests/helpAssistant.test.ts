import assert from 'node:assert/strict'
import test from 'node:test'
import {
  helpFaqItems,
  helpGlossaryItems,
  helpProductItems,
  helpSmallTalkItems,
  helpTopicItems,
} from '../src/content/help/es-MX/helpContent.ts'
import {
  askHelpAssistant,
  normalizeHelpText,
} from '../src/services/helpAssistant.ts'

const context = {
  availableBalanceCents: 191_618,
  hasOpenEntries: true,
}

test('normaliza caixa, acentos, pontuação e espaços', () => {
  assert.equal(
    normalizeHelpText('  ¿DÓNDE   están mis entradas? '),
    'donde estan mis entradas',
  )
})

test('encontra cada FAQ pela pergunta oficial', () => {
  for (const faq of helpFaqItems) {
    const result = askHelpAssistant(faq.question, context)

    assert.equal(result.confidence, 'high', faq.id)
    assert.equal(result.answer, faq.answer, faq.id)
    assert.equal(result.source?.id, faq.id, faq.id)
    assert.equal(result.source?.type, 'faq', faq.id)
  }
})

test('encontra respostas por formulações alternativas', () => {
  const cases = [
    ['¿Puedo salir antes?', 'can-sell-before-end'],
    ['¿Cómo cierro mi posición?', 'can-sell-before-end'],
    ['¿De dónde sale el precio?', 'where-price-comes-from'],
    ['¿Dónde veo lo que compré?', 'where-to-check-entries'],
    ['¿Qué sucede si hay empate?', 'equal-price-result'],
  ] as const

  for (const [query, expectedSourceId] of cases) {
    const result = askHelpAssistant(query, context)

    assert.equal(result.confidence, 'high', query)
    assert.equal(result.source?.id, expectedSourceId, query)
  }
})

test('resolve conceitos curtos e perguntas de definição sem pedir confirmação', () => {
  const cases = [
    ['UP', 'up'],
    ['que es up?', 'up'],
    ['¿Qué es el DOWN?', 'down'],
    ['¿y DOWN?', 'down'],
    ['qué significa BTC', 'bitcoin'],
  ] as const

  for (const [query, expectedSourceId] of cases) {
    const result = askHelpAssistant(query, context)

    assert.equal(result.confidence, 'high', query)
    assert.equal(result.source?.type, 'glossary', query)
    assert.equal(result.source?.id, expectedSourceId, query)
  }
})

test('entende perguntas de definição para todos os termos do glossário', () => {
  for (const glossaryItem of helpGlossaryItems) {
    for (const prefix of ['qué es', 'qué significa']) {
      const query = `${prefix} ${glossaryItem.title}`
      const result = askHelpAssistant(query, context)

      assert.equal(result.confidence, 'high', query)
      assert.equal(result.source?.type, 'glossary', query)
      assert.equal(result.source?.id, glossaryItem.id, query)
    }
  }
})

test('reconhece áreas do produto por títulos, aliases e linguagem informal', () => {
  const cases = [
    ['ultimas 10 rondas', 'previous-rounds', 'previous-rounds'],
    ['últimas diez rondas', 'previous-rounds', 'previous-rounds'],
    ['rondas anteriores', 'previous-rounds', 'previous-rounds'],
    ['historial de rondas', 'previous-rounds', 'previous-rounds'],
    ['las 10 anteriores', 'previous-rounds', 'previous-rounds'],
    ['gráfico', 'price-chart', undefined],
    ['¿Cómo leo la gráfica?', 'price-chart', undefined],
    ['movimientos', 'movements', 'movements'],
    ['¿Dónde veo mis movimientos?', 'movements', 'movements'],
  ] as const

  for (const [query, expectedSourceId, expectedActionId] of cases) {
    const result = askHelpAssistant(query, context)

    assert.equal(result.confidence, 'high', query)
    assert.equal(result.source?.type, 'product', query)
    assert.equal(result.source?.id, expectedSourceId, query)
    assert.equal(result.action?.id, expectedActionId, query)
  }
})

test('classifica todos os aliases das áreas do produto', () => {
  for (const productItem of helpProductItems) {
    for (const alias of productItem.aliases) {
      const result = askHelpAssistant(alias, context)

      assert.equal(result.confidence, 'high', alias)
      assert.equal(result.source?.type, 'product', alias)
      assert.equal(result.source?.id, productItem.id, alias)
    }
  }
})

test('classifica todos os exemplos curados no conteúdo esperado', () => {
  for (const faq of helpFaqItems) {
    for (const example of faq.examples) {
      const result = askHelpAssistant(example, context)

      assert.equal(result.confidence, 'high', example)
      assert.equal(result.source?.id, faq.id, example)
    }
  }

  for (const glossaryItem of helpGlossaryItems) {
    for (const example of glossaryItem.examples) {
      const result = askHelpAssistant(example, context)

      assert.equal(result.confidence, 'high', example)
      assert.equal(result.source?.id, glossaryItem.id, example)
      assert.equal(result.source?.type, 'glossary', example)
    }
  }

  for (const productItem of helpProductItems) {
    for (const example of productItem.examples) {
      const result = askHelpAssistant(example, context)

      assert.equal(result.confidence, 'high', example)
      assert.equal(result.source?.id, productItem.id, example)
      assert.equal(result.source?.type, 'product', example)
    }
  }
})

test('tolera um erro curto de digitação em uma consulta específica', () => {
  const result = askHelpAssistant('¿Qué es el presio objetivo?', context)

  assert.equal(result.confidence, 'high')
  assert.equal(result.source?.id, 'what-is-target-price')
})

test('tolera erro de digitação em um recurso do produto', () => {
  const result = askHelpAssistant('ultmas 10 rondas', context)

  assert.equal(result.confidence, 'high')
  assert.equal(result.source?.id, 'previous-rounds')
  assert.equal(result.action?.id, 'previous-rounds')
})

test('pede esclarecimento para uma consulta ambígua', () => {
  const result = askHelpAssistant('precio', context)

  assert.equal(result.confidence, 'medium')
  assert.equal(result.answer, '¿Te refieres a alguna de estas preguntas?')
  assert.ok(result.suggestions.length > 1)
})

test('não inventa resposta para um assunto externo', () => {
  const result = askHelpAssistant('¿Cómo preparo una pizza?', context)

  assert.equal(result.confidence, 'low')
  assert.match(result.answer, /No encontré una respuesta segura/)
  assert.equal(result.source, undefined)
})

test('usa o tópico anterior somente em uma continuação curta da conversa', () => {
  const firstResult = askHelpAssistant('¿Qué es UP?', context)
  const followUp = askHelpAssistant('¿Y cuándo gana?', context, {
    previousSource: firstResult.source,
  })
  const nextConcept = askHelpAssistant('¿Y DOWN?', context, {
    previousSource: firstResult.source,
  })

  assert.equal(followUp.confidence, 'high')
  assert.equal(followUp.source?.id, 'up')
  assert.match(followUp.answer, /igual o mayor/)
  assert.equal(nextConcept.source?.id, 'down')
})

test('não força uma resposta para uma frase curta ambígua sem contexto', () => {
  const result = askHelpAssistant('cuando gana', context)

  assert.equal(result.confidence, 'medium')
  assert.ok(result.suggestions.length > 1)
})

test('recusa recomendação de UP ou DOWN e previsão de Bitcoin', () => {
  const advice = askHelpAssistant('¿Qué me recomiendas, UP o DOWN?', context)
  const prediction = askHelpAssistant('¿Bitcoin va a subir hoy?', context)

  for (const result of [advice, prediction]) {
    assert.equal(result.confidence, 'high')
    assert.equal(result.source?.type, 'policy')
    assert.match(result.answer, /no puedo recomendar|no puedo.*predecir/)
  }
})

test('responde o saldo diretamente do contexto local', () => {
  const result = askHelpAssistant('¿Cuál es mi saldo disponible?', context)

  assert.equal(result.confidence, 'high')
  assert.equal(result.source?.type, 'account')
  assert.match(result.answer, /\$1,916\.18/)
})

test('responde se existem entradas e oferece a navegação correspondente', () => {
  const withEntries = askHelpAssistant('¿Tengo entradas abiertas?', context)
  const withoutEntries = askHelpAssistant('¿Tengo entradas abiertas?', {
    ...context,
    hasOpenEntries: false,
  })

  assert.match(withEntries.answer, /Sí\. Tienes/)
  assert.match(withoutEntries.answer, /no tienes entradas abiertas/)
  assert.equal(withEntries.action?.id, 'entries')
  assert.equal(withoutEntries.action?.id, 'entries')
})

test('classifica todos os exemplos e aliases dos tópicos novos', () => {
  for (const topic of helpTopicItems) {
    for (const query of [topic.title, ...topic.examples, ...topic.aliases]) {
      const result = askHelpAssistant(query, context)

      assert.equal(result.confidence, 'high', `${topic.id} · ${query}`)
      assert.equal(result.source?.id, topic.id, `${topic.id} · ${query}`)
    }
  }
})

test('responde conversa básica em vez de cair no fallback', () => {
  for (const item of helpSmallTalkItems) {
    for (const utterance of item.utterances) {
      const result = askHelpAssistant(utterance, context)

      assert.equal(result.confidence, 'high', utterance)
      assert.equal(result.answer, item.answer, utterance)
      assert.equal(
        result.suggestions.length > 0,
        item.withMenu,
        utterance,
      )
    }
  }
})

test('conversa básica exige o enunciado inteiro, não uma palavra solta', () => {
  const result = askHelpAssistant('¿Dónde veo mis movimientos?', context)

  assert.equal(result.source?.id, 'movements')
})

test('o fallback oferece caminhos em vez de encerrar a conversa', () => {
  const result = askHelpAssistant('¿Cómo preparo una pizza?', context)

  assert.equal(result.confidence, 'low')
  assert.match(result.answer, /No encontré una respuesta segura/)
  assert.match(result.answer, /Intenta preguntarlo de otra forma/)
  assert.equal(result.suggestions.length, 3)
})

test('corrige erros de digitação usando o vocabulário do próprio catálogo', () => {
  const cases = [
    ['que es el precio objetibo', 'what-is-target-price'],
    ['puedo vender mi particiacion antes', 'can-sell-before-end'],
    ['donde veo mis movimentos', 'movements'],
  ] as const

  for (const [query, expectedId] of cases) {
    const result = askHelpAssistant(query, context)

    assert.equal(result.confidence, 'high', query)
    assert.equal(result.source?.id, expectedId, query)
  }
})

test('a correção não troca uma palavra que o catálogo já conhece', () => {
  const result = askHelpAssistant('¿Cuánto gano si acierto?', context)

  assert.equal(result.source?.id, 'possible-win')
})
