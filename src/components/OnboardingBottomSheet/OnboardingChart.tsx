import chevronsDownIcon from '../../assets/iconDoubleChevronsDown.svg'
import chevronsUpIcon from '../../assets/iconDoubleChevronsUp.svg'
import chartGlow from '../../assets/onboardingChartGlow.svg'
import { OnboardingSeries } from './OnboardingSeries'
import './OnboardingChart.css'

/**
 * O `cardAnimado` do primeiro passo. A ilustração conta a história do texto que
 * vem abaixo dela — a escolha acende, o preço é traçado e termina acima do
 * objetivo — então ela fica fora da árvore de acessibilidade: lida em voz alta,
 * `PRECIO OBJETIVO / Terminó arriba / UP 67% / DOWN 33%` viraria ruído solto.
 *
 * O DOWN é `33%`, e não os `34%` do nó do Figma, por decisão da pessoa usuária:
 * na onboarding o par soma 100 para não virar um enigma. Não é correção de um
 * erro do design — na tela real os dois percentuais saem de livros de ordens
 * independentes, cada um o ponto médio do seu livro, e a soma passar de 100 é o
 * spread do mercado, não defeito. Não alinhar isso com o Figma é intencional.
 *
 * O estado base do CSS é exatamente o quadro estático do Figma. As animações
 * apenas sobrescrevem esse estado, o que mantém a geometria reservada (nada de
 * salto de layout) e faz `prefers-reduced-motion` cair no quadro do design.
 */
export function OnboardingChart() {
  return (
    <div className="onboarding-chart" data-node-id="564:6653" aria-hidden="true">
      <div className="onboarding-chart__anima" data-node-id="564:6898">
        <span className="onboarding-chart__target-line" data-node-id="564:6904" />
        <p className="onboarding-chart__target-label" data-node-id="564:6906">
          PRECIO OBJETIVO
        </p>

        {/* Série, varredura e marcador, compartilhados com o card 4. A caixa
            vem das variáveis `--onboarding-series-*` definidas no CSS daqui. */}
        <OnboardingSeries />

        <span className="onboarding-chart__final-line" data-node-id="564:6911" />
        <span className="onboarding-chart__pill" data-node-id="564:6909">
          Terminó arriba
        </span>

        <div className="onboarding-chart__choices" data-node-id="564:6915">
          <div
            className="onboarding-chart__choice onboarding-chart__choice--up"
            data-node-id="564:6916"
          >
            <img src={chevronsUpIcon} alt="" />
            <span>UP</span>
            <span>67%</span>
          </div>
          <div
            className="onboarding-chart__choice onboarding-chart__choice--down"
            data-node-id="564:6922"
          >
            <img src={chevronsDownIcon} alt="" />
            <span>DOWN</span>
            <span>33%</span>
          </div>
        </div>
      </div>

      <img
        className="onboarding-chart__glow"
        src={chartGlow}
        alt=""
        data-node-id="564:6667"
      />
    </div>
  )
}
