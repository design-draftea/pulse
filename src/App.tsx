import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  BuyBetslip,
  type BetslipSuccessDetails,
  type PurchaseSuccessDetails,
  type SaleSuccessDetails,
} from './components/BuyBetslip/BuyBetslip'
import { Header } from './components/Header/Header'
import {
  MarketChoice,
  type MarketSide,
} from './components/MarketChoice/MarketChoice'
import { MobileOnly } from './components/MobileOnly/MobileOnly'
import { Navbar } from './components/Navbar/Navbar'
import { MarketPriceChart } from './components/MarketPriceChart/MarketPriceChart'
import { PriceComparison } from './components/PriceComparison/PriceComparison'
import { PulseFooter } from './components/PulseFooter/PulseFooter'
import {
  PreviousRounds,
  type PreviousRound,
} from './components/PreviousRounds/PreviousRounds'
import { PurchaseSuccessToast } from './components/PurchaseSuccessToast'
import {
  RoundWinToast,
  type RoundWinDetails,
} from './components/RoundWinToast/RoundWinToast'
import { SubHeader } from './components/SubHeader/SubHeader'
import { useAnimatedMarketPrice } from './hooks/useAnimatedMarketPrice'
import { useResilientBtcMarketRound } from './hooks/useResilientBtcMarketRound'
import { useMockChartEntries } from './hooks/useMockChartEntries'
import { useOutcomeMarket } from './hooks/useOutcomeMarket'
import { usePrototypeWallet } from './hooks/usePrototypeWallet'
import {
  BTC_DISPLAY_TIME_ZONE,
  BTC_ROUND_DURATION_MS,
  fetchCompletedBtcRound,
  getBtcRoundSlug,
} from './services/marketData'
import './App.css'

const MARKET_HEADER_COMPACT_SCROLL_Y = 80
const DEFAULT_CONTENT_BOTTOM_INSET = 130
const ROUND_RESULT_PREVIEW_MODE = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get('previewRoundResult')
    === 'won'
const ROUND_RESULT_PREVIEW_SECONDS = 5
const PENDING_SETTLEMENT_RETRY_MS = 15_000
const balanceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function App() {
  const [isMarketHeaderCompact, setIsMarketHeaderCompact] = useState(false)
  const [isMarketHeaderPinned, setIsMarketHeaderPinned] = useState(false)
  const [selectedSide, setSelectedSide] = useState<MarketSide | null>(null)
  const [isPurchaseLoading, setIsPurchaseLoading] = useState(false)
  const [purchaseSuccess, setPurchaseSuccess] = useState<
    BetslipSuccessDetails | null
  >(null)
  const [contentBottomInset, setContentBottomInset] = useState(
    DEFAULT_CONTENT_BOTTOM_INSET,
  )
  const marketRound = useResilientBtcMarketRound()
  const {
    balanceCents,
    currentPosition,
    pendingRoundStarts,
    purchase,
    sell,
    settleRound,
    creditOnce,
  } = usePrototypeWallet(marketRound.roundStart)
  const outcomeMarket = useOutcomeMarket({
    roundSlug: marketRound.roundSlug,
    targetPrice: marketRound.targetPrice,
    currentPrice: marketRound.currentPrice,
    remainingSeconds: marketRound.remainingSeconds,
    hasUserInteraction: selectedSide !== null
      || currentPosition.up > 0
      || currentPosition.down > 0,
  })
  const [roundWin, setRoundWin] = useState<RoundWinDetails | null>(null)
  const [latestCompletedRound, setLatestCompletedRound] = useState<
    PreviousRound | null
  >(null)
  const [previewRemainingSeconds, setPreviewRemainingSeconds] = useState<
    number | null
  >(() => (
    ROUND_RESULT_PREVIEW_MODE ? ROUND_RESULT_PREVIEW_SECONDS : null
  ))
  const [pendingSettlementRetry, setPendingSettlementRetry] = useState(0)
  const marketHeaderSlotRef = useRef<HTMLDivElement>(null)
  const roundSnapshotRef = useRef({
    roundStart: marketRound.roundStart,
    targetPrice: marketRound.targetPrice,
    currentPrice: marketRound.currentPrice,
  })
  const animatedMarketPrice = useAnimatedMarketPrice(marketRound.currentPrice)
  const chartEntries = useMockChartEntries(marketRound.currentPrice !== null)
  const isRoundClosing = ROUND_RESULT_PREVIEW_MODE
    ? previewRemainingSeconds !== null && previewRemainingSeconds > 0
    : marketRound.remainingSeconds > 0 && marketRound.remainingSeconds <= 5
  const displayedMinutes = ROUND_RESULT_PREVIEW_MODE ? '00' : marketRound.minutes
  const displayedSeconds = previewRemainingSeconds === null
    ? marketRound.seconds
    : String(previewRemainingSeconds).padStart(2, '0')

  useEffect(() => {
    const updateMarketHeaderState = () => {
      setIsMarketHeaderPinned(
        (marketHeaderSlotRef.current?.getBoundingClientRect().top ?? 1) <= 0,
      )
      setIsMarketHeaderCompact(
        window.scrollY >= MARKET_HEADER_COMPACT_SCROLL_Y,
      )
    }

    updateMarketHeaderState()
    window.addEventListener('scroll', updateMarketHeaderState, {
      passive: true,
    })

    return () => window.removeEventListener('scroll', updateMarketHeaderState)
  }, [])

  useEffect(() => {
    if (!isRoundClosing) return undefined

    const closingFrame = window.requestAnimationFrame(() => {
      setSelectedSide(null)
      setPurchaseSuccess(null)
      setContentBottomInset(DEFAULT_CONTENT_BOTTOM_INSET)
    })

    return () => window.cancelAnimationFrame(closingFrame)
  }, [isRoundClosing])

  useEffect(() => {
    if (!ROUND_RESULT_PREVIEW_MODE) return undefined

    let remainingSeconds = ROUND_RESULT_PREVIEW_SECONDS
    const previewTimer = window.setInterval(() => {
      remainingSeconds -= 1
      setPreviewRemainingSeconds(remainingSeconds)

      if (remainingSeconds > 0) return

      window.clearInterval(previewTimer)
      const snapshot = roundSnapshotRef.current
      const targetPrice = snapshot.targetPrice
        ?? snapshot.currentPrice
        ?? 78_942.11
      const finalPrice = snapshot.currentPrice ?? targetPrice + 9.51

      setLatestCompletedRound({
        id: getBtcRoundSlug(snapshot.roundStart),
        roundStart: snapshot.roundStart,
        roundEnd: snapshot.roundStart + BTC_ROUND_DURATION_MS,
        targetPrice,
        finalPrice,
        result: finalPrice > targetPrice ? 'up' : 'down',
      })
      setRoundWin({
        roundStart: snapshot.roundStart,
        totalReceived: 149.25,
      })
      creditOnce(`preview-win:${snapshot.roundStart}`, 149.25)
    }, 1_000)

    return () => window.clearInterval(previewTimer)
  }, [creditOnce])

  useEffect(() => {
    if (ROUND_RESULT_PREVIEW_MODE) return

    const previousRound = roundSnapshotRef.current

    if (previousRound.roundStart !== marketRound.roundStart) {
      const targetPrice = previousRound.targetPrice
      const finalPrice = previousRound.currentPrice

      if (targetPrice !== null && finalPrice !== null) {
        const winner: MarketSide = finalPrice > targetPrice ? 'up' : 'down'

        setLatestCompletedRound({
          id: getBtcRoundSlug(previousRound.roundStart),
          roundStart: previousRound.roundStart,
          roundEnd: previousRound.roundStart + BTC_ROUND_DURATION_MS,
          targetPrice,
          finalPrice,
          result: winner,
        })

        const settlement = settleRound(previousRound.roundStart, winner)
        const totalReceived = settlement.payoutCents / 100

        if (totalReceived > 0) {
          setRoundWin({
            roundStart: previousRound.roundStart,
            totalReceived,
          })
        }
      }

      setSelectedSide(null)
      setPurchaseSuccess(null)
      setContentBottomInset(DEFAULT_CONTENT_BOTTOM_INSET)
      roundSnapshotRef.current = {
        roundStart: marketRound.roundStart,
        targetPrice: marketRound.targetPrice,
        currentPrice: marketRound.currentPrice,
      }
      return
    }

    if (marketRound.targetPrice !== null) {
      previousRound.targetPrice = marketRound.targetPrice
    }
    if (marketRound.currentPrice !== null) {
      previousRound.currentPrice = marketRound.currentPrice
    }
  }, [
    marketRound.currentPrice,
    marketRound.roundStart,
    marketRound.targetPrice,
    settleRound,
  ])

  const pendingRoundStartsKey = pendingRoundStarts.join(',')

  useEffect(() => {
    if (ROUND_RESULT_PREVIEW_MODE || pendingRoundStarts.length === 0) {
      return undefined
    }

    const controller = new AbortController()
    let isActive = true

    void Promise.allSettled(
      pendingRoundStarts.map((roundStart) => {
        const cachedRound = marketRound.previousRounds.find(
          ({ roundStart: completedStart }) => completedStart === roundStart,
        )

        return cachedRound
          ? Promise.resolve(cachedRound)
          : fetchCompletedBtcRound(roundStart, controller.signal)
      }),
    ).then((responses) => {
      if (!isActive) return

      let newestWinningRound: RoundWinDetails | null = null

      responses.forEach((response) => {
        if (response.status !== 'fulfilled') return

        const completedRound = response.value
        const settlement = settleRound(
          completedRound.roundStart,
          completedRound.result,
        )

        setLatestCompletedRound(completedRound)
        if (
          settlement.payoutCents > 0
          && (
            newestWinningRound === null
            || completedRound.roundStart > newestWinningRound.roundStart
          )
        ) {
          newestWinningRound = {
            roundStart: completedRound.roundStart,
            totalReceived: settlement.payoutCents / 100,
          }
        }
      })

      if (newestWinningRound) setRoundWin(newestWinningRound)
    })

    const retryTimer = window.setTimeout(() => {
      setPendingSettlementRetry((current) => current + 1)
    }, PENDING_SETTLEMENT_RETRY_MS)

    return () => {
      isActive = false
      controller.abort()
      window.clearTimeout(retryTimer)
    }
  }, [
    pendingRoundStarts,
    pendingRoundStartsKey,
    pendingSettlementRetry,
    marketRound.previousRounds,
    settleRound,
  ])

  const handlePurchaseLoadingChange = useCallback((isLoading: boolean) => {
    setIsPurchaseLoading(isLoading)
    if (isLoading) setPurchaseSuccess(null)
  }, [])

  const dismissPurchaseSuccess = useCallback(() => {
    setPurchaseSuccess(null)
  }, [])

  const dismissRoundWin = useCallback(() => {
    setRoundWin(null)
  }, [])

  const handlePurchaseExecute = useCallback((details: PurchaseSuccessDetails) => {
    const result = purchase({
      roundStart: marketRound.roundStart,
      side: details.side,
      amount: details.amount,
      participations: details.participations,
    })

    return result.applied
  }, [marketRound.roundStart, purchase])

  const handleSaleExecute = useCallback((details: SaleSuccessDetails) => {
    const result = sell({
      roundStart: marketRound.roundStart,
      side: details.side,
      amountReceived: details.amountReceived,
      participations: details.participations,
    })

    return result.applied
  }, [marketRound.roundStart, sell])

  const handleBetslipSuccess = useCallback((details: BetslipSuccessDetails) => {
    setPurchaseSuccess(details)
    setSelectedSide(null)
    setContentBottomInset(DEFAULT_CONTENT_BOTTOM_INSET)
  }, [])

  const handleBetslipOcclusionHeightChange = useCallback((height: number) => {
    setContentBottomInset(Math.max(DEFAULT_CONTENT_BOTTOM_INSET, height))
  }, [])

  const visiblePreviousRounds = useMemo(() => {
    if (!latestCompletedRound) return marketRound.previousRounds

    const officialRound = marketRound.previousRounds.find(
      ({ roundStart }) => roundStart === latestCompletedRound.roundStart,
    )
    const newestRound = officialRound ?? latestCompletedRound

    return [
      newestRound,
      ...marketRound.previousRounds.filter(
        ({ roundStart }) => roundStart !== newestRound.roundStart,
      ),
    ].slice(0, 10)
  }, [latestCompletedRound, marketRound.previousRounds])

  const appStyle = {
    '--pulse-content-bottom-inset': `${contentBottomInset}px`,
  } as CSSProperties
  const formattedBalance = balanceFormatter.format(balanceCents / 100)
  const hasActiveEntry = currentPosition.up > 0 || currentPosition.down > 0

  return (
    <>
      <div
        className={`pulse-app${isPurchaseLoading ? ' pulse-app--purchase-loading' : ''}`}
        style={appStyle}
        aria-busy={isPurchaseLoading}
        inert={isPurchaseLoading ? true : undefined}
      >
        <div className="pulse-app__background" aria-hidden="true" />

        <Header balance={formattedBalance} balanceCents={balanceCents} />
        <div ref={marketHeaderSlotRef} className="pulse-app__market-header-slot">
          <div
            className={`pulse-app__market-header${isMarketHeaderPinned ? ' pulse-app__market-header--pinned' : ''}${isMarketHeaderCompact ? ' pulse-app__market-header--compact' : ''}`}
            data-round-slug={marketRound.roundSlug}
            data-target-status={marketRound.targetStatus}
            data-target-source={marketRound.targetSource ?? ''}
            data-current-status={marketRound.currentStatus}
            data-current-source={marketRound.currentPriceSource ?? ''}
            data-current-updated-at={marketRound.currentPriceUpdatedAt ?? ''}
            data-animated-market-price={animatedMarketPrice.value ?? ''}
            data-display-time-zone={BTC_DISPLAY_TIME_ZONE}
            data-previous-rounds-status={marketRound.previousRoundsStatus}
            data-outcome-market-status={outcomeMarket.status}
            data-outcome-market-source={outcomeMarket.source}
            data-outcome-market-locked={outcomeMarket.lockedForRound}
            data-outcome-market-up={outcomeMarket.displayPrices.up ?? ''}
            data-outcome-market-down={outcomeMarket.displayPrices.down ?? ''}
            data-outcome-market-up-asks={outcomeMarket.books.up?.asks.length ?? 0}
            data-outcome-market-down-asks={outcomeMarket.books.down?.asks.length ?? 0}
            data-outcome-market-up-bids={outcomeMarket.books.up?.bids.length ?? 0}
            data-outcome-market-down-bids={outcomeMarket.books.down?.bids.length ?? 0}
            data-outcome-market-updated-at={outcomeMarket.updatedAt ?? ''}
            data-wallet-pending-rounds={pendingRoundStartsKey}
          >
            <SubHeader
              isCompact={isMarketHeaderCompact}
              date={marketRound.date}
              startTime={marketRound.startTime}
              endTime={marketRound.endTime}
              minutes={displayedMinutes}
              seconds={displayedSeconds}
            />
            <PriceComparison
              isCompact={isMarketHeaderCompact}
              targetPrice={marketRound.targetPrice}
              currentPrice={animatedMarketPrice.value}
            />
          </div>
        </div>
        <main className="pulse-app__content">
          <MarketPriceChart
            points={marketRound.points}
            targetPrice={marketRound.targetPrice}
            currentPrice={animatedMarketPrice.value}
            priceDirection={animatedMarketPrice.direction}
            directionAnimationSequence={
              animatedMarketPrice.directionAnimationSequence
            }
            entries={chartEntries}
            roundStart={marketRound.roundStart}
            currentSource={marketRound.currentPriceSource}
            currentStatus={marketRound.currentStatus}
            currentUpdatedAt={marketRound.currentPriceUpdatedAt}
          />
          <PreviousRounds
            animatedRoundStart={latestCompletedRound?.roundStart ?? null}
            rounds={visiblePreviousRounds}
          />
          <PulseFooter />
        </main>

        {selectedSide ? (
          <BuyBetslip
            market={outcomeMarket}
            side={selectedSide}
            onSideChange={setSelectedSide}
            availableBalanceCents={balanceCents}
            participations={currentPosition}
            onOcclusionHeightChange={handleBetslipOcclusionHeightChange}
            onPurchaseLoadingChange={handlePurchaseLoadingChange}
            onPurchaseExecute={handlePurchaseExecute}
            onSaleExecute={handleSaleExecute}
            onSuccess={handleBetslipSuccess}
          />
        ) : (
          <MarketChoice
            isClosing={isRoundClosing}
            prices={outcomeMarket.displayPrices}
            roundSlug={outcomeMarket.roundSlug}
            onSelect={setSelectedSide}
          />
        )}
        <Navbar hasActiveEntry={hasActiveEntry} />

        <MobileOnly />
      </div>

      {isPurchaseLoading && (
        <div className="pulse-app__interaction-lock" aria-hidden="true" />
      )}

      {purchaseSuccess && (
        <PurchaseSuccessToast
          details={purchaseSuccess}
          onDismiss={dismissPurchaseSuccess}
        />
      )}

      {roundWin && (
        <RoundWinToast
          details={roundWin}
          onDismiss={dismissRoundWin}
        />
      )}
    </>
  )
}

export default App
