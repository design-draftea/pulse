import {
  useEffect,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
  type UIEvent,
} from 'react'
import homeEntryLight from '../../assets/homeEntryLight.svg'
import {
  getOpenEntrySummaries,
  type OpenEntrySummary,
} from '../../services/openEntries'
import type { OutcomeSide } from '../../services/outcomeMarket'
import type {
  PrototypeWalletCostBasis,
  PrototypeWalletPosition,
} from '../../services/prototypeWallet'
import './HomeOpenEntries.css'

const payoutFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const amountFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const participationFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const ENTRY_SIDE_ORDER: Record<OutcomeSide, number> = { down: 0, up: 1 }
const CARD_GAP_PX = 8
// Teto para o scroll suave. Sem ele, uma seção já centralizada não dispara
// `scrollend` e a revelação ficaria esperando um evento que não vem.
const SCROLL_SETTLE_TIMEOUT_MS = 700
// Se o aviso de sucesso não chegar, a entrada não pode ficar retida para sempre.
const REVEAL_CUE_TIMEOUT_MS = 4000
// `animationend` não chega em aba oculta nem com movimento reduzido.
const REVEAL_SETTLE_TIMEOUT_MS = 1000

const prefersReducedMotion = () => (
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
)

// Centraliza a seção na janela e avisa quando o movimento terminou. Devolve o
// cancelamento, porque a revelação não pode continuar se o card sair antes.
const centerInViewport = (
  element: HTMLElement,
  isAnimated: boolean,
  onSettled: () => void,
) => {
  const rect = element.getBoundingClientRect()
  const maxScrollTop = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  )
  const nextScrollTop = Math.min(
    maxScrollTop,
    Math.max(
      0,
      window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2,
    ),
  )

  if (!isAnimated || Math.abs(nextScrollTop - window.scrollY) < 2) {
    window.scrollTo({ top: nextScrollTop, behavior: 'auto' })
    onSettled()

    return () => {}
  }

  let isSettled = false
  const settle = () => {
    if (isSettled) return

    isSettled = true
    window.clearTimeout(capTimer)
    window.removeEventListener('scrollend', settle)
    onSettled()
  }
  const capTimer = window.setTimeout(settle, SCROLL_SETTLE_TIMEOUT_MS)

  window.addEventListener('scrollend', settle, { once: true })
  window.scrollTo({ top: nextScrollTop, behavior: 'smooth' })

  return () => {
    isSettled = true
    window.clearTimeout(capTimer)
    window.removeEventListener('scrollend', settle)
  }
}

export interface HomeOpenEntryExit {
  side: OutcomeSide
  position: PrototypeWalletPosition
  costBasis: PrototypeWalletCostBasis
  isLeaving: boolean
}

// `held` retém a entrada até o aviso de sucesso aparecer. `reserved` já ocupa a
// altura final do card, ainda invisível, para o scroll centralizar a seção como
// ela vai ficar. `entering` roda a revelação.
type RevealPhase = 'held' | 'reserved' | 'entering'

interface RevealState {
  key: string
  phase: RevealPhase
  // Aviso que já estava na tela quando esta revelação começou. A deixa é o
  // aviso *desta* operação, então um aviso anterior ainda visível não serve.
  ignoredToast: unknown
}

interface HomeOpenEntriesProps {
  roundStart: number
  position: PrototypeWalletPosition
  costBasis: PrototypeWalletCostBasis
  // Objeto do aviso de sucesso. A referência muda a cada aviso, e é isso que
  // distingue o aviso desta operação de um anterior ainda na tela.
  successToast: unknown
  exitingEntry?: HomeOpenEntryExit | null
  onExitEnd?: () => void
  onSell: (side: OutcomeSide) => void
}

interface HomeOpenEntryCardProps {
  entry: OpenEntrySummary
  isWaiting: boolean
  isEntering: boolean
  isLeaving: boolean
  onEnterEnd: () => void
  onLeaveEnd?: () => void
  onSell: (side: OutcomeSide) => void
}

function HomeOpenEntryCard({
  entry,
  isWaiting,
  isEntering,
  isLeaving,
  onEnterEnd,
  onLeaveEnd,
  onSell,
}: HomeOpenEntryCardProps) {
  const handleAnimationEnd = (event: ReactAnimationEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return

    if (event.animationName === 'home-open-entry-card-enter') {
      onEnterEnd()
      return
    }

    if (event.animationName === 'home-open-entry-card-leave') {
      onLeaveEnd?.()
    }
  }

  return (
    <article
      className={`home-open-entry-card${isWaiting ? ' home-open-entry-card--waiting' : ''}${isEntering ? ' home-open-entry-card--entering' : ''}${isLeaving ? ' home-open-entry-card--leaving' : ''}`}
      data-entry-side={entry.side}
      data-node-id="498:13381"
      onAnimationEnd={handleAnimationEnd}
    >
      <span className="home-open-entry-card__light" aria-hidden="true">
        <img src={homeEntryLight} alt="" />
      </span>

      <div className="home-open-entry-card__body">
        <span className="home-open-entry-card__row">
          <span>Compra:</span>
          <strong
            className={`home-open-entry-card__side home-open-entry-card__side--${entry.side}`}
          >
            {entry.side.toUpperCase()}
          </strong>
        </span>
        <span className="home-open-entry-card__row">
          <span>Monto:</span>
          <strong>{amountFormatter.format(entry.amountCents / 100)}</strong>
        </span>
        <span className="home-open-entry-card__row">
          <span>Precio promedio:</span>
          <strong>{Math.round(entry.averagePriceCents)}¢</strong>
        </span>
        <span className="home-open-entry-card__row">
          <span>Participaciones:</span>
          <strong>{participationFormatter.format(entry.participations)}</strong>
        </span>
      </div>

      <div className="home-open-entry-card__footer">
        <div className="home-open-entry-card__potential">
          <span className="home-open-entry-card__potential-label">
            Ganancia potencial:
          </span>
          <span className="home-open-entry-card__value">
            <span>$</span>
            <strong>
              {payoutFormatter.format(entry.potentialPayoutCents / 100)}
            </strong>
          </span>
        </div>
        <button
          className="home-open-entry-card__sell"
          type="button"
          onClick={() => onSell(entry.side)}
        >
          Vender
        </button>
      </div>
    </article>
  )
}

export function HomeOpenEntries({
  roundStart,
  position,
  costBasis,
  successToast,
  exitingEntry,
  onExitEnd,
  onSell,
}: HomeOpenEntriesProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [reveal, setReveal] = useState<RevealState | null>(null)
  // Chave que já recebeu a deixa do aviso de sucesso.
  const [cuedKey, setCuedKey] = useState<string | null>(null)
  // Última lista já observada. `null` marca a primeira renderização, em que
  // nada é revelado: chegar à Home com posição aberta permanece neutro.
  const [trackedSignature, setTrackedSignature] = useState<string | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  // Última lista para a qual o carrossel já foi posicionado.
  const alignedSignatureRef = useRef<string | null>(null)
  const liveEntries = getOpenEntrySummaries(position, costBasis)
  // O instantâneo anterior à venda mantém o card na lista enquanto a carteira
  // já está atualizada, e sai da lista só ao fim da animação de saída.
  const heldEntry = exitingEntry
    ? getOpenEntrySummaries(exitingEntry.position, exitingEntry.costBasis)
      .find(({ side }) => side === exitingEntry.side) ?? null
    : null
  const entries = heldEntry
    ? [...liveEntries, heldEntry]
      .toSorted((left, right) => ENTRY_SIDE_ORDER[left.side] - ENTRY_SIDE_ORDER[right.side])
    : liveEntries
  const entryItems = entries.map((entry) => ({
    entry,
    key: `${roundStart}-${entry.side}`,
  }))
  const entryKeysSignature = entryItems.map(({ key }) => key).join('|')
  // Enquanto retida, a entrada nova nem entra no DOM: a seção só cresce quando
  // o aviso de sucesso já está na tela.
  // A entrada nova é retida já nesta renderização. Detectar isso num efeito
  // deixava o card entrar no DOM por uma passada antes de ser escondido, e o
  // carrossel se alinhava por essa passada.
  if (trackedSignature !== entryKeysSignature) {
    const previousKeys = new Set(
      trackedSignature ? trackedSignature.split('|') : [],
    )
    const freshKey = trackedSignature === null
      ? null
      : entryItems.map(({ key }) => key).find((key) => !previousKeys.has(key))
        ?? null

    setTrackedSignature(entryKeysSignature)

    if (freshKey !== null) {
      setReveal({ key: freshKey, phase: 'held', ignoredToast: successToast })
      // A deixa anterior precisa ser esquecida. Comprar, vender e comprar de
      // novo o mesmo lado na mesma rodada repete a chave, e uma deixa herdada
      // fazia a entrada nascer já liberada, entrando sem esperar o aviso.
      setCuedKey(null)
    }
  }

  const revealKey = reveal?.key ?? null
  const storedPhase = reveal?.phase ?? null

  // A deixa é o aviso desta operação, e ela só anda para a frente: o aviso some
  // depois de 4s e uma revelação em curso não pode voltar a ficar retida.
  if (
    storedPhase === 'held'
    && successToast !== null
    && successToast !== reveal?.ignoredToast
    && cuedKey !== revealKey
  ) {
    setCuedKey(revealKey)
  }

  const revealPhase: RevealPhase | null = storedPhase === 'held'
    && cuedKey === revealKey
    ? 'reserved'
    : storedPhase
  const visibleItems = entryItems.filter(({ key }) => (
    revealPhase !== 'held' || key !== revealKey
  ))
  const visibleKeysSignature = visibleItems.map(({ key }) => key).join('|')
  const visibleCount = visibleItems.length
  const leavingSide = exitingEntry?.isLeaving === true ? exitingEntry.side : null
  // Quantas entradas continuam existindo depois da saída em curso. É o que
  // define a largura do card, os bullets e se a seção inteira está saindo, para
  // que tudo aconteça junto com a saída, e não depois dela.
  const stayingCount = visibleItems.filter(
    ({ entry }) => entry.side !== leavingSide,
  ).length
  const isSectionLeaving = leavingSide !== null && stayingCount === 0
  // A entrada revelada sozinha na lista é a que acabou de criar a seção, então
  // o título também não existia até agora e entra com ela.
  const isTitleEntering = revealPhase === 'reserved' || revealPhase === 'entering'
    ? visibleCount === 1 && visibleItems[0].key === revealKey
    : false

  // Rede de segurança para o caso de o aviso de sucesso não aparecer: a entrada
  // não pode ficar retida fora do DOM indefinidamente.
  useEffect(() => {
    if (revealPhase !== 'held' || revealKey === null) return

    const timer = window.setTimeout(() => {
      setCuedKey(revealKey)
    }, REVEAL_CUE_TIMEOUT_MS)

    return () => window.clearTimeout(timer)
  }, [revealKey, revealPhase])

  // Com a altura final já reservada, centraliza a seção e só então revela.
  useEffect(() => {
    if (revealPhase !== 'reserved' || revealKey === null) return

    const section = sectionRef.current

    const enter = () => setReveal(
      (current) => (current === null ? null : { ...current, phase: 'entering' }),
    )

    if (section === null) {
      enter()
      return
    }

    return centerInViewport(section, !prefersReducedMotion(), enter)
  }, [revealKey, revealPhase])

  // Rede de segurança: sem `animationend` o card ficaria preso no estado de
  // entrada, que já é visualmente o estado final.
  useEffect(() => {
    if (revealPhase !== 'entering') return

    const timer = window.setTimeout(() => setReveal(null), REVEAL_SETTLE_TIMEOUT_MS)

    return () => window.clearTimeout(timer)
  }, [revealPhase])

  // Quando uma de duas entradas sai, a que fica assume a primeira posição. Se o
  // card que sai era o segundo, e a pessoa rolou até ele para vender, é o
  // carrossel que precisa voltar; se era o primeiro, o recolhimento da largura
  // já traz o outro e este scroll não tem o que fazer.
  useEffect(() => {
    if (leavingSide === null || stayingCount !== 1) return

    const track = trackRef.current

    if (!track || track.scrollLeft === 0) return

    track.scrollTo({
      left: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [leavingSide, stayingCount])

  // O carrossel só se reposiciona quando a lista muda: na entrada ele para no
  // card revelado, para a revelação não acontecer fora da tela, e na saída
  // volta ao primeiro. Depois disso a posição é de quem está navegando.
  useEffect(() => {
    if (alignedSignatureRef.current === visibleKeysSignature) return

    const track = trackRef.current
    const card = track?.querySelector<HTMLElement>('.home-open-entry-card')

    if (!track || !card) return

    alignedSignatureRef.current = visibleKeysSignature

    const revealedIndex = visibleKeysSignature
      .split('|')
      .indexOf(revealKey ?? '')

    track.scrollTo({
      left: Math.max(0, revealedIndex) * (card.offsetWidth + CARD_GAP_PX),
      behavior: 'auto',
    })
  }, [revealKey, visibleKeysSignature])

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const track = event.currentTarget
    const firstCard = track.querySelector<HTMLElement>('.home-open-entry-card')

    if (!firstCard) return

    const cardStep = firstCard.offsetWidth + CARD_GAP_PX
    const nextIndex = Math.round(track.scrollLeft / cardStep)

    setActiveIndex(Math.max(0, Math.min(visibleCount - 1, nextIndex)))
  }

  if (visibleCount === 0) return null

  return (
    <section
      className="home-open-entries"
      aria-labelledby="home-open-entries-title"
      data-entry-count={visibleCount}
      data-staying-count={stayingCount}
      data-node-id="497:12722"
      ref={sectionRef}
    >
      <div
        className={`home-open-entries__heading${isTitleEntering ? ' home-open-entries__heading--entering' : ''}${isSectionLeaving ? ' home-open-entries__heading--leaving' : ''}`}
      >
        <h2 id="home-open-entries-title" className="home-open-entries__title">
          Entradas abiertas
        </h2>
      </div>

      <div className="home-open-entries__carousel">
        <div
          className="home-open-entries__track"
          onScroll={handleScroll}
          ref={trackRef}
        >
          {visibleItems.map(({ entry, key }) => (
            <HomeOpenEntryCard
              entry={entry}
              isEntering={key === revealKey && revealPhase === 'entering'}
              isLeaving={exitingEntry?.isLeaving === true
                && exitingEntry.side === entry.side}
              isWaiting={key === revealKey && revealPhase === 'reserved'}
              key={entry.side}
              onEnterEnd={() => setReveal(
                (current) => (current?.key === key ? null : current),
              )}
              onLeaveEnd={onExitEnd}
              onSell={onSell}
            />
          ))}
        </div>

        {stayingCount > 1 && (
          <div className="home-open-entries__bullets" aria-hidden="true">
            {visibleItems.map(({ entry }, index) => (
              <span
                className={`home-open-entries__bullet${index === activeIndex ? ' home-open-entries__bullet--active' : ''}`}
                key={`${entry.side}-bullet`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
