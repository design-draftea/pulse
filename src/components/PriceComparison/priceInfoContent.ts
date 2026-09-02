import type { InfoModalContent } from '../InfoModal'

export type PriceInfoId = 'targetPrice' | 'currentPrice'

export const priceInfoById: Record<PriceInfoId, InfoModalContent> = {
  targetPrice: {
    title: 'Precio objetivo',
    paragraphs: [
      'Es el precio de Bitcoin registrado al inicio de la ronda. Sirve como referencia para determinar si el resultado será UP o DOWN.',
    ],
  },
  currentPrice: {
    title: 'Precio actual',
    paragraphs: [
      'Es el precio más reciente de Bitcoin mostrado durante la ronda. Puede cambiar varias veces antes de que termine el tiempo.',
    ],
  },
}
