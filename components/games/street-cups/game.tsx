'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import {
  GAME_DOCK_SETTLED_SLOT,
  GAME_DOCK_INNER,
  GAME_DOCK_ACTIONS,
  GameActiveBetBadge,
  GameDockBackButton,
  GameDockBetRow,
  GameDockChipRow,
  GameDockGameOverButton,
  GameDockLeaveButton,
  GameDockSettledRow,
} from '@/components/game-dock-parts'
import { useSurvivalGameOver } from '@/hooks/use-survival-game-over'
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

/* Slot left-percent anchors (center of each slot in a 100%-wide container). */
const SLOT_X = ['16%', '50%', '84%'] as const

/* Cup colours (stone/neutral palette per lobby entry). */
const CUP_COLOR    = '#44403c'   // stone-700
const CUP_BORDER   = '#78716c'   // stone-500

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

function Cup({ cupId, slot, lifted, hasCrown, pickable, eliminated, selected, wrong, onPick }: CupProps) {
  const borderColor = eliminated ? '#52525b' : selected ? '#fbbf24' : wrong ? '#f87171' : CUP_BORDER

  return (
    /* Outer anchor: absolute within the stage, slots horizontally, 170px tall */
    <div
      style={{
        position: 'absolute',
        left: SLOT_X[slot],
        transform: 'translateX(-50%)',
        bottom: 0,
        width: 84,
        height: 170,
        transition: 'left 280ms ease-in-out',
        cursor: pickable && !eliminated ? 'pointer' : 'default',
        userSelect: 'none',
        opacity: eliminated ? 0.35 : 1,
      }}
      onClick={() => pickable && !eliminated && onPick(cupId)}
    >
      {/* Crown — absolutely pinned at the bottom (table level).
          The cup body sits on top and lifts away to reveal it. */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 28,
          lineHeight: 1,
          opacity: lifted ? 1 : 0,
          transform: lifted ? 'scale(1) translateY(0)' : 'scale(0.5) translateY(8px)',
          transition: 'opacity 220ms ease 140ms, transform 260ms ease 140ms',
          pointerEvents: 'none',
        }}
        aria-hidden
      >
        {hasCrown ? '👑' : '✗'}
      </div>

      {/* Cup body — sits at table bottom, animated upward when lifted */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          transform: lifted ? 'translateY(-58px)' : 'translateY(0)',
          transition: 'transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Cup trapezoid */}
        <div
          style={{
            width: 72,
            height: 90,
            background: CUP_COLOR,
            border: `2px solid ${borderColor}`,
            borderRadius: '12px 12px 4px 4px',
            clipPath: 'polygon(6% 0%, 94% 0%, 88% 100%, 12% 100%)',
            transition: 'border-color 200ms',
            boxShadow: selected ? '0 0 0 2px #fbbf24' : undefined,
          }}
        />
        {/* Cup base */}
        <div
          style={{
            width: 48,
            height: 8,
            background: CUP_BORDER,
            borderRadius: 4,
          }}
        />
      </div>
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
  mode: 'survival' | 'freeplay'
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<StreetCupsResult>
}

type PendingResult = GamePendingResult

export function StreetCupsGame({ mode, bankroll, onBet, onResolve }: StreetCupsGameProps) {
  const router = useRouter()
  const { floorMinBet } = useSurvivalStore()
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
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound]         = useState<StreetCupsState>(initStreetCups)
  const [currentBet, setCurrentBet] = useState(0)
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
  const { showGameOver, handleGameOver } = useSurvivalGameOver(mode, {
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
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Street Cups</span>
        <span className="text-sm text-zinc-600 text-right max-w-[min(100%,28rem)]">{boardInstruction}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-end px-4 py-4"
        entries={matchHistory}
        gameLabel="Street Cups"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {isPicking && eliminatedCupId !== null && cupsProc.perkActive && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            One wrong cup eliminated
          </PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={!isBetting ? round.betAmount : 0}
          visible={!isBetting && round.betAmount > 0}
        />

        {/* Cup stage */}
        <div className="relative w-full" style={{ height: 180 }}>
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
              <p className="text-sm text-zinc-400">
                Potential total winnings:{' '}
                <span className="font-semibold text-emerald-400">{formatChips(potentialWinnings)}</span>
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
                    className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
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
