'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
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

/** Each symbol drawn on the ivory reel face (viewBox 0 0 40 40). */
function SlotSymbol({ symbol, className = '' }: { symbol: SlotsSymbol; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-label={symbol} role="img">
      {symbol === 'cherry' && (
        <>
          <path d="M14 26 C15 17 20 11 27 7 M26 25 C25 18 25 12 27 7" fill="none" stroke="#2a7a57" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M27 7 C31 6 34 8 35 11 C31 12 28 10 27 7 Z" fill="#2a7a57" />
          <circle cx="13" cy="28" r="7" fill="#b8263d" />
          <circle cx="26" cy="27" r="7" fill="#c8283f" />
          <circle cx="10.5" cy="25.5" r="1.8" fill="#fff" opacity="0.55" />
          <circle cx="23.5" cy="24.5" r="1.8" fill="#fff" opacity="0.55" />
        </>
      )}
      {symbol === 'bar' && (
        <>
          <rect x="4" y="12" width="32" height="16" rx="3" fill="#17161a" stroke="#d9a441" strokeWidth="1.4" />
          <text x="20" y="20.8" textAnchor="middle" dominantBaseline="middle" fill="#f4f1ea" style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, fontFamily: 'var(--font-floored-sans), sans-serif' }}>BAR</text>
        </>
      )}
      {symbol === 'bell' && (
        <>
          <path d="M20 6 C12 6 11 14 11 20 C11 25 9 27 7 29 L33 29 C31 27 29 25 29 20 C29 14 28 6 20 6 Z" fill="#d9a441" stroke="#8a6420" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M15 11 C14 14 14 18 14 22" fill="none" stroke="#f2d48f" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="20" cy="31.5" r="3" fill="#8a6420" />
          <rect x="18.5" y="3" width="3" height="4" rx="1.2" fill="#8a6420" />
        </>
      )}
      {symbol === 'diamond' && (
        <>
          <path d="M20 35 L5 15 L11 7 L29 7 L35 15 Z" fill="#2f6fd1" stroke="#1b3f7a" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M5 15 L35 15 M11 7 L15 15 L20 35 L25 15 L29 7 M15 15 L20 7 L25 15" fill="none" stroke="#9cc0f5" strokeWidth="0.9" strokeLinejoin="round" opacity="0.8" />
        </>
      )}
      {symbol === 'seven' && (
        <text x="20" y="22" textAnchor="middle" dominantBaseline="middle" fill="#c8283f" stroke="#8a6420" strokeWidth="1.2" paintOrder="stroke" style={{ fontSize: 34, fontWeight: 900, fontFamily: 'Georgia, serif' }}>7</text>
      )}
      {symbol === 'wild' && (
        <>
          <path d="M20 4 L24.4 14.6 L35.8 15.5 L27.1 22.9 L29.8 34 L20 28 L10.2 34 L12.9 22.9 L4.2 15.5 L15.6 14.6 Z" fill="#d9a441" stroke="#8a6420" strokeWidth="1.2" strokeLinejoin="round" />
          <text x="20" y="21.5" textAnchor="middle" dominantBaseline="middle" fill="#2a1a0f" style={{ fontSize: 6.5, fontWeight: 800, letterSpacing: 0.4, fontFamily: 'var(--font-floored-sans), sans-serif' }}>WILD</text>
        </>
      )}
    </svg>
  )
}

/** Symbol names for the outcome line and history. */
const SYMBOL_NAME: Record<SlotsSymbol, string> = {
  cherry: 'Cherry', bar: 'BAR', bell: 'Bell', diamond: 'Diamond', seven: '7', wild: 'Wild',
}

/** The order symbols pass the window while a reel spins (drawn twice so the loop is seamless). */
const STRIP: SlotsSymbol[] = ['seven', 'cherry', 'bar', 'bell', 'diamond', 'wild', 'cherry', 'bell']

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

/**
 * One reel window: an ivory drum behind glass. While it spins a strip of
 * symbols runs down past the payline; when it stops the symbol drops in and
 * settles. After the round, a losing line falls back.
 */
function Reel({ symbol, spinning, landed, dim, index }: { symbol: SlotsSymbol | null; spinning: boolean; landed: boolean; dim: boolean; index: number }) {
  return (
    <div className="sl-reel relative overflow-hidden rounded-md">
      {spinning ? (
        <div className="sl-strip" style={{ '--i': index } as CSSProperties}>
          {[...STRIP, ...STRIP].map((s, i) => (
            <div key={i} className="sl-cell flex items-center justify-center">
              <SlotSymbol symbol={s} className="h-[62%] w-[62%] opacity-70" />
            </div>
          ))}
        </div>
      ) : (
        <div className={`sl-cell flex items-center justify-center ${landed ? 'sl-land' : ''} ${dim ? 'g-dim' : ''}`}>
          {symbol ? (
            <SlotSymbol symbol={symbol} className="h-[72%] w-[72%]" />
          ) : (
            <SlotSymbol symbol="seven" className="h-[72%] w-[72%] opacity-20" />
          )}
        </div>
      )}
      {/* the drum's curve and the glass */}
      <div className="sl-glass pointer-events-none absolute inset-0" aria-hidden />
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

      let payout = getSlotsResultPayout(result)
      let finalOutcome: 'win' | 'loss' | 'push' =
        result.outcome === 'win' ? 'win' : 'loss'
      if (shieldActive && finalOutcome === 'loss') {
        payout = bet
        finalOutcome = 'push'
      }
      setRound(
        finalOutcome === 'push'
          ? { ...result, message: 'First Spin Shield refunds your bet.' }
          : result,
      )

      const resolved = resolveGame(onResolve, {
        outcome: finalOutcome,
        betAmount: result.betAmount,
        payout,
        multiplier: result.payoutMultiplier,
      })

      const r = result.reels!
      const line = r.map((x) => SYMBOL_NAME[x]).join(' · ')
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
        {mode === 'survival' && shieldProc.perkActive && isSpinning && (
          <PerkHint>First Spin Shield — loss refunded to a push</PerkHint>
        )}
        <span className="text-[13px] text-dim">{round.message}</span>
      </div>
      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 h-full w-full flex-col items-center justify-center px-4 py-4 md:px-6"
        entries={matchHistory}
        gameLabel="Slots"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        <GameActiveBetBadge
          betAmount={round.betAmount || lastBet}
          visible={!isBetting && (round.betAmount > 0 || lastBet > 0)}
        />

        <div className="sl-layout flex w-full flex-col items-center shrink-0">
          {/* the cabinet: three reels behind a gold frame, the payline across the middle */}
          <div
            key={isSettled ? `settled-${round.reels?.join('-')}` : 'live'}
            className={`sl-cabinet relative flex shrink-0 items-center rounded-xl ${
              isSettled && round.outcome === 'win' && round.payoutMultiplier >= 1
                ? round.payoutMultiplier >= 10 ? 'g-gold' : 'g-win'
                : ''
            }`}
          >
            {[0, 1, 2].map((i) => (
              <Reel
                key={i}
                index={i}
                symbol={displayedReels[i as 0 | 1 | 2]}
                spinning={spinningReels[i as 0 | 1 | 2]}
                landed={landedReels[i as 0 | 1 | 2]}
                dim={isSettled && round.outcome !== 'win'}
              />
            ))}
            <div className="sl-payline pointer-events-none absolute inset-x-1.5 top-1/2" aria-hidden />
            <span className="sl-marker sl-marker-l" aria-hidden />
            <span className="sl-marker sl-marker-r" aria-hidden />
          </div>

          <div className="sl-pays w-full shrink-0 rounded-md border border-[rgba(217,164,65,0.3)] bg-black/20 px-4 py-2.5" aria-label="Pay table">
            <p className="sl-pays-title felt-print mb-1.5 text-center">Center line · pays</p>
            <dl className="grid grid-cols-2 gap-x-5">
              {PAYTABLE.map((row) => {
                const top = row.multiplier >= 25
                return (
                  <div key={row.label} className="flex items-center gap-2 py-[3px]">
                    <dt className="flex shrink-0 items-center gap-0.5" aria-label={row.label}>
                      {row.symbols
                        .slice(0, row.label.startsWith('Two') || row.label.startsWith('Double') ? 2 : 3)
                        .map((sym, k) => (
                          <SlotSymbol key={k} symbol={sym} className="h-5 w-5" />
                        ))}
                    </dt>
                    <span className="flex-1 border-b border-dotted border-[rgba(217,164,65,0.25)]" aria-hidden />
                    <dd className={`num text-[13px] ${top ? 'text-gold glow-gold' : 'text-ink'}`}>{row.multiplier}×</dd>
                  </div>
                )
              })}
              <div className="flex items-center gap-2 py-[3px]">
                <SlotSymbol symbol="wild" className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap text-[12px] text-soft">Wild = any</span>
              </div>
            </dl>
          </div>

          <div className="sl-hint min-h-9 flex w-full items-center justify-center px-2 shrink-0">
            <p className="text-center text-[13px] text-dim max-w-md">
              {isBetting
                ? 'Match symbols on the center line to win.'
                : isSpinning
                  ? 'Reels spinning…'
                  : '\u00A0'}
            </p>
          </div>
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
                    data-sound={isSettled ? 'deal' : 'spin'}
                    disabled={!isSettled && (!canSpin || isSpinning)}
                    className={GAME_DOCK_PRIMARY_BTN}
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
