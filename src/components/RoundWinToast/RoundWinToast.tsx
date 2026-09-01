import confetti from 'canvas-confetti'
import { useEffect, useRef, useState } from 'react'
import iconRoundWin from '../../assets/iconRoundWin.svg'
import './RoundWinToast.css'

const TOAST_VISIBLE_MS = 4_000
const TOAST_EXIT_MS = 300
const CONFETTI_PARTICLE_COUNT = 200
const CONFETTI_Z_INDEX = 119
const CONFETTI_COLORS = ['#4b20ff', '#7a2bff', '#9730ff']
// A queda percorre a tela inteira, então dura mais que a explosão do Pitaquinho.
const CONFETTI_TICKS = 200

type ConfettiOptions = NonNullable<Parameters<typeof confetti>[0]>

// As cinco rajadas escalonadas vêm do Pitaquinho, mas o preset de lá parte do
// rodapé e atira para cima. Aqui elas partem de fora da tela, acima do topo, e
// o leque aponta para baixo (`angle: 270`), de modo que as partículas entrem
// caindo. As velocidades são menores que as do original porque a queda cobre a
// altura inteira em vez de explodir num ponto.
const fireRoundWinConfetti = () => {
  const defaults: ConfettiOptions = {
    origin: { x: 0.5, y: -0.15 },
    angle: 270,
    zIndex: CONFETTI_Z_INDEX,
    colors: CONFETTI_COLORS,
  }

  const fire = (particleRatio: number, options: ConfettiOptions) => {
    void confetti({
      ...defaults,
      ...options,
      particleCount: Math.floor(CONFETTI_PARTICLE_COUNT * particleRatio),
      ticks: CONFETTI_TICKS,
    })
  }

  fire(0.25, { spread: 26, startVelocity: 35 })
  fire(0.2, { spread: 60, startVelocity: 30 })
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, startVelocity: 28 })
  fire(0.1, { spread: 120, startVelocity: 18, decay: 0.92, scalar: 1.2 })
  fire(0.1, { spread: 120, startVelocity: 30 })
}

const gainFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export interface RoundWinDetails {
  roundStart: number
  totalReceived: number
}

interface RoundWinToastProps {
  details: RoundWinDetails
  onDismiss: () => void
}

export function RoundWinToast({
  details,
  onDismiss,
}: RoundWinToastProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [lastRoundStart, setLastRoundStart] = useState(details.roundStart)

  // Uma vitória que chegue com o aviso já saindo precisa reabrir a permanência.
  // Ajustado no render, e não num efeito, para evitar renderização encadeada.
  if (details.roundStart !== lastRoundStart) {
    setLastRoundStart(details.roundStart)
    setIsClosing(false)
  }
  // Guarda a rodada já celebrada em vez de um booleano: duas rodadas pendentes
  // podem liquidar em sequência, e a segunda vitória merece o próprio disparo.
  // O efeito continua rodando uma vez por rodada mesmo com o StrictMode.
  const firedRoundStartRef = useRef<number | null>(null)
  const gain = gainFormatter.format(details.totalReceived)

  useEffect(() => {
    if (firedRoundStartRef.current === details.roundStart) return

    firedRoundStartRef.current = details.roundStart
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    fireRoundWinConfetti()
  }, [details.roundStart])

  // `details.roundStart` participa das dependências para que uma vitória que
  // chegue com o aviso ainda na tela reinicie a permanência em vez de herdar o
  // tempo restante da anterior.
  useEffect(() => {
    const closingTimer = window.setTimeout(
      () => setIsClosing(true),
      TOAST_VISIBLE_MS,
    )
    const dismissTimer = window.setTimeout(
      onDismiss,
      TOAST_VISIBLE_MS + TOAST_EXIT_MS,
    )

    return () => {
      window.clearTimeout(closingTimer)
      window.clearTimeout(dismissTimer)
    }
  }, [details.roundStart, onDismiss])

  return (
    <section
      className={`round-win-toast${isClosing ? ' round-win-toast--closing' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Ganaste ${gain}`}
      data-node-id="320:13133"
      data-round-start={details.roundStart}
      data-total-received={details.totalReceived}
    >
      <img src={iconRoundWin} alt="" aria-hidden="true" />
      <span>Ganaste {gain}</span>
    </section>
  )
}
