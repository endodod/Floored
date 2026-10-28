'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_BOARD_ARENA,
  GAME_CARD_SHELL,
  GAME_CONTROL_DOCK_M,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
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
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { buildPendingResult, type GamePendingResult } from '@/lib/game-result-labels'
import { resolveGame } from '@/lib/survival/game-resolve'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { usePerkProc } from '@/hooks/use-perk-proc'
import { PerkHint } from '@/components/survival/perk-hint'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import { getSlotsResultPayout, initSlots, loseGame, PAYTABLE, spinSlots, winGame } from '@/games/slots/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { SlotsState, SlotsSymbol } from '@/games/slots/types'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'

const SYMBOL_DISPLAY: Record<SlotsSymbol, { glyph: string; color: string; bg: string }> = {
  cherry:  { glyph: '🍒', color: 'text-red-400',    bg: 'bg-red-950/60' },
  bar:     { glyph: 'BAR', color: 'text-amber-300',  bg: 'bg-amber-950/60' },
  bell:    { glyph: '🔔', color: 'text-yellow-300',  bg: 'bg-yellow-950/60' },
  diamond: { glyph: '◆',  color: 'text-cyan-300',   bg: 'bg-cyan-950/60' },
  seven:   { glyph: '7',  color: 'text-yellow-400',  bg: 'bg-yellow-900/60' },
  wild:    { glyph: '★',  color: 'text-purple-300',  bg: 'bg-purple-950/60' },
}

const PAYTABLE_GLYPH: Record<SlotsSymbol, string> = {
  cherry: '🍒', bar: 'BAR', bell: '🔔', diamond: '◆', seven: '7', wild: '★',
}

const SPIN_DURATION = 700   // all reels spinning
const STAGGER       = 250   // delay between each reel landing
const LAND_FLASH    = 350   // landing animation duration per reel

interface SlotsResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface SlotsGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<SlotsResult>
}

type PendingResult = GamePendingResult

type ReelTuple = [SlotsSymbol | null, SlotsSymbol | null, SlotsSymbol | null]
type BoolTuple  = [boolean, boolean, boolean]

function Reel({ symbol, spinning, landed }: { symbol: SlotsSymbol | null; spinning: boolean; landed: boolean }) {
  const display = symbol ? SYMBOL_DISPLAY[symbol] : null
  const isBar   = symbol === 'bar'
  const isSeven = symbol === 'seven'

  return (
    <div className={`
      relative w-24 h-28 sm:w-28 sm:h-32 rounded-xl border-2 flex items-center justify-center overflow-hidden
      ${spinning ? 'border-white/30 bg-black/40' : 'border-white/20 bg-black/30'}
      transition-colors duration-200
    `}>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-yellow-400/30 pointer-events-none" />
      <div className={`
        flex items-center justify-center w-full h-full
        ${spinning ? 'slot-reel-spinning' : ''}
        ${landed && !spinning ? 'slot-reel-landing' : ''}
      `}>
        {spinning || !display ? (
          <span className="text-4xl text-white/20">·</span>
        ) : (
          <div className={`flex flex-col items-center justify-center rounded-lg px-2 py-1 ${display.bg}`}>
            <span className={`
              ${isBar ? 'text-2xl font-black tracking-tight' : 'text-4xl'}
              ${isSeven ? 'text-5xl font-black' : ''}
              ${display.color} leading-none select-none
            `}>
              {display.glyph}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function SlotsGame({ mode, bankroll, onBet, onResolve }: SlotsGameProps) {
  const router = useRouter()
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { slotsShield, slotsShieldLevel } = useSurvivalPerks('slots')
  const shieldProc = usePerkProc(
    mode === 'survival' && slotsShield,
    'perk_slots_shield',
    slotsShieldLevel,
  )
  const minBet = useGameMinBet(mode)

  const [round, setRound] = useState<SlotsState>(initSlots())
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  // Per-reel animation state
  const [isSpinning, setIsSpinning]       = useState(false)
  const [spinningReels, setSpinningReels] = useState<BoolTuple>([false, false, false])
  const [landedReels, setLandedReels]     = useState<BoolTuple>([false, false, false])
  const [displayedReels, setDisplayedReels] = useState<ReelTuple>([null, null, null])

  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const isBetting = !isSpinning && round.stage === 'betting'
  const isSettled = !isSpinning && round.stage === 'settled'
  const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: !isSpinning })
  const canSpin   = currentBet >= minBet && currentBet <= bankroll

  useEffect(() => {
    return () => animTimers.current.forEach(clearTimeout)
  }, [])

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function handleSpin() {
    if (!canSpin || isSpinning || !lock()) return

    animTimers.current.forEach(clearTimeout)
    animTimers.current = []

    const bet = currentBet
    onBet?.(bet)
    setLastBet(bet)
    setCurrentBet(0)
    setPendingResult(null)
    setQuoteIdx((prev) => pickQuote(prev))
    setIsSpinning(true)
    setSpinningReels([true, true, true])
    setLandedReels([false, false, false])
    setDisplayedReels([null, null, null])

    const shieldActive = shieldProc.rollForBet()

    const result = blessed ? winGame(bet) : cursed ? loseGame(bet) : spinSlots(bet)

    // Reel 0 lands
    const t1 = setTimeout(() => {
      setSpinningReels([false, true, true])
      setDisplayedReels([result.reels![0], null, null])
      setLandedReels([true, false, false])
    }, SPIN_DURATION)

    const t2 = setTimeout(() => setLandedReels([false, false, false]), SPIN_DURATION + LAND_FLASH)

    // Reel 1 lands
    const t3 = setTimeout(() => {
      setSpinningReels([false, false, true])
      setDisplayedReels([result.reels![0], result.reels![1], null])
      setLandedReels([false, true, false])
    }, SPIN_DURATION + STAGGER)

    const t4 = setTimeout(() => setLandedReels([false, false, false]), SPIN_DURATION + STAGGER + LAND_FLASH)

    // Reel 2 lands
    const t5 = setTimeout(() => {
      setSpinningReels([false, false, false])
      setDisplayedReels([result.reels![0], result.reels![1], result.reels![2]])
      setLandedReels([false, false, true])
    }, SPIN_DURATION + STAGGER * 2)

    // Commit result after last reel's flash
    const t6 = setTimeout(() => {
      setLandedReels([false, false, false])
      setIsSpinning(false)
      setRound(result)

      let payout = getSlotsResultPayout(result)
      let finalOutcome: 'win' | 'loss' | 'push' =
        result.outcome === 'win' ? 'win' : 'loss'
      if (shieldActive && finalOutcome === 'loss') {
        payout = bet
        finalOutcome = 'push'
      }

      const resolved = resolveGame(onResolve, {
        outcome: finalOutcome,
        betAmount: result.betAmount,
        payout,
        multiplier: result.payoutMultiplier,
      })

      const r = result.reels!
      const line = `${PAYTABLE_GLYPH[r[0]]} ${PAYTABLE_GLYPH[r[1]]} ${PAYTABLE_GLYPH[r[2]]}`
      const isWin = finalOutcome === 'win'
      const built = buildPendingResult(
        { outcome: finalOutcome, betAmount: result.betAmount, payout: resolved.payout },
        {
          result: isWin || finalOutcome === 'push' ? line : 'No match',
        },
        {
          gameMultiplier: isWin && result.payoutMultiplier > 0 ? result.payoutMultiplier : undefined,
          payoutBoostMult: resolved.payoutBoostMult,
          freeBet: resolved.firstBetWasFree,
        },
      )
      setPendingResult(built)
      shieldProc.resetPerk()
    }, SPIN_DURATION + STAGGER * 2 + LAND_FLASH)

    animTimers.current = [t1, t2, t3, t4, t5, t6]
  }

  const handleNewRound = useCallback(() => {
    unlock()
    setRound(initSlots())
    setDisplayedReels([null, null, null])
    setLandedReels([false, false, false])
    setSpinningReels([false, false, false])
    setPendingResult(null)
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll])

  function handleNext() {
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    if (!survivalAfterNext(mode)) return
    handleNewRound()
  }

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-[13px] font-semibold text-ink">Slots</span>
        <span className="text-[13px] text-dim">{round.message}</span>
      </div>
      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 h-full w-full flex-col items-center px-4 py-4 md:px-6"
        entries={matchHistory}
        gameLabel="Slots"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {mode === 'survival' && shieldProc.perkActive && isSpinning && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            First Spin Shield — loss refunded to a push
          </PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={round.betAmount || lastBet}
          visible={!isBetting && (round.betAmount > 0 || lastBet > 0)}
        />

        <div className="flex min-h-0 flex-1 w-full max-w-sm flex-col">
          <div className="min-h-0 flex-1 shrink" aria-hidden />
          <div className="flex w-full flex-col items-center gap-4 shrink-0">
            <div className="flex h-[8.5rem] shrink-0 items-center justify-center gap-3">
              <Reel symbol={displayedReels[0]} spinning={spinningReels[0]} landed={landedReels[0]} />
              <div className="relative">
                <Reel symbol={displayedReels[1]} spinning={spinningReels[1]} landed={landedReels[1]} />
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-yellow-400/60 text-xs">▶</div>
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-yellow-400/60 text-xs">◀</div>
              </div>
              <Reel symbol={displayedReels[2]} spinning={spinningReels[2]} landed={landedReels[2]} />
            </div>

            <div
              className="w-full min-h-[12.5rem] shrink-0"
            >
              <p className="text-white/25 text-xs uppercase tracking-wider mb-2">Paytable</p>
              <div className="grid grid-cols-2 gap-1">
                {PAYTABLE.map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/5">
                    <div className="flex items-center gap-1.5">
                      {row.symbols
                        .slice(0, row.label.startsWith('Two') || row.label.startsWith('Double') ? 2 : 3)
                        .map((s, i) => (
                          <span key={i} className={`font-bold text-xs ${SYMBOL_DISPLAY[s].color}`}>
                            {PAYTABLE_GLYPH[s]}
                          </span>
                        ))}
                    </div>
                    <span
                      className={`font-bold text-sm ${row.multiplier >= 25 ? 'text-yellow-400' : row.multiplier >= 10 ? 'text-emerald-400' : 'text-white/60'}`}
                    >
                      {row.multiplier}×
                    </span>
                  </div>
                ))}
                <div className="flex items-center px-3 py-1.5 rounded-lg bg-purple-900/30 border border-purple-700/30">
                  <span className="text-purple-300 text-xs font-semibold">★ Wild — any</span>
                </div>
              </div>
            </div>

            <div className="min-h-10 flex w-full items-center justify-center px-2 shrink-0">
              <p className="text-center text-xs text-zinc-500 max-w-md">
                {isBetting
                  ? 'Match symbols on the center line to win.'
                  : isSpinning
                    ? 'Reels spinning…'
                    : '\u00A0'}
              </p>
            </div>
          </div>
          <div className="min-h-0 flex-1 shrink" aria-hidden />
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          <GameDockChipRow
            visible={isBetting || isSpinning}
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={isSpinning}
            minBet={minBet}
          />

          <div className={GAME_DOCK_SETTLED_SLOT}>
            {isBetting && <GameDockBetRow currentBet={currentBet} onClear={() => setCurrentBet(0)} />}
            {isSettled && pendingResult && (
              <GameDockSettledRow
                betSummary={pendingResult.betSummary}
                resultSummary={pendingResult.resultSummary}
                profitLabel={pendingResult.profitLabel}
                tone={pendingResult.tone}
              />
            )}
            {!isBetting && !isSpinning && !(isSettled && pendingResult) && (
              <p className="text-sm invisible select-none">{'\u00A0'}</p>
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
                    onClick={isSettled ? handleNext : handleSpin}
                    disabled={!isSettled && (!canSpin || isSpinning)}
                    className="min-w-[10.5rem] px-7 py-2 font-bold rounded-lg transition-colors text-base shadow-lg bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900"
                  >
                    {isSettled ? 'Next →' : isSpinning ? 'Spinning…' : 'Spin →'}
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
