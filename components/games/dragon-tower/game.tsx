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
import { BoardTile, TileMark, type BoardTileState } from '@/components/games/board-tile'

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

function tileState(row: TileRow, tileIdx: number, isActive: boolean): BoardTileState {
  if (row.picked === tileIdx) return tileIdx === row.dragonAt ? 'bad' : 'safe'
  if (row.revealed && tileIdx === row.dragonAt) return 'dormant'
  return isActive ? 'hidden' : 'idle'
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
        <span className="text-[13px] font-semibold text-ink">Dragon Tower</span>
        {blindspotProc.perkActive && isClimbing && (
          <PerkHint>Safe tile marked (floors 1–2)</PerkHint>
        )}
        <span className="text-[13px] text-dim">{state.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0"
        entries={matchHistory}
        gameLabel="Dragon Tower"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        <GameActiveBetBadge
          betAmount={state.betAmount}
          betType={climbFloorLabel}
          visible={!isBetting && state.betAmount > 0}
        />

        <div className="dt-board flex h-full w-full flex-col items-center justify-center gap-[clamp(0.4rem,2.4cqh,1rem)] px-4 py-3">
          {/* The tower, top floor first. It rebuilds floor by floor when a climb starts. */}
          <div
            key={isBetting ? 'bet' : 'climb'}
            className="dt-tower dt-frame flex shrink-0 flex-col gap-[calc(var(--tile)*0.16)] [--stagger:45ms]"
          >
            {Array.from({ length: NUM_ROWS }, (_, i) => NUM_ROWS - 1 - i).map((rowIdx) => {
              const row = state.rows[rowIdx]!
              const floorNum = rowIdx + 1
              const mult = FLOOR_MULTIPLIERS[rowIdx]!
              const isActive = isClimbing && rowIdx === state.activeRow
              const isCleared = rowIdx < state.activeRow
              const isFuture = !isSettled && !isActive && !isCleared
              const hitDragon = row.picked !== null && row.picked === row.dragonAt

              return (
                <div
                  key={rowIdx}
                  className={[
                    'flex items-center gap-[calc(var(--tile)*0.2)] rounded-[calc(var(--tile)*0.3)] px-[calc(var(--tile)*0.16)] py-[calc(var(--tile)*0.08)] transition-[background-color,box-shadow,opacity] duration-300',
                    isActive ? 'bg-black/25 shadow-[inset_0_0_0_1px_rgba(79,174,132,0.55),0_0_24px_-10px_rgba(79,174,132,0.8)]' : '',
                    isFuture ? 'opacity-45' : '',
                    hitDragon && isSettled ? 'g-shake' : '',
                  ].join(' ')}
                >
                  <div className="w-[calc(var(--tile)*1.05)] shrink-0 text-right leading-none">
                    <p className={`mb-1 text-[10px] font-semibold tracking-[0.12em] ${isActive ? 'text-felt' : 'gold-print'}`}>
                      F{floorNum}
                    </p>
                    <p
                      className={`num text-[max(10px,calc(var(--tile)*0.27))] ${
                        isActive ? 'text-ink' : isCleared || (isSettled && row.picked !== null && !hitDragon) ? 'text-gold' : 'gold-print'
                      }`}
                    >
                      {mult.toFixed(2)}×
                    </p>
                  </div>
                  <div className="flex gap-[calc(var(--tile)*0.16)]">
                    {Array.from({ length: TILES_PER_ROW }, (_, ti) => {
                      const safeHintTile = [0, 1, 2].find((t) => t !== row.dragonAt) ?? 0
                      const blindspotSafe =
                        blindspotProc.perkActive &&
                        isActive &&
                        state.activeRow < 2 &&
                        row.picked === null &&
                        ti === safeHintTile
                      const tState = tileState(row, ti, isActive)
                      const mark = tState === 'safe' ? 'gem' : tState === 'bad' || tState === 'dormant' ? 'skull' : null
                      return (
                        <BoardTile
                          key={ti}
                          state={tState}
                          index={NUM_ROWS - 1 - rowIdx + ti}
                          disabled={!isActive}
                          sound="silent"
                          onClick={() => isActive && handlePickTile(ti)}
                          label={mark === 'skull' ? 'Dragon' : mark === 'gem' ? 'Safe' : `Floor ${floorNum}, tile ${ti + 1}`}
                          className={`dt-tile ${tState === 'dormant' ? 'btile-bad' : ''} ${blindspotSafe ? 'btile-hint' : ''}`}
                        >
                          {mark ? (
                            <TileMark kind={mark} />
                          ) : blindspotSafe ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-felt shadow-[0_0_8px_rgba(79,174,132,0.9)]" />
                          ) : null}
                        </BoardTile>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="dt-hint flex min-h-9 max-w-xs shrink-0 items-center px-2 text-center text-[13px] text-dim">
            {isBetting
              ? 'Climb floor by floor. Cash out after any safe tile, or keep going for higher multipliers.'
              : isClimbing
                ? 'Pick a safe tile on the active row. Hit the dragon and you lose your bet.'
                : '\u00A0'}
          </p>
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
              <p className="text-[13px] text-dim">Clear a floor to unlock cash out.</p>
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
                    className={GAME_DOCK_PRIMARY_BTN}
                  >
                    {isSettled
                      ? 'Next →'
                      : isClimbing
                        ? cashoutPayout > 0
                          ? <>Cash Out <span className="num ml-1">{formatChips(cashoutPayout)}</span></>
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
