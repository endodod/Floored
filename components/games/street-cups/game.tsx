'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import {
  GAME_DOCK_SETTLED_SLOT,
  GAME_DOCK_INNER,
  GAME_DOCK_ACTIONS,
  GAME_DOCK_PRIMARY_BTN,
  GameActiveBetBadge,
  GameDockBackButton,
  GameDockBetRow,
  GameDockChipRow,
  GameDockGameOverButton,
  GameDockLeaveButton,
  GameDockSettledRow,
} from '@/components/game-dock-parts'
import { useRunEnd } from '@/hooks/use-run-end'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { buildPendingResult, type GamePendingResult } from '@/lib/game-result-labels'
import { resolveGame } from '@/lib/survival/game-resolve'
import { streetCupsEliminatedCup } from '@/games/street-cups/engine'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { usePerkProc } from '@/hooks/use-perk-proc'
import { PerkHint } from '@/components/survival/perk-hint'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import type { StreetCupsState } from '@/games/street-cups/types'
import {
  STREET_CUPS_WIN_MULTIPLIER,
  endShuffleStreetCups,
  initStreetCups,
  loseGame,
  pickCupStreetCups,
  startStreetCups,
  winGame,
} from '@/games/street-cups/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'

/* Slot anchors (centre of each slot, as a share of the stage width). */
const SLOT_X = ['16%', '50%', '84%'] as const

/** Visual slot positions for each cup id. cupSlots[id] = slot index (0|1|2). */
type CupSlots = [number, number, number]

function swapSlotsInPlace(slots: CupSlots, slotA: number, slotB: number): CupSlots {
  const next: CupSlots = [...slots] as CupSlots
  const idA = next.indexOf(slotA)
  const idB = next.indexOf(slotB)
  if (idA !== -1 && idB !== -1) {
    next[idA] = slotB
    next[idB] = slotA
  }
  return next
}

interface CupProps {
  cupId: number
  slot: number
  lifted: boolean
  hasCrown: boolean
  pickable: boolean
  eliminated: boolean
  selected: boolean
  wrong: boolean
  onPick: (id: number) => void
}

function Crown() {
  return (
    <svg viewBox="0 0 32 24" className="h-full w-full" aria-hidden>
      <path d="M3 8l6.5 6L16 3l6.5 11L29 8l-2.5 12h-21z" fill="var(--gold)" stroke="#f3d48a" strokeWidth="1" strokeLinejoin="round" />
      <rect x="5.5" y="19.5" width="21" height="3" rx="1" fill="#b9852c" />
    </svg>
  )
}

function Cup({ cupId, slot, lifted, hasCrown, pickable, eliminated, selected, wrong, onPick }: CupProps) {
  const tone = eliminated ? 'out' : wrong ? 'wrong' : selected ? 'won' : pickable ? 'pickable' : 'idle'
  return (
    /* The slot moves the whole cup across the stage (transform only). */
    <div className="sc-slot" style={{ transform: `translateX(${SLOT_X[slot]})` }}>
      <button
        type="button"
        className={`sc-cup m-still ${eliminated ? 'g-dim' : ''} ${wrong ? 'g-shake' : ''}`}
        data-lifted={lifted}
        data-tone={tone}
        disabled={!pickable || eliminated}
        aria-label={eliminated ? `Cup ${slot + 1}: empty` : `Cup ${slot + 1}`}
        onClick={() => pickable && !eliminated && onPick(cupId)}
      >
        {/* What is under the cup, on the table; the cup lifts away to show it. */}
        <span className={`sc-prize ${hasCrown ? 'g-gold' : ''}`} aria-hidden>
          {hasCrown ? <Crown /> : <span className="sc-empty" />}
        </span>
        <span className="sc-body">
          <span className="sc-knob" />
          <span className="sc-shell" />
          {/* Cup Truth: the cup the perk rules out is crossed off. */}
          {eliminated && (
            <svg viewBox="0 0 24 24" className="sc-out" aria-hidden>
              <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
        </span>
      </button>
    </div>
  )
}

interface StreetCupsResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface StreetCupsGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<StreetCupsResult>
}

type PendingResult = GamePendingResult

export function StreetCupsGame({ mode, bankroll, onBet, onResolve }: StreetCupsGameProps) {
  const router = useRouter()
  const { autoReBet }   = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { streetCupsTruth, streetCupsTruthLevel  } = useSurvivalPerks('street-cups')
  const cupsProc = usePerkProc(
    mode === 'survival' && streetCupsTruth,
    'perk_street_cups_truth',
    streetCupsTruthLevel,
  )
  const cupsProcActiveRef = useRef(false)
  const minBet = useGameMinBet(mode)

  const [round, setRound]         = useState<StreetCupsState>(initStreetCups)
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
  const [lastBet, setLastBet]     = useState(0)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  /* cup visual positions: cupSlots[id] = slot index */
  const [cupSlots, setCupSlots]   = useState<CupSlots>([0, 1, 2])
  /* which visual slots have their cup raised */
  const [liftedSlots, setLiftedSlots] = useState<Set<number>>(new Set())
  /* can the Next button be shown */
  const [showNext, setShowNext]   = useState(false)
  const [eliminatedCupId, setEliminatedCupId] = useState<number | null>(null)

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const swapIdxRef = useRef(0)
  const cupSlotsRef = useRef<CupSlots>([0, 1, 2])

  function clearTimers() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  function addTimer(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms)
    timersRef.current.push(id)
  }

  useEffect(() => () => clearTimers(), [])

  const isBetting   = round.stage === 'betting'
  const isRevealing = round.stage === 'revealing'
  const isShuffling = round.stage === 'shuffling'
  const isPicking   = round.stage === 'picking'
  const isSettled   = round.stage === 'settled'
  const { showGameOver, handleGameOver } = useRunEnd(mode, {
    idle: !isPicking && !isRevealing && !isShuffling && (isBetting || (isSettled && showNext)),
  })

  const canStart = currentBet >= minBet && currentBet <= bankroll
  const showQuoteUntilNext = !isBetting && !isSettled
  const potentialWinnings =
    isPicking && round.betAmount > 0
      ? Math.round(round.betAmount * STREET_CUPS_WIN_MULTIPLIER)
      : 0

  function addChip(value: number) {
    setCurrentBet(prev => Math.min(prev + value, bankroll))
  }

  /* ── Start ── */
  function handleStart() {
    if (!canStart || !lock()) return
    const bet = currentBet
    onBet?.(bet)
    clearTimers()
    setLastBet(bet)
    setCurrentBet(0)
    setPendingResult(null)
    setQuoteIdx((prev) => pickQuote(prev))
    setShowNext(false)
    setCupSlots([0, 1, 2])
    cupSlotsRef.current = [0, 1, 2]
    swapIdxRef.current = 0
    setLiftedSlots(new Set())
    setEliminatedCupId(null)
    cupsProcActiveRef.current = cupsProc.rollForBet()

    const next = startStreetCups(bet)
    setRound(next)

    /* Reveal phase: lift cup at revealSlot after 300ms */
    addTimer(() => {
      setLiftedSlots(new Set([next.revealSlot!]))
    }, 300)

    /* Close cup, begin shuffle after 1200ms */
    addTimer(() => {
      setLiftedSlots(new Set())
      addTimer(() => {
        setRound(prev => ({ ...prev, stage: 'shuffling', message: 'Shuffling…' }))
        runNextSwap(next.shuffleSwaps)
      }, 350)
    }, 1200)
  }

  /* ── Shuffle ── */
  function runNextSwap(swaps: StreetCupsState['shuffleSwaps']) {
    const idx = swapIdxRef.current
    if (idx >= swaps.length) {
      /* Shuffle done — determine winner & go to picking */
      addTimer(() => {
        setRound(prev => {
          const picking = endShuffleStreetCups(prev)
          if (cupsProcActiveRef.current && picking.winningSlot != null) {
            const wrongSlot = streetCupsEliminatedCup(picking.winningSlot)
            const cupId = cupSlotsRef.current.findIndex((s) => s === wrongSlot)
            setEliminatedCupId(cupId >= 0 ? cupId : null)
          } else {
            setEliminatedCupId(null)
          }
          return picking
        })
      }, 150)
      return
    }

    const swap = swaps[idx]
    if (!swap) return
    swapIdxRef.current = idx + 1

    setCupSlots(prev => {
      const next = swapSlotsInPlace(prev, swap.a, swap.b)
      cupSlotsRef.current = next
      return next
    })

    /* Speed up toward the end for drama */
    const delay = idx < 4 ? 380 : idx < 8 ? 280 : 200
    addTimer(() => runNextSwap(swaps), delay)
  }

  /* ── Pick a cup ── */
  const handlePick = useCallback((cupId: number) => {
    if (!isPicking || (eliminatedCupId != null && cupId === eliminatedCupId)) return
    const pickedSlot = cupSlotsRef.current[cupId] ?? 0
    const settled = blessed ? winGame(round, pickedSlot) : cursed ? loseGame(round, pickedSlot) : pickCupStreetCups(round, pickedSlot)
    setRound(settled)

    /* Resolve immediately so bankroll updates */
    const payout = settled.outcome === 'win' ? Math.round(settled.betAmount * STREET_CUPS_WIN_MULTIPLIER) : 0
    const resolved = resolveGame(onResolve, {
      outcome: settled.outcome!,
      betAmount: settled.betAmount,
      payout,
      multiplier: settled.outcome === 'win' ? STREET_CUPS_WIN_MULTIPLIER : 0,
    })
    const displayPayout = resolved.payout
    const wasFree = resolved.firstBetWasFree

    /* Stage 1: lift chosen cup */
    addTimer(() => {
      setLiftedSlots(new Set<number>([pickedSlot]))
    }, 200)

    /* Stage 2: if wrong, also lift winning cup to reveal truth */
    addTimer(() => {
      const wSlot = settled.winningSlot
      if (wSlot !== null && wSlot !== pickedSlot) {
        setLiftedSlots(new Set<number>([pickedSlot, wSlot]))
      }
    }, 900)

    /* Stage 3: show result + Next button */
    addTimer(() => {
      const outcome = settled.outcome!
      const built = buildPendingResult(
        { outcome, betAmount: settled.betAmount, payout: displayPayout },
        {
          result: outcome === 'win' ? 'Win' : 'Loss',
        },
        { gameMultiplier: outcome === 'win' ? STREET_CUPS_WIN_MULTIPLIER : undefined, freeBet: wasFree },
      )
      setPendingResult(built)
      setShowNext(true)
    }, 1600)
  }, [isPicking, round, onResolve, eliminatedCupId])

  /* ── Next round ── */
  function handleNext() {
    unlock()
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    clearTimers()
    setPendingResult(null)
    if (!survivalAfterNext(mode)) return
    setShowNext(false)
    setLiftedSlots(new Set())
    setCupSlots([0, 1, 2])
    cupSlotsRef.current = [0, 1, 2]
    swapIdxRef.current = 0
    setRound(initStreetCups())
    setEliminatedCupId(null)
    if (autoReBet && lastBet >= minBet && lastBet <= bankroll) setCurrentBet(lastBet)
  }

  /* Button label / state logic */
  const actionLabel =
    isSettled && showNext ? 'Next →' :
    isShuffling || isRevealing ? 'Shuffling…' :
    isPicking ? 'Pick a cup ↑' :
    'Start →'

  const actionDisabled =
    (isBetting && !canStart) ||
    isRevealing || isShuffling || isPicking ||
    (isSettled && !showNext)

  /* Which slot has the crown displayed (only when lifted) */
  function crownSlot(): number | null {
    if (isRevealing || isShuffling) return round.revealSlot ?? null
    if (isSettled || (isPicking && round.winningSlot !== null)) return round.winningSlot
    return null
  }
  const crownAtSlot = crownSlot()

  const boardInstruction =
    isBetting
      ? 'Memorise the crown, follow the shuffle, then pick a cup.'
      : isPicking
        ? 'Tap a cup on the board.'
        : round.message

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-[13px] font-semibold text-ink">Street Cups</span>
        {isPicking && eliminatedCupId !== null && cupsProc.perkActive && (
          <PerkHint>One wrong cup eliminated</PerkHint>
        )}
        <span className="text-[13px] text-dim text-right max-w-[min(100%,28rem)]">{boardInstruction}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 py-4"
        entries={matchHistory}
        gameLabel="Street Cups"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        <GameActiveBetBadge
          betAmount={!isBetting ? round.betAmount : 0}
          visible={!isBetting && round.betAmount > 0}
        />

        {/* Cup stage */}
        <div className="sc-stage relative w-full max-w-xl">
          {([0, 1, 2] as const).map(cupId => {
            const slot      = cupSlots[cupId]
            const isLifted  = liftedSlots.has(slot)
            const hasCrown  = crownAtSlot !== null && crownAtSlot === slot
            const eliminated = eliminatedCupId === cupId
            const pickable  = isPicking && !eliminated
            const selected  = isSettled && round.playerPick === slot
            const wrong     = isSettled && round.playerPick === slot && round.outcome === 'loss'

            return (
              <Cup
                key={cupId}
                cupId={cupId}
                slot={slot}
                lifted={isLifted}
                hasCrown={hasCrown}
                pickable={pickable}
                eliminated={eliminated}
                selected={selected}
                wrong={wrong}
                onPick={handlePick}
              />
            )
          })}
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          <GameDockChipRow
            visible={isBetting || showQuoteUntilNext}
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={showQuoteUntilNext}
            minBet={minBet}
          />

          <div className={GAME_DOCK_SETTLED_SLOT}>
            {isBetting && <GameDockBetRow currentBet={currentBet} onClear={() => setCurrentBet(0)} />}
            {isPicking && potentialWinnings > 0 && (
              <p className="text-[13px] text-soft">
                Potential total winnings:{' '}
                <span className="num text-felt glow-felt">{formatChips(potentialWinnings)}</span>
              </p>
            )}
            {isSettled && pendingResult && showNext && (
              <GameDockSettledRow
                betSummary={pendingResult.betSummary}
                resultSummary={pendingResult.resultSummary}
                profitLabel={pendingResult.profitLabel}
                tone={pendingResult.tone}
              />
            )}
            {!isBetting && !isPicking && !(isSettled && pendingResult && showNext) && (
              <p className="text-sm invisible select-none">{'\u00A0'}</p>
            )}
          </div>

          <div className={GAME_DOCK_ACTIONS}>
            <div className="flex justify-center gap-2">
              {showGameOver ? (
                <GameDockGameOverButton onClick={handleGameOver} />
              ) : (
                <>
                  {isSettled && showNext && <GameDockLeaveButton mode={mode} />}
                  <button
                    type="button"
                    onClick={isSettled && showNext ? handleNext : handleStart}
                    disabled={actionDisabled}
                    className={GAME_DOCK_PRIMARY_BTN}
                  >
                    {actionLabel}
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
