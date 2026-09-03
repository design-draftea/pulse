import chartSeriesFalling from '../../assets/onboardingChartSeriesFalling.svg'
import chartSeries from '../../assets/onboardingChartSeries.svg'
import './OnboardingSeries.css'

export type OnboardingSeriesDirection = 'rising' | 'falling'

interface OnboardingSeriesProps {
  direction?: OnboardingSeriesDirection
}

/**
 * A série de preço compartilhada pelos cards 1 e 4: área em degradê e linha no
 * mesmo SVG, reveladas por uma varredura da esquerda para a direita, com o
 * marcador do gráfico real viajando na ponta dela.
 *
 * A caixa vem de quem usa, por `--onboarding-series-top` e
 * `--onboarding-series-height`: o card 1 desenha em 115px a partir de `top: 1px`
 * e o card 4 em 74px a partir de `top: 30px`. As paradas do marcador são
 * frações da caixa, então as mesmas keyframes servem a qualquer altura.
 *
 * `direction` escolhe entre as duas séries. A `rising` sobe e cruza o objetivo
 * para cima — é a do card 1, onde a rodada termina acima. A `falling` começa
 * acima e termina abaixo, que é o que o card 4 precisa: com a posição em DOWN,
 * é a queda do preço que faz a entrada valer mais. As duas são geradas pelo
 * mesmo gerador e suavizadas com a fórmula do gráfico real.
 *
 * O marcador fica fora do elemento recortado de propósito: dentro dele, a
 * varredura o cortaria pela metade.
 */
export function OnboardingSeries({ direction = 'rising' }: OnboardingSeriesProps) {
  const isFalling = direction === 'falling'

  return (
    <>
      <span className="onboarding-series">
        <img
          className="onboarding-series__plot"
          src={isFalling ? chartSeriesFalling : chartSeries}
          alt=""
        />
      </span>
      <span
        className={`onboarding-series__marker${
          isFalling ? ' onboarding-series__marker--falling' : ''
        }`}
      />
    </>
  )
}
