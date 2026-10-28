'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { useRunEnd } from '@/hooks/use-run-end'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { buildPendingResult, type GamePendingResult } from '@/lib/game-result-labels'
import { resolveGame } from '@/lib/survival/game-resolve'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { usePerkProc } from '@/hooks/use-perk-proc'
import { PerkHint } from '@/components/survival/perk-hint'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import {
  FLOOR_MULTIPLIERS,
  NUM_ROWS,
  TILES_PER_ROW,
  cashOut,
  initDragonTower,
  loseGame,
  pickTile,
  startDragonTower,
  winGame,
} from '@/games/dragon-tower/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { DragonTowerState, TileRow } from '@/games/dragon-tower/types'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'

interface DragonTowerResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface DragonTowerGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<DragonTowerResult>
}

type PendingResult = GamePendingResult

function tileStyle(
  row: TileRow,
  tileIdx: number,
  isActive: boolean,
  blindspotSafe: boolean,
): string {
  const base =
    'w-14 h-11 sm:w-16 sm:h-12 rounded-xl border-2 flex items-center justify-center text-lg font-bold transition-all duration-150 select-none'
  if (row.picked === tileIdx) {
    return tileIdx === row.dragonAt
      ? `${base} bg-red-800 border-red-500 text-white`
      : `${base} bg-emerald-700 border-emerald-400 text-white`
  }
  if (row.revealed && tileIdx === row.dragonAt) {
    return `${base} bg-red-950/50 border-red-800/50 text-red-700/70`
  }
  if (row.picked !== null) {
    return `${base} bg-zinc-800/30 border-zinc-800/30 text-transparent`
  }
  if (blindspotSafe) {
    return `${base} bg-emerald-950/50 border-emerald-600/70 text-emerald-300/80 ring-1 ring-emerald-500/40 cursor-pointer active:scale-95`
  }
  if (isActive) {
    return `${base} bg-zinc-700 border-zinc-500 text-zinc-400 hover:bg-fuchsia-900/60 hover:border-fuchsia-600 cursor-pointer active:scale-95`
  }
  return `${base} bg-zinc-800/50 border-zinc-700/40 text-transparent cursor-default`
}

function tileContent(row: TileRow, tileIdx: number): string {
  if (row.picked === tileIdx) {
    return tileIdx === row.dragonAt ? '🐉' : '✓'
  }
  if (row.revealed && tileIdx === row.dragonAt) return '🐉'
  return ''
}

export function DragonTowerGame({ mode, bankroll, onBet, onResolve }: DragonTowerGameProps) {
  const router = useRouter()
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { dragonBlindspot, dragonBlindspotLevel } = useSurvivalPerks('dragon-tower')
  const blindspotProc = usePerkProc(
    mode === 'survival' && dragonBlindspot,
    'perk_dragon_blindspot',
    dragonBlindspotLevel,
  )
  const minBet = useGameMinBet(mode)

  const [state, setState] = useState<DragonTowerState>(initDragonTower)
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
  const [lastBet, setLastBet] = useState(0)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  const isBetting = state.stage === 'betting'
  const isClimbing = state.stage === 'climbing'
  const isSettled = state.stage === 'cashed-out' || state.stage === 'busted'
  const { showGameOver, handleGameOver } = useRunEnd(mode, {
    idle: isBetting || (isSettled && pendingResult != null),
  })
  const canStart = currentBet >= minBet && currentBet <= bankroll

  const cashoutPayout =
    isClimbing && state.cashoutMultiplier > 0 ? Math.round(state.betAmount * state.cashoutMultiplier) : 0

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function recordOutcome(next: DragonTowerState) {
    const payout =
      next.outcome === 'win' ? Math.round(next.betAmount * next.cashoutMultiplier) : 0
    const resolved = resolveGame(onResolve, {
      outcome: next.outcome!,
      betAmount: next.betAmount,
      payout,
      multiplier: next.outcome === 'win' ? next.cashoutMultiplier : 0,
    })
    const built = buildPendingResult(
      { outcome: next.outcome!, betAmount: next.betAmount, payout: resolved.payout },
      {
        result: next.outcome === 'win' ? String(next.activeRow) : 'Burned',
        resultSpecification: next.outcome === 'win' ? 'Floor' : undefined,
      },
      { gameMultiplier: next.outcome === 'win' ? next.cashoutMultiplier : undefined, freeBet: resolved.firstBetWasFree },
    )
    setPendingResult(built)
  }

  function handleStart() {
    if (!canStart || !lock()) return
    setLastBet(currentBet)
    setPendingResult(null)
    setQuoteIdx((prev) => pickQuote(prev))
    onBet?.(currentBet)
    blindspotProc.rollForBet()
    setState(startDragonTower(currentBet))
    setCurrentBet(0)
  }

  function handlePickTile(tileIdx: number) {
    const next = blessed ? winGame(state, tileIdx) : cursed ? loseGame(state, tileIdx) : pickTile(state, tileIdx)
    setState(next)
    if (next.stage === 'busted' || next.stage === 'cashed-out') recordOutcome(next)
  }

  function handleCashOut() {
    const next = cashOut(state)
    setState(next)
    recordOutcome(next)
  }

  const handleNext = useCallback(() => {
    unlock()
    if (pendingResult) setMatchHistory((h) => [pendingResult.entry, ...h].slice(0, 80))
    setPendingResult(null)
    if (!survivalAfterNext(mode)) return
    blindspotProc.resetPerk()
    setState(initDragonTower())
    setCurrentBet(autoReBet && lastBet <= bankroll ? lastBet : 0)
  }, [pendingResult, autoReBet, lastBet, bankroll, mode])

  const climbFloorLabel =
    isClimbing || isSettled ? `Floor ${state.activeRow} · ${formatMultiplier(state.cashoutMultiplier)}` : undefined

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Dragon Tower</span>
        <span className="text-sm text-zinc-600">{state.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 py-4"
        entries={matchHistory}
        gameLabel="Dragon Tower"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {blindspotProc.perkActive && isClimbing && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">Safe tile marked (floors 1–2)</PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={state.betAmount}
          betType={climbFloorLabel}
          visible={!isBetting && state.betAmount > 0}
        />

        <div className="flex flex-col items-center w-full max-w-xs shrink-0 gap-2">
          <div className="min-h-10 flex items-center justify-center w-full shrink-0">
            <p className="text-xs text-zinc-500 text-center px-2">
              {isBetting
                ? 'Climb floor by floor. Cash out after any safe tile, or keep going for higher multipliers.'
                : isClimbing
                  ? 'Pick a safe tile on the active row. Hit the dragon and you lose your bet.'
                  : '\u00A0'}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 w-full shrink-0">
            {Array.from({ length: NUM_ROWS }, (_, i) => NUM_ROWS - 1 - i).map((rowIdx) => {
              const row = state.rows[rowIdx]!
              const floorNum = rowIdx + 1
              const mult = FLOOR_MULTIPLIERS[rowIdx]!
              const isActive = isClimbing && rowIdx === state.activeRow
              const isCleared = rowIdx < state.activeRow
              const isFuture = !isActive && !isCleared && !(isSettled && row.picked !== null)

              return (
                <div
                  key={rowIdx}
                  className={[
                    'flex items-center gap-2 rounded-xl px-2 py-1 transition-colors',
                    isActive ? 'bg-fuchsia-950/30 ring-1 ring-fuchsia-800/50' : '',
                    isCleared ? 'bg-zinc-900/40' : '',
                    isFuture ? 'opacity-40' : '',
                  ].join(' ')}
                >
                  <div className="w-14 shrink-0 text-right">
                    <p
                      className={`text-[10px] font-medium leading-none mb-0.5 ${isActive ? 'text-fuchsia-400' : isCleared ? 'text-zinc-500' : 'text-zinc-700'}`}
                    >
                      F{floorNum}
                    </p>
                    <p
                      className={`text-xs font-bold tabular-nums leading-none ${isActive ? 'text-white' : isCleared ? 'text-zinc-400' : 'text-zinc-600'}`}
                    >
                      {mult.toFixed(2)}×
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-1 justify-center">
                    {Array.from({ length: TILES_PER_ROW }, (_, ti) => {
                      const safeHintTile = [0, 1, 2].find((t) => t !== row.dragonAt) ?? 0
                      const blindspotSafe =
                        blindspotProc.perkActive &&
                        isActive &&
                        state.activeRow < 2 &&
                        row.picked === null &&
                        ti === safeHintTile
                      return (
                      <button
                        key={ti}
                        type="button"
                        disabled={!isActive}
                        onClick={() => isActive && handlePickTile(ti)}
                        className={tileStyle(row, ti, isActive, blindspotSafe)}
                      >
                        {blindspotSafe ? '·' : tileContent(row, ti)}
                      </button>
                    )})}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          <GameDockChipRow
            visible={isBetting || isClimbing}
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={isClimbing}
            minBet={minBet}
          />

          <div className={GAME_DOCK_SETTLED_SLOT}>
            {isBetting && <GameDockBetRow currentBet={currentBet} onClear={() => setCurrentBet(0)} />}
            {isClimbing && cashoutPayout === 0 && (
              <p className="text-sm text-zinc-600">Clear a floor to unlock cash out.</p>
            )}
            {isClimbing && cashoutPayout > 0 && <p className="text-sm invisible select-none">{'\u00A0'}</p>}
            {isSettled && pendingResult && (
              <GameDockSettledRow
                betSummary={pendingResult.betSummary}
                resultSummary={pendingResult.resultSummary}
                profitLabel={pendingResult.profitLabel}
                tone={pendingResult.tone}
              />
            )}
          </div>

          <div className={GAME_DOCK_ACTIONS}>
            <div className="flex justify-center gap-2">
              {showGameOver ? (
                <GameDockGameOverButton onClick={handleGameOver} />
              ) : (
                <>
                  {isSettled && <GameDockLeaveButton mode={mode} />}
                  <button
                    type="button"
                    onClick={isSettled ? handleNext : isClimbing ? handleCashOut : handleStart}
                    disabled={(isBetting && !canStart) || (isClimbing && cashoutPayout === 0)}
                    className={[
                      'min-w-[10.5rem] px-7 py-2 font-bold rounded-lg transition-colors text-base shadow-lg',
                      isClimbing && cashoutPayout > 0
                        ? 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white'
                        : 'bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900',
                    ].join(' ')}
                  >
                    {isSettled
                      ? 'Next →'
                      : isClimbing
                        ? cashoutPayout > 0
                          ? `Cash Out — ${formatChips(cashoutPayout)}`
                          : 'Cash Out'
                        : 'Climb →'}
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
