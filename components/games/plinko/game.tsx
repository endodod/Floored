'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_BOARD_ARENA,
  GAME_CARD_SHELL,
  GAME_CONTROL_DOCK_M,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import {
  GAME_DOCK_INNER,
  GameCurrentBetBadge,
  GameDockBackButton,
  GameDockBetRow,
  GameDockChipRow,
  GameDockGameOverButton,
} from '@/components/game-dock-parts'
import { useSurvivalGameOver } from '@/hooks/use-survival-game-over'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { buildPendingResult, formatPlinkoRiskLabel } from '@/lib/game-result-labels'
import { resolveGame } from '@/lib/survival/game-resolve'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { usePerkProc } from '@/hooks/use-perk-proc'
import { PerkHint } from '@/components/survival/perk-hint'
import { pickQuote } from '@/lib/gambling-quotes'
import { computePayout, generatePath, loseGamePath, winGamePath } from '@/games/plinko/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { PlinkoPayoutResult, PlinkoRisk } from '@/games/plinko/types'
import { PlinkoBoard, type PlinkoBall } from '@/components/plinko-board'

const MIN_BALLS = 1
const MAX_BALLS = 10
/** Offset each ball's animation start so multi-drops don't stack on one peg. */
const BALL_STAGGER_MS = 120

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlinkoSession extends PlinkoBall {
  bet: number
  result: PlinkoPayoutResult
  risk: PlinkoRisk
  golden: boolean
}

interface PlinkoResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
  settleFloorBet?: boolean
  payoutAlreadyCredited?: boolean
  subRoundLoss?: boolean
}

interface PlinkoDropAccumulator {
  totalBet: number
  totalPayout: number
  maxMultiplier: number
  anyQualifyingLoss: boolean
  ballCount: number
  resolved: number
}

interface PlinkoGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<PlinkoResult>
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PlinkoGame({ mode, bankroll, onBet, onResolve }: PlinkoGameProps) {
  const floorMinBet = useSurvivalStore((s) => s.floorMinBet)
  const pendingDefeatReason = useSurvivalStore((s) => s.pendingDefeatReason)
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { plinkoGoldenBall, plinkoGoldenBallLevel } = useSurvivalPerks('plinko')
  const goldenBallProc = usePerkProc(
    mode === 'survival' && plinkoGoldenBall,
    'perk_plinko_golden_ball',
    plinkoGoldenBallLevel,
  )
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [risk, setRisk] = useState<PlinkoRisk>('medium')
  const [ballCount, setBallCount] = useState(MIN_BALLS)
  const [sessions, setSessions] = useState<PlinkoSession[]>([])
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx] = useState(0)
  const [pendingAutoReBet, setPendingAutoReBet] = useState(false)

  // Refs so the ball-complete callback never needs to be recreated
  const sessionsRef = useRef<PlinkoSession[]>([])
  sessionsRef.current = sessions
  const bankrollRef = useRef(bankroll)
  bankrollRef.current = bankroll
  // Tracks bets committed but not yet resolved — updated synchronously so rapid
  // clicks can't over-commit before React re-renders with the updated bankroll.
  const inFlightBetRef = useRef(0)
  const lastBetRef = useRef(lastBet)
  lastBetRef.current = lastBet
  const autoReBetRef = useRef(autoReBet)
  autoReBetRef.current = autoReBet
  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve
  const goldenBallProcRef = useRef(goldenBallProc)
  goldenBallProcRef.current = goldenBallProc
  const minBetRef = useRef(minBet)
  minBetRef.current = minBet
  const modeRef = useRef(mode)
  modeRef.current = mode
  const dropAccumulatorRef = useRef<PlinkoDropAccumulator | null>(null)

  const isDropping = sessions.length > 0
  const { showGameOver, handleGameOver } = useSurvivalGameOver(mode, { idle: !isDropping })
  const commitBet = currentBet >= minBet ? currentBet : lastBet >= minBet ? lastBet : 0
  const perBallBet = commitBet >= minBet ? commitBet : minBet
  const maxAffordableBalls = Math.max(
    MIN_BALLS,
    Math.floor((bankroll - inFlightBetRef.current) / perBallBet),
  )
  const maxBalls = Math.min(MAX_BALLS, maxAffordableBalls)
  const totalCost = commitBet * ballCount
  const canDrop =
    !isDropping &&
    commitBet >= minBet &&
    totalCost >= minBet &&
    totalCost <= bankroll - inFlightBetRef.current &&
    bankroll > 0 &&
    pendingDefeatReason == null &&
    !showGameOver

  const statusMsg = isDropping
    ? `${sessions.length} ball${sessions.length === 1 ? '' : 's'} in flight`
    : 'Place chips and drop.'

  useEffect(() => {
    setBallCount((c) => Math.min(Math.max(MIN_BALLS, c), maxBalls))
  }, [maxBalls])

  function addChip(value: number) {
    const cap = Math.max(minBet, Math.floor(bankroll / ballCount))
    setCurrentBet((prev) => Math.min(prev + value, cap))
  }

  function handleDrop() {
    const bet = commitBet
    const count = Math.min(ballCount, maxBalls)
    const total = bet * count
    if (bet < minBet || total < minBet || total > bankrollRef.current - inFlightBetRef.current) return
    inFlightBetRef.current += total
    onBet?.(total)
    const goldenProc = mode === 'survival' ? goldenBallProc.rollForBet() : false
    const goldenIndex = goldenProc ? Math.floor(Math.random() * count) : -1
    const baseTime = performance.now()
    const newSessions: PlinkoSession[] = Array.from({ length: count }, (_, i) => {
      const path = blessed ? winGamePath(risk) : cursed ? loseGamePath(risk) : generatePath()
      const result = computePayout(bet, path, risk)
      return {
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        path,
        startedAt: baseTime + i * BALL_STAGGER_MS,
        bet,
        result,
        risk,
        golden: i === goldenIndex,
      }
    })
    dropAccumulatorRef.current = {
      totalBet: total,
      totalPayout: 0,
      maxMultiplier: 0,
      anyQualifyingLoss: false,
      ballCount: count,
      resolved: 0,
    }
    setSessions((prev) => [...prev, ...newSessions])
    setLastBet(bet)
    setCurrentBet(0)
    setQuoteIdx((prev) => pickQuote(prev))
  }

  // Stable callback — uses refs for all values that change over time.
  const handleBallComplete = useCallback((id: string) => {
    const session = sessionsRef.current.find((s) => s.id === id)
    if (!session) return

    setSessions((prev) => prev.filter((s) => s.id !== id))
    inFlightBetRef.current = Math.max(0, inFlightBetRef.current - session.bet)

    const goldenApplies = session.golden && session.result.multiplier > 1
    const finalPayout = goldenApplies ? session.result.payout * 2 : session.result.payout
    const finalMultiplier = goldenApplies ? session.result.multiplier * 2 : session.result.multiplier
    const finalOutcome = finalPayout > session.bet ? 'win' : finalPayout === session.bet ? 'push' : 'loss'

    const acc = dropAccumulatorRef.current
    let resolved: PlinkoResult & { firstBetWasFree?: boolean; payoutBoostMult?: number }

    if (acc && modeRef.current === 'survival') {
      acc.totalPayout += finalPayout
      acc.maxMultiplier = Math.max(acc.maxMultiplier, finalMultiplier)
      if (finalOutcome === 'loss' && session.bet >= minBetRef.current) {
        acc.anyQualifyingLoss = true
      }
      acc.resolved += 1
      const isLast = acc.resolved >= acc.ballCount

      if (!isLast) {
        resolved = resolveGame(onResolveRef.current, {
          outcome: finalOutcome,
          betAmount: session.bet,
          payout: finalPayout,
          multiplier: finalMultiplier,
          settleFloorBet: false,
        })
      } else {
        const netOutcome = acc.totalPayout > acc.totalBet ? 'win' : acc.totalPayout === acc.totalBet ? 'push' : 'loss'
        resolved = resolveGame(onResolveRef.current, {
          outcome: netOutcome,
          betAmount: acc.totalBet,
          payout: acc.totalPayout,
          multiplier: acc.maxMultiplier,
          settleFloorBet: true,
          payoutAlreadyCredited: acc.ballCount > 1,
          subRoundLoss: acc.anyQualifyingLoss,
        })
        dropAccumulatorRef.current = null
      }
    } else {
      resolved = resolveGame(onResolveRef.current, {
        outcome: finalOutcome,
        betAmount: session.bet,
        payout: finalPayout,
        multiplier: finalMultiplier,
      })
      dropAccumulatorRef.current = null
    }

    if (session.golden) goldenBallProcRef.current.resetPerk()

    const built = buildPendingResult(
      { outcome: finalOutcome, betAmount: session.bet, payout: finalPayout },
      {
        result: `${finalMultiplier}×`,
      },
      { gameMultiplier: session.result.multiplier, freeBet: resolved.firstBetWasFree },
    )
    setMatchHistory((h) => [built.entry, ...h].slice(0, 80))

    // Signal autoReBet — deferred to useEffect so bankroll is post-resolve
    if (autoReBetRef.current && sessionsRef.current.length === 1) {
      setPendingAutoReBet(true)
    }
  }, []) // stable — all values read via refs

  // Deferred autoReBet: runs after resolve updates the bankroll prop
  useEffect(() => {
    if (!pendingAutoReBet) return
    setPendingAutoReBet(false)
    if (autoReBet) setCurrentBet(Math.min(lastBet, bankroll))
  }, [pendingAutoReBet, autoReBet, lastBet, bankroll])

  const balls: PlinkoBall[] = sessions.map(({ id, path, startedAt }) => ({ id, path, startedAt }))
  const goldenBallIds = sessions.filter((s) => s.golden).map((s) => s.id)

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Plinko</span>
        <span className="text-sm text-zinc-500 truncate max-w-[60%] text-right">{statusMsg}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex flex-col w-full h-full bg-[#111113]"
        entries={matchHistory}
        gameLabel="Plinko"
        emptyHint="No drops yet — results appear after each ball lands."
        showLastBet
      >
        <GameDockBackButton mode={mode} visible={!isDropping && !showGameOver} />
        {mode === 'survival' && goldenBallProc.perkActive && isDropping && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Golden Ball — 2× payout
          </PerkHint>
        )}
        <GameCurrentBetBadge
          betAmount={sessions.reduce((s, x) => s + x.bet, 0)}
          betSpecification={isDropping ? formatPlinkoRiskLabel(risk) : undefined}
          visible={isDropping}
        />

        <div className="flex-1 min-h-0 w-full flex flex-col">
          <div className="flex flex-col items-center gap-1 pt-10 pb-1.5 sm:py-1.5">
            <span className="text-xs text-zinc-600 font-semibold uppercase tracking-widest">Risk</span>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as PlinkoRisk[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={isDropping}
                  onClick={() => setRisk(r)}
                  className={`px-3 py-0.5 rounded text-xs font-semibold transition-colors capitalize
                    ${risk === r
                      ? 'bg-white text-zinc-900'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 disabled:hover:bg-zinc-800'
                    } disabled:opacity-50`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <PlinkoBoard
              balls={balls}
              onBallComplete={handleBallComplete}
              risk={risk}
              goldenBallIds={goldenBallIds}
            />
          </div>
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={`${GAME_DOCK_INNER} min-h-0`}>
          <div className="flex flex-1 min-h-0 w-full items-center justify-center">
            <GameDockChipRow
              visible={!isDropping}
              bankroll={bankroll}
              currentBet={currentBet}
              onAddChip={addChip}
              quoteIdx={quoteIdx}
              showQuote={false}
              minBet={minBet}
            />
          </div>

          <div className="flex flex-1 min-h-0 w-full items-center justify-center">
            <GameDockBetRow
              label="Bet per Ball"
              currentBet={currentBet > 0 ? currentBet : isDropping ? lastBet : 0}
              onClear={() => {
                if (!isDropping) setCurrentBet(0)
              }}
            />
          </div>

          <div className="flex flex-1 min-h-0 w-full items-center justify-center">
            <div className="flex h-7 items-center gap-1.5 flex-wrap justify-center">
              <span className="text-zinc-500 text-xs">Balls</span>
              <button
                type="button"
                disabled={isDropping || ballCount <= MIN_BALLS}
                onClick={() => setBallCount((c) => Math.max(MIN_BALLS, c - 1))}
                className="w-7 h-7 rounded-md border border-zinc-700 hover:border-zinc-500 disabled:opacity-40 disabled:hover:border-zinc-700 text-zinc-300 hover:text-white font-bold text-sm leading-none transition-colors"
                aria-label="Fewer balls"
              >
                −
              </button>
              <span className="font-bold text-sm text-white tabular-nums min-w-[1.25rem] text-center">
                {ballCount}
              </span>
              <button
                type="button"
                disabled={isDropping || ballCount >= maxBalls}
                onClick={() => setBallCount((c) => Math.min(maxBalls, c + 1))}
                className="w-7 h-7 rounded-md border border-zinc-700 hover:border-zinc-500 disabled:opacity-40 disabled:hover:border-zinc-700 text-zinc-300 hover:text-white font-bold text-sm leading-none transition-colors"
                aria-label="More balls"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex flex-1 min-h-0 w-full items-center justify-center gap-2">
            {showGameOver ? (
              <GameDockGameOverButton onClick={handleGameOver} />
            ) : (
              <button
                type="button"
                onClick={handleDrop}
                disabled={!canDrop}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Drop →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
