'use client'
import type { GameMode } from '@/store/types'

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
  GAME_DOCK_PRIMARY_BTN,
  GameCurrentBetBadge,
  GameDockBackButton,
  GameDockBetRow,
  GameDockChipRow,
  GameDockGameOverButton,
} from '@/components/game-dock-parts'
import { useRunEnd } from '@/hooks/use-run-end'
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
import { useGameMinBet } from '@/hooks/use-game-min-bet'

const MIN_BALLS = 1
const MAX_BALLS = 10
/** Offset each ball's animation start so multi-drops don't stack on one peg. */
const BALL_STAGGER_MS = 120

function splitPotAcrossBalls(pot: number, count: number): number[] {
  const baseBet = Math.floor(pot / count)
  const remainder = pot - baseBet * count
  return Array.from({ length: count }, (_, i) => baseBet + (i === count - 1 ? remainder : 0))
}

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
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<PlinkoResult>
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PlinkoGame({ mode, bankroll, onBet, onResolve }: PlinkoGameProps) {
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
  const minBet = useGameMinBet(mode)

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

  const isLadder = mode === 'ladder'
  const isDropping = sessions.length > 0
  const { status: runStatus, showGameOver, handleGameOver } = useRunEnd(mode, { idle: !isDropping })
  const ladderBets = isLadder ? splitPotAcrossBalls(bankroll, ballCount) : []
  const commitBet = isLadder
    ? Math.min(...ladderBets)
    : currentBet >= minBet ? currentBet : lastBet >= minBet ? lastBet : 0
  const perBallBet = commitBet >= minBet ? commitBet : minBet
  const maxAffordableBalls = Math.max(
    MIN_BALLS,
    isLadder
      ? Math.floor(bankroll / minBet)
      : Math.floor((bankroll - inFlightBetRef.current) / perBallBet),
  )
  const maxBalls = Math.min(MAX_BALLS, maxAffordableBalls)
  const totalCost = isLadder ? ladderBets.reduce((sum, amount) => sum + amount, 0) : commitBet * ballCount
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
    : isLadder
      ? `Whole pot split across ${ballCount} ball${ballCount === 1 ? '' : 's'}.`
      : 'Place chips and drop.'

  useEffect(() => {
    if (isDropping) return
    setBallCount((c) => Math.min(Math.max(MIN_BALLS, c), maxBalls))
  }, [isDropping, maxBalls])

  function addChip(value: number) {
    const cap = Math.max(minBet, Math.floor(bankroll / ballCount))
    setCurrentBet((prev) => Math.min(prev + value, cap))
  }

  function handleDrop() {
    const bet = commitBet
    const count = Math.min(ballCount, maxBalls)
    const bets = isLadder ? splitPotAcrossBalls(bankroll, count) : Array.from({ length: count }, () => bet)
    const total = bets.reduce((sum, amount) => sum + amount, 0)
    if (bet < minBet || total < minBet || total > bankrollRef.current - inFlightBetRef.current) return
    inFlightBetRef.current += total
    onBet?.(total)
    const goldenProc = mode === 'survival' ? goldenBallProc.rollForBet() : false
    const goldenIndex = goldenProc ? Math.floor(Math.random() * count) : -1
    const baseTime = performance.now()
    const newSessions: PlinkoSession[] = Array.from({ length: count }, (_, i) => {
      const ballBet = bets[i]!
      const path = blessed ? winGamePath(risk) : cursed ? loseGamePath(risk) : generatePath()
      const result = computePayout(ballBet, path, risk)
      return {
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        path,
        startedAt: baseTime + i * BALL_STAGGER_MS,
        bet: ballBet,
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
    setLastBet(isLadder ? total : bet)
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

    if (acc && modeRef.current !== 'freeplay') {
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
        <span className="text-[13px] font-semibold text-ink">Plinko</span>
        {mode === 'survival' && goldenBallProc.perkActive && isDropping && (
          <PerkHint>Golden Ball — 2× payout</PerkHint>
        )}
        <span className="text-[13px] text-dim truncate max-w-[60%] text-right">{statusMsg}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex flex-col w-full h-full"
        entries={matchHistory}
        gameLabel="Plinko"
        emptyHint="No drops yet — results appear after each ball lands."
        showLastBet
      >
        <GameDockBackButton mode={mode} visible={!isDropping && !showGameOver} />
        <GameCurrentBetBadge
          betAmount={sessions.reduce((s, x) => s + x.bet, 0)}
          betSpecification={isDropping ? formatPlinkoRiskLabel(risk) : undefined}
          visible={isDropping}
        />

        <div className="flex-1 min-h-0 w-full flex flex-col">
          <div className="pl-top flex shrink-0 flex-col items-center gap-1 pt-12 pb-1 sm:pt-2.5">
            <div className={`flex rounded-full bg-black/25 p-1 transition-opacity ${isDropping ? 'invisible opacity-0' : ''}`} role="radiogroup" aria-label="Risk">
              {(['low', 'medium', 'high'] as PlinkoRisk[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={risk === r}
                  disabled={isDropping}
                  onClick={() => setRisk(r)}
                  className={`m-still h-7 rounded-full px-3 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                    risk === r ? 'bg-ink text-ground' : 'text-dim hover:text-ink disabled:hover:text-dim'
                  }`}
                >
                  {r[0]!.toUpperCase() + r.slice(1)} risk
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0 px-2 pb-2">
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
          <div className="flex flex-1 min-h-0 w-full flex-col items-center justify-center">
            {showGameOver && runStatus && (
              <p
                className={`text-base font-bold text-center ${runStatus.tone === 'win' ? 'text-felt' : runStatus.tone === 'loss' ? 'text-loss' : 'text-soft'}`}
              >
                {runStatus.text}
              </p>
            )}
            <GameDockChipRow
              visible={!isDropping && !showGameOver}
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
              currentBet={
                isLadder
                  ? (isDropping ? dropAccumulatorRef.current?.totalBet ?? lastBet : bankroll)
                  : currentBet > 0 ? currentBet : isDropping ? lastBet : 0
              }
              onClear={() => {
                if (!isDropping) setCurrentBet(0)
              }}
            />
          </div>

          <div className="flex flex-1 min-h-0 w-full items-center justify-center">
            <div className="flex h-7 items-center gap-1.5 flex-wrap justify-center">
                <span className="text-[13px] text-dim">Balls</span>
                <button
                  type="button"
                  disabled={isDropping || ballCount <= MIN_BALLS}
                  onClick={() => setBallCount((c) => Math.max(MIN_BALLS, c - 1))}
                  className="m-still grid h-7 w-7 place-items-center rounded-full border border-control text-soft hover:border-dim hover:text-ink disabled:opacity-40 disabled:hover:border-control disabled:hover:text-soft font-semibold text-sm leading-none transition-colors active:scale-[0.94]"
                  aria-label="Fewer balls"
                >
                  −
                </button>
                <span className="num min-w-[1.5rem] text-center text-[14px] font-semibold text-ink">
                  {ballCount}
                </span>
                <button
                  type="button"
                  disabled={isDropping || ballCount >= maxBalls}
                  onClick={() => setBallCount((c) => Math.min(maxBalls, c + 1))}
                  className="m-still grid h-7 w-7 place-items-center rounded-full border border-control text-soft hover:border-dim hover:text-ink disabled:opacity-40 disabled:hover:border-control disabled:hover:text-soft font-semibold text-sm leading-none transition-colors active:scale-[0.94]"
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
                className={GAME_DOCK_PRIMARY_BTN}
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
