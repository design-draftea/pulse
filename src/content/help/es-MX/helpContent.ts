export interface HelpFaqItem {
  answer: string
  examples: string[]
  id: string
  keywords: string[]
  question: string
}

export interface HelpGlossaryItem {
  description: string
  examples: string[]
  id: string
  keywords: string[]
  title: string
}

export type HelpProductActionId = 'movements' | 'previous-rounds'

export interface HelpProductItem {
  action?: HelpProductActionId
  aliases: string[]
  description: string
  examples: string[]
  id: string
  keywords: string[]
  title: string
}

export const helpFaqItems: HelpFaqItem[] = [
  {
    id: 'what-is-pulse',
    question: '¿Qué es Draftea Pulse?',
    answer:
      'Draftea Pulse es una experiencia en la que puedes predecir si el precio de Bitcoin terminará arriba o abajo de un valor de referencia. Cada predicción ocurre dentro de una ronda de 15 minutos. En esta versión, el saldo y las operaciones son simulados.',
    keywords: ['Draftea Pulse', 'qué es Pulse', 'cómo es Pulse', 'predicción de Bitcoin'],
    examples: [
      '¿De qué se trata Pulse?',
      '¿Cómo funciona Draftea Pulse?',
      '¿Qué puedo hacer en Pulse?',
    ],
  },
  {
    id: 'how-round-works',
    question: '¿Cómo funciona una ronda de 15 minutos?',
    answer:
      'Cada ronda comienza con un precio objetivo de Bitcoin. Durante los 15 minutos, puedes elegir si el precio terminará arriba o abajo de ese valor. Cuando el tiempo se acaba, el precio final se compara con el precio objetivo para definir el resultado.',
    keywords: ['ronda de 15 minutos', 'funcionamiento de la ronda', 'tiempo de la ronda'],
    examples: [
      '¿Qué pasa durante una ronda?',
      '¿Cuánto dura una ronda?',
      '¿Qué sucede cuando termina el tiempo?',
    ],
  },
  {
    id: 'can-play-after-start',
    question: '¿Puedo participar después de que la ronda ya comenzó?',
    answer:
      'Sí. Puedes entrar mientras la ronda siga abierta y las opciones de compra estén disponibles. Antes de confirmar, revisa cuánto tiempo queda, ya que el precio de las participaciones puede cambiar durante la ronda.',
    keywords: ['participar después', 'ronda comenzada', 'entrar tarde', 'comprar durante la ronda'],
    examples: [
      '¿Puedo entrar con la ronda empezada?',
      '¿Todavía puedo comprar?',
      '¿Puedo participar si el reloj ya comenzó?',
    ],
  },
  {
    id: 'what-is-up-down',
    question: '¿Qué significa elegir UP o DOWN?',
    answer:
      'Elige UP si crees que el precio final de Bitcoin será igual o mayor que el precio objetivo. Elige DOWN si crees que terminará por debajo. Tu selección queda asociada a esa ronda específica.',
    keywords: ['UP o DOWN', 'elegir UP', 'elegir DOWN', 'arriba o abajo'],
    examples: [
      '¿Qué quiere decir UP y DOWN?',
      '¿Cuándo gana UP?',
      '¿Cuándo gana DOWN?',
    ],
  },
  {
    id: 'what-is-target-price',
    question: '¿Qué es el precio objetivo?',
    answer:
      'Es el precio de Bitcoin registrado al inicio de la ronda y sirve como referencia para definir el resultado. Este valor permanece fijo durante los 15 minutos, aunque el precio actual siga subiendo o bajando.',
    keywords: ['precio objetivo', 'valor de referencia', 'precio inicial'],
    examples: [
      '¿Para qué sirve el precio objetivo?',
      '¿El precio objetivo cambia?',
      '¿Cuál es el valor de referencia?',
    ],
  },
  {
    id: 'where-price-comes-from',
    question: '¿De dónde viene el precio de Bitcoin que muestra Pulse?',
    answer:
      'Pulse utiliza fuentes externas de datos de mercado para mostrar el precio de Bitcoin. El precio objetivo se registra al inicio de cada ronda, mientras que el precio actual se actualiza durante la experiencia.',
    keywords: ['origen del precio', 'fuente del precio', 'datos de Bitcoin', 'precio de Bitcoin'],
    examples: [
      '¿Qué fuente usa Pulse?',
      '¿De dónde sale el precio?',
      '¿El precio de Bitcoin es real?',
    ],
  },
  {
    id: 'price-difference',
    question: '¿Por qué el precio puede ser diferente al de otras plataformas?',
    answer:
      'Cada plataforma puede consultar una fuente distinta o actualizar el precio en momentos diferentes. Por eso pueden existir pequeñas variaciones entre los valores mostrados. Para definir el resultado, Pulse utiliza la referencia establecida para la ronda.',
    keywords: ['precio diferente', 'otra plataforma', 'diferencia de precio', 'variación del precio'],
    examples: [
      '¿Por qué aquí aparece otro precio?',
      '¿Por qué no coincide con otra app?',
      'El precio es distinto al que veo en otro lugar',
    ],
  },
  {
    id: 'possible-win',
    question: '¿Cuánto puedo recibir si acierto?',
    answer:
      'Cada participación ganadora paga US$1 al finalizar la ronda. El monto total dependerá de cuántas participaciones tengas. Antes de confirmar una compra, puedes consultar el retorno potencial estimado.',
    keywords: ['cuánto recibo', 'si acierto', 'pago por participación', 'retorno potencial'],
    examples: [
      '¿Cuánto gano si acierto?',
      '¿Cuánto paga una participación?',
      '¿Dónde veo mi retorno potencial?',
    ],
  },
  {
    id: 'can-sell-before-end',
    question: '¿Puedo vender mi participación antes de que termine la ronda?',
    answer:
      'Sí. Puedes vender mientras esta opción esté disponible y exista un precio de venta. El monto que recibirás depende del valor de tus participaciones en ese momento y puede ser mayor o menor que el monto utilizado en la compra.',
    keywords: ['vender antes', 'salir antes', 'cerrar posición', 'venta anticipada'],
    examples: [
      '¿Puedo salir antes?',
      '¿Cómo cierro mi posición?',
      '¿Tengo que esperar los 15 minutos para vender?',
    ],
  },
  {
    id: 'where-to-check-entries',
    question: '¿Dónde puedo consultar mis entradas y resultados?',
    answer:
      'En la sección Entradas puedes acompañar tus participaciones abiertas y consultar las que ya terminaron. Las entradas se organizan entre Abiertas, Ganadas y Pasadas, según su estado.',
    keywords: ['mis entradas', 'ver resultados', 'entradas abiertas', 'historial de entradas'],
    examples: [
      '¿Dónde veo lo que compré?',
      '¿Dónde están mis participaciones?',
      '¿Cómo reviso mis entradas pasadas?',
    ],
  },
  {
    id: 'equal-price-result',
    question: '¿Qué pasa si el precio final es igual al precio objetivo?',
    answer:
      'Cuando ambos precios son iguales, el resultado se considera UP. La ronda se liquida siguiendo esta regla y las participaciones ganadoras se actualizan en tu saldo.',
    keywords: ['precios iguales', 'empate', 'igual al objetivo', 'resultado UP'],
    examples: [
      '¿Qué sucede si hay empate?',
      '¿Quién gana cuando los precios son iguales?',
      'El precio final quedó igual al objetivo',
    ],
  },
  {
    id: 'what-if-round-canceled',
    question: '¿Qué pasa cuando se cancela una ronda?',
    answer:
      'Si una ronda se cancela, las participaciones asociadas también se cancelan. El monto utilizado en la compra se devuelve a tu saldo y la entrada queda registrada como cancelada.',
    keywords: ['ronda cancelada', 'cancelación', 'devolución', 'entrada cancelada'],
    examples: [
      '¿Me devuelven el dinero si cancelan?',
      '¿Qué ocurre con una entrada cancelada?',
      '¿Qué sucede si la ronda no termina?',
    ],
  },
]

export const helpGlossaryItems: HelpGlossaryItem[] = [
  {
    description: 'Es un activo digital cuyo precio cambia constantemente. En Draftea Pulse, este precio se utiliza para crear las rondas y definir sus resultados.',
    id: 'bitcoin',
    title: 'Bitcoin',
    keywords: ['BTC', 'cripto', 'criptomoneda'],
    examples: ['¿Qué es Bitcoin?', '¿Qué significa BTC?'],
  },
  {
    description: 'Es el periodo de 15 minutos en el que puedes elegir UP o DOWN. Cada ronda tiene su propio precio objetivo, tiempo restante y resultado.',
    id: 'round',
    title: 'Ronda',
    keywords: ['ronda de 15 minutos', 'periodo', 'mercado'],
    examples: ['¿Qué es una ronda?', '¿Qué significa ronda?'],
  },
  {
    description: 'Es el precio de Bitcoin registrado al inicio de la ronda. Sirve como referencia para determinar si el resultado será UP o DOWN.',
    id: 'target-price',
    title: 'Precio objetivo',
    keywords: ['valor de referencia', 'precio inicial', 'objetivo'],
    examples: ['¿Qué significa precio objetivo?', '¿Qué es el objetivo?'],
  },
  {
    description: 'Es el precio más reciente de Bitcoin mostrado durante la ronda. Puede cambiar varias veces antes de que termine el tiempo.',
    id: 'current-price',
    title: 'Precio actual',
    keywords: ['precio ahora', 'valor actual', 'precio en vivo'],
    examples: ['¿Qué es el precio actual?', '¿Qué significa precio en vivo?'],
  },
  {
    description: 'Es el precio utilizado al cierre de la ronda. Se compara con el precio objetivo para definir el resultado.',
    id: 'final-price',
    title: 'Precio final',
    keywords: ['precio de cierre', 'valor final', 'cierre de ronda'],
    examples: ['¿Qué es el precio final?', '¿Cuál es el precio de cierre?'],
  },
  {
    description: 'Es la opción que representa una subida. Gana cuando el precio final es igual o mayor que el precio objetivo.',
    id: 'up',
    title: 'UP',
    keywords: ['arriba', 'subida', 'sube'],
    examples: ['¿Qué significa UP?', '¿Qué representa UP?'],
  },
  {
    description: 'Es la opción que representa una bajada. Gana cuando el precio final queda por debajo del precio objetivo.',
    id: 'down',
    title: 'DOWN',
    keywords: ['abajo', 'bajada', 'baja'],
    examples: ['¿Qué significa DOWN?', '¿Qué representa DOWN?'],
  },
  {
    description: 'Es la unidad que recibes al comprar UP o DOWN. Su valor puede cambiar durante la ronda y cada participación ganadora paga US$1.',
    id: 'participation',
    title: 'Participación',
    keywords: ['participaciones', 'unidad', 'compra'],
    examples: ['¿Qué es una participación?', '¿Qué recibo cuando compro?'],
  },
  {
    description: 'Es el registro de tu participación en una ronda. Incluye información como tu selección, el monto utilizado y el estado del resultado.',
    id: 'entry',
    title: 'Entrada',
    keywords: ['entradas', 'registro', 'predicción'],
    examples: ['¿Qué es una entrada?', '¿Qué información tiene mi entrada?'],
  },
  {
    description: 'Es el total de participaciones que mantienes en UP o DOWN dentro de una ronda. Puede aumentar con nuevas compras o disminuir cuando realizas una venta.',
    id: 'position',
    title: 'Posición',
    keywords: ['posiciones', 'total de participaciones', 'posición abierta'],
    examples: ['¿Qué es una posición?', '¿Qué significa posición abierta?'],
  },
  {
    description: 'Es el monto estimado que recibirías si tu selección gana. Puede cambiar según la cantidad y el precio de las participaciones que compres.',
    id: 'potential-return',
    title: 'Retorno potencial',
    keywords: ['ganancia potencial', 'pago estimado', 'monto estimado'],
    examples: ['¿Qué es el retorno potencial?', '¿Qué significa ganancia potencial?'],
  },
  {
    description: 'Es el proceso que ocurre después del cierre de la ronda. En ese momento se confirma el resultado, se calculan las participaciones ganadoras y se actualiza el saldo.',
    id: 'settlement',
    title: 'Liquidación',
    keywords: ['liquidar', 'cierre', 'actualización del saldo'],
    examples: ['¿Qué es la liquidación?', '¿Cuándo se actualiza el saldo al terminar?'],
  },
]

export const helpProductItems: HelpProductItem[] = [
  {
    id: 'previous-rounds',
    title: 'Últimas 10 rondas',
    description:
      'Esta sección muestra las 10 rondas completadas más recientes. En cada tarjeta puedes consultar la fecha y el horario, el precio objetivo, el precio final y si el resultado fue UP o DOWN.',
    aliases: [
      'últimas rondas',
      'últimas diez rondas',
      'rondas anteriores',
      'historial de rondas',
      'resultados recientes',
      'resultados anteriores',
      'las 10 anteriores',
    ],
    keywords: ['historial', 'rondas terminadas', 'rondas pasadas', 'últimos resultados'],
    examples: [
      '¿Qué son las últimas 10 rondas?',
      '¿Dónde veo las rondas anteriores?',
      'Muéstrame los resultados recientes',
    ],
    action: 'previous-rounds',
  },
  {
    id: 'price-chart',
    title: 'Gráfico de precio',
    description:
      'El gráfico muestra cómo cambia el precio de Bitcoin durante la ronda. La línea principal representa el precio actual y la referencia del precio objetivo te ayuda a comparar si Bitcoin está arriba o abajo en ese momento.',
    aliases: ['gráfico', 'gráfica', 'gráfico de Bitcoin', 'línea de precio'],
    keywords: ['precio en el gráfico', 'evolución del precio', 'precio durante la ronda'],
    examples: [
      '¿Qué muestra el gráfico?',
      '¿Cómo leo la gráfica?',
      '¿Qué significa la línea del gráfico?',
    ],
  },
  {
    id: 'movements',
    title: 'Movimientos',
    description:
      'En Movimientos puedes consultar las operaciones registradas en tu saldo simulado, como compras, ventas, resultados de rondas y devoluciones.',
    aliases: ['mis movimientos', 'historial de movimientos', 'operaciones de mi saldo'],
    keywords: ['compras y ventas', 'historial de operaciones', 'transacciones'],
    examples: [
      '¿Dónde veo mis movimientos?',
      '¿Dónde está mi historial de operaciones?',
      'Quiero ver mis compras y ventas',
    ],
    action: 'movements',
  },
]
