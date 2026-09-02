import type { InfoModalContent } from '../InfoModal'

export type ProfileInfoId =
  | 'availableBalance'
  | 'portfolioTotal'
  | 'totalPurchases'
  | 'openEntries'
  | 'totalReceived'
  | 'netResult'

export interface ProfileInfoDefinition extends InfoModalContent {
  id: ProfileInfoId
  nodeId: string
}

export const profileInfoById: Record<ProfileInfoId, ProfileInfoDefinition> = {
  availableBalance: {
    id: 'availableBalance',
    nodeId: '383:19829',
    title: 'Saldo disponible',
    paragraphs: [
      'Es el dinero que tienes disponible para usar ahora.',
      'Puedes usar este saldo para comprar participaciones en nuevos mercados, retirar dinero o mantenerlo en tu cuenta para futuras operaciones.',
      'El saldo aumenta cuando vendes una posición o recibes el pago de un mercado finalizado. Disminuye cuando realizas una nueva compra.',
    ],
    summary: 'En resumen: el saldo disponible es el dinero que puedes usar o retirar.',
  },
  portfolioTotal: {
    id: 'portfolioTotal',
    nodeId: '389:19849',
    title: 'Portafolio total',
    paragraphs: [
      'Es el valor total de tu cuenta, considerando el valor actual de tus posiciones abiertas y tu saldo disponible.',
      'Este valor puede cambiar con el tiempo, incluso si no realizas nuevas compras o ventas, porque el precio de tus posiciones varía conforme se mueve el mercado.',
    ],
    summary: 'Portafolio total = valor actual de las posiciones abiertas + saldo disponible',
  },
  totalPurchases: {
    id: 'totalPurchases',
    nodeId: '389:19864',
    title: 'Compras totales',
    paragraphs: [
      'Es la suma de todas las compras realizadas a lo largo del tiempo, incluidas las posiciones que ya vendiste o los mercados que ya finalizaron.',
    ],
  },
  openEntries: {
    id: 'openEntries',
    nodeId: '389:19908',
    title: 'Entradas abiertas',
    paragraphs: [
      'Muestra el valor actual de tus posiciones abiertas.',
      'Este valor puede cambiar conforme se mueve el mercado, hasta que vendas tus posiciones o el mercado finalice.',
    ],
  },
  totalReceived: {
    id: 'totalReceived',
    nodeId: '389:19921',
    title: 'Total recibido',
    paragraphs: [
      'Es la suma de los valores que ya recibiste por la venta de posiciones o por la finalización de mercados.',
      'Incluye la devolución del monto invertido y las ganancias obtenidas. No incluye pagos potenciales ni el valor de las posiciones que siguen abiertas.',
    ],
  },
  netResult: {
    id: 'netResult',
    nodeId: '389:19934',
    title: 'Resultado neto',
    paragraphs: [
      'Es el resultado acumulado de todas tus operaciones. Considera lo que ya recibiste, el valor actual de tus posiciones abiertas y el total de tus compras.',
      'Puede ser positivo o negativo y cambia conforme varía el valor de tus posiciones abiertas.',
      'Si es positivo, representa una ganancia. Si es negativo, representa una pérdida.',
    ],
    summary: 'Resultado neto = Total recibido + Entradas abiertas − Compras totales',
  },
}
