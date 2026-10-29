'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_CARD_SHELL,
  GAME_BOARD_ARENA,
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
import { formatChips } from '@/utils/format'
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
  getTargetRotation,
  getWheelPayout,
  initWheel,
  previewWheelOutcome,
  loseGame,
  spinWheel,
  spinWheelWithResult,
  winGame,
  WHEEL_SEGMENTS,
} from '@/games/wheel/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { WheelColor, WheelState } from '@/games/wheel/types'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'

/** Slice paint: deep casino colours that read on the felt; gold is the jackpot slice. */
const HEX: Record<WheelColor, string> = {
  red: '#a92b42', blue: '#2f5a9e', green: '#2a7a57', gold: '#d9a441',
}
const LABEL_INK: Record<WheelColor, string> = {
  red: '#f4f1ea', blue: '#f4f1ea', green: '#f4f1ea', gold: '#1b1608',
}

const SPIN_DURATION = 2000

// 12 equal slices: 6 red · 3 blue · 2 green · 1 gold
// No-adjacent layout: R B R G R B R Gold R G R B
const TOTAL_SLICES = 12
const SLICE_DEG = 360 / TOTAL_SLICES

// No adjacent same-color: R B R G R B R Gold R G R B
const SLICE_COLORS: WheelColor[] = [
  'red', 'blue', 'red', 'green', 'red', 'blue',
  'red', 'gold', 'red', 'green', 'red', 'blue',
]

function slicePath(i: number, r: number): string {
  const a0 = (i * SLICE_DEG - 90) * (Math.PI / 180)
  const a1 = ((i + 1) * SLICE_DEG - 90) * (Math.PI / 180)
  const p = (a: number) => `${(r * Math.cos(a)).toFixed(3)} ${(r * Math.sin(a)).toFixed(3)}`
  return `M 0 0 L ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)} Z`
}

/** The slice under the top pointer for a wheel turned by `rotation` degrees. */
function sliceUnderPointer(rotation: number): number {
  const a = (((-rotation) % 360) + 360) % 360
  return Math.floor(a / SLICE_DEG) % TOTAL_SLICES
}

/**
 * The wheel: a wooden rim with gold studs, twelve painted slices with their
 * multiplier, and a gold hub. The pointer stays put at the top and ticks while
 * the wheel turns; once it stops, the slice under it stays lit and the rest fall back.
 */
function FortuneWheel({
  rotation,
  spinning,
  landed,
}: {
  rotation: number
  spinning: boolean
  landed: number | null
}) {
  return (
    <svg viewBox="-100 -100 200 200" className="h-full w-full overflow-visible drop-shadow-[0_24px_40px_rgba(0,0,0,0.65)]" role="img" aria-label={landed != null ? `Wheel stopped on ${wheelColorBetLabel(SLICE_COLORS[landed]!)}` : 'Fortune wheel'}>
      <defs>
        <radialGradient id="fw-wood" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
          <stop offset="0.86" stopColor="#3a2617" />
          <stop offset="0.94" stopColor="#5a3b22" />
          <stop offset="1" stopColor="#2a1a0f" />
        </radialGradient>
        <radialGradient id="fw-shade" cx="0" cy="0" r="86" gradientUnits="userSpaceOnUse">
          <stop offset="0.2" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
      </defs>

      <circle r="99" fill="url(#fw-wood)" />
      <circle r="99" fill="none" stroke="rgba(217,164,65,0.55)" strokeWidth="0.8" />

      <g className="fw-anim" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? `transform ${SPIN_DURATION}ms cubic-bezier(0.1, 0.8, 0.4, 1)` : 'none' }}>
        {SLICE_COLORS.map((color, i) => (
          <path
            key={i}
            d={slicePath(i, 86)}
            fill={HEX[color]}
            className="fw-slice"
            style={{ opacity: landed != null && landed !== i ? 0.35 : 1 }}
          />
        ))}
        <circle r="86" fill="url(#fw-shade)" />
        {SLICE_COLORS.map((_, i) => (
          <line key={`s${i}`} x1="0" y1="-86" x2="0" y2="-20" transform={`rotate(${i * SLICE_DEG})`} stroke="rgba(217,164,65,0.6)" strokeWidth="0.7" />
        ))}
        {SLICE_COLORS.map((color, i) => (
          <text
            key={`t${i}`}
            x="0"
            y="-62"
            transform={`rotate(${(i + 0.5) * SLICE_DEG})`}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={LABEL_INK[color]}
            style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-floored-mono), monospace', opacity: landed != null && landed !== i ? 0.4 : 1 }}
          >
            {WHEEL_SEGMENTS.find((s) => s.color === color)!.multiplier}×
          </text>
        ))}
        {landed != null && (
          <path d={slicePath(landed, 86)} fill="none" stroke="#f4f1ea" strokeWidth="1.6" strokeLinejoin="round" className="g-fade" />
        )}
        <circle r="86" fill="none" stroke="rgba(217,164,65,0.6)" strokeWidth="0.8" />
        {/* the hub */}
        <circle r="20" fill="#0f2017" stroke="rgba(217,164,65,0.6)" strokeWidth="0.8" />
        <circle r="11" fill="#d9a441" />
        <circle r="6.5" fill="#a87a2e" />
        <circle r="2.4" fill="#f2d48f" />
      </g>

      {/* studs on the rim, one per slice edge */}
      {SLICE_COLORS.map((_, i) => (
        <circle key={`d${i}`} cx="0" cy="-92.5" r="1.7" fill="#d9a441" transform={`rotate(${i * SLICE_DEG})`} />
      ))}

      {/* the pointer */}
      <g className={spinning ? 'fw-tick' : ''}>
        <path d="M 0 -78 L -7 -101 Q 0 -105 7 -101 Z" fill="#d9a441" stroke="#2a1a0f" strokeWidth="1" strokeLinejoin="round" />
        <circle cx="0" cy="-98" r="2" fill="#f2d48f" />
      </g>
    </svg>
  )
}

interface WheelResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface WheelGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<WheelResult>
}

type PendingResult = GamePendingResult

function wheelColorLabel(color: WheelColor) {
  const seg = WHEEL_SEGMENTS.find((s) => s.color === color)
  const name = color.charAt(0).toUpperCase() + color.slice(1)
  return seg ? `${name} ${seg.multiplier}×` : name
}

/** Text-only color label for bet / outcome displays. */
function wheelColorBetLabel(color: WheelColor) {
  const name = color.charAt(0).toUpperCase() + color.slice(1)
  const seg = WHEEL_SEGMENTS.find((s) => s.color === color)
  return seg ? `${name} ${seg.multiplier}×` : name
}

function wheelColorMultiplier(color: WheelColor) {
  return WHEEL_SEGMENTS.find((s) => s.color === color)?.multiplier ?? 2
}

export function WheelGame({ mode, bankroll, onBet, onResolve }: WheelGameProps) {
  const router = useRouter()
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { wheelScout, wheelScoutLevel } = useSurvivalPerks('wheel')
  const scoutProc = usePerkProc(
    mode === 'survival' && wheelScout,
    'perk_wheel_scout',
    wheelScoutLevel,
  )
  const minBet = useGameMinBet(mode)

  const [round, setRound] = useState<WheelState>(initWheel())
  const [crossedOutColor, setCrossedOutColor] = useState<WheelColor | null>(null)
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
  const [lastBet, setLastBet] = useState(0)
  const [activeBet, setActiveBet] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rotationRef = useRef(0)
  const wheelPreviewRef = useRef<{ resultColor: WheelColor; crossedOutColor: WheelColor } | null>(null)

  const isBetting    = round.stage === 'betting' && !spinning
  const isSettled    = round.stage === 'settled' && !spinning
  const landed = isSettled && round.resultColor ? sliceUnderPointer(wheelRotation) : null
  const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: !spinning })
  const selectedColor: WheelColor = round.betColor ?? 'red'
  const canSpin = currentBet >= minBet && currentBet <= bankroll
  const potentialWinnings =
    isBetting && currentBet > 0
      ? Math.round(currentBet * wheelColorMultiplier(selectedColor))
      : (spinning || isSettled) && activeBet > 0
        ? Math.round(activeBet * wheelColorMultiplier(round.betColor ?? selectedColor))
        : 0

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function setColor(color: WheelColor) {
    if (!isBetting) return
    setRound((prev) => ({ ...prev, betColor: color }))
  }

  function handleSpin() {
    if (!canSpin || spinning || !lock()) return

    const bet = currentBet
    onBet?.(bet)
    setLastBet(bet)
    setActiveBet(bet)
    setSpinning(true)
    setPendingResult(null)
    setQuoteIdx((prev) => pickQuote(prev))

    const result = blessed
      ? winGame(selectedColor, bet)
      : cursed
        ? loseGame(selectedColor, bet)
        : scoutProc.perkActive && wheelPreviewRef.current
          ? spinWheelWithResult(selectedColor, bet, wheelPreviewRef.current.resultColor)
          : spinWheel(selectedColor, bet)
    const target = getTargetRotation(rotationRef.current, result.resultColor!)
    rotationRef.current = target
    setWheelRotation(target)
    setCurrentBet(0)

    spinTimer.current = setTimeout(() => {
      setSpinning(false)
      setRound(result)

      const payout = getWheelPayout(result)
      const resolved = resolveGame(onResolve, {
        outcome: result.outcome!,
        betAmount: result.betAmount,
        payout,
        multiplier: result.payoutMultiplier,
      })

      const betName = wheelColorBetLabel(result.betColor!)
      const resultColor =
        result.resultColor!.charAt(0).toUpperCase() + result.resultColor!.slice(1)
      const built = buildPendingResult(
        { outcome: result.outcome!, betAmount: result.betAmount, payout: resolved.payout },
        {
          betSpecification: betName,
          result: `${result.resultMultiplier}×`,
          resultSpecification: resultColor,
        },
        {
          historySubtitle: `Bet ${betName} · Landed ${result.resultMultiplier}× · ${resultColor}`,
          gameMultiplier: result.outcome === 'win' ? result.payoutMultiplier : undefined,
          payoutBoostMult: resolved.payoutBoostMult,
          freeBet: resolved.firstBetWasFree,
        },
      )
      setPendingResult(built)
      scoutProc.resetPerk()
      wheelPreviewRef.current = null
      setCrossedOutColor(null)
    }, SPIN_DURATION)
  }

  const handleNewRound = useCallback(() => {
    unlock()
    if (spinTimer.current) clearTimeout(spinTimer.current)
    setRound((prev) => {
      const c = prev.betColor ?? 'red'
      const s = initWheel()
      s.betColor = c
      return s
    })
    setPendingResult(null)
    setActiveBet(0)
    wheelPreviewRef.current = null
    setCrossedOutColor(null)
    scoutProc.resetPerk()
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll, scoutProc])

  function handleNextRound() {
    if (pendingResult) {
      setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    }
    if (!survivalAfterNext(mode)) return
    handleNewRound()
  }

  useEffect(() => {
    if (!isBetting || !wheelScout || mode !== 'survival') {
      wheelPreviewRef.current = null
      setCrossedOutColor(null)
      return
    }
    if (scoutProc.rollForBet()) {
      const preview = previewWheelOutcome()
      wheelPreviewRef.current = preview
      setCrossedOutColor(preview.crossedOutColor)
      setRound((prev) => {
        if (prev.betColor === preview.crossedOutColor) {
          const fallback = WHEEL_SEGMENTS.find((s) => s.color !== preview.crossedOutColor)!.color
          return { ...prev, betColor: fallback }
        }
        return prev
      })
    } else {
      wheelPreviewRef.current = null
      setCrossedOutColor(null)
    }
    // Roll once each time the betting phase opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBetting, wheelScout, mode])

  useEffect(() => () => { if (spinTimer.current) clearTimeout(spinTimer.current) }, [])

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-[13px] font-semibold text-ink">Fortune Wheel</span>
        {scoutProc.perkActive && isBetting && crossedOutColor && (
          <PerkHint>Scout: {wheelColorLabel(crossedOutColor)} won&apos;t land</PerkHint>
        )}
        <span className="text-[13px] text-dim">{spinning ? 'Spinning…' : round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 md:px-8 py-4 gap-4"
        entries={matchHistory}
        gameLabel="Fortune Wheel"
      >

        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        <GameActiveBetBadge
          betAmount={activeBet}
          betType={activeBet > 0 && !isBetting ? wheelColorBetLabel(round.betColor ?? selectedColor) : undefined}
          visible={activeBet > 0 && !isBetting}
        />

        <div className="fw-layout flex flex-col items-center gap-3 shrink-0">
          <div
            key={isSettled ? `settled-${wheelRotation}` : 'live'}
            className={`fw-wheel relative aspect-square rounded-full ${
              landed == null ? '' : round.outcome === 'win' ? (round.resultColor === 'gold' ? 'g-gold' : 'g-win') : 'g-shake'
            }`}
          >
            <FortuneWheel rotation={wheelRotation} spinning={spinning} landed={landed} />
          </div>

          <div className={`fw-picks flex flex-wrap justify-center gap-2 shrink-0 ${isBetting ? '' : 'invisible pointer-events-none'}`} role="radiogroup" aria-label="Pick a colour">
            {WHEEL_SEGMENTS.map((seg) => {
              const isSelected = selectedColor === seg.color
              const isScoutCrossed =
                scoutProc.perkActive && isBetting && crossedOutColor === seg.color
              return (
                <button
                  key={seg.color}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${wheelColorBetLabel(seg.color)}${isScoutCrossed ? ' (won\'t land)' : ''}`}
                  disabled={isScoutCrossed}
                  onClick={() => setColor(seg.color)}
                  className={[
                    'g-lift m-still flex h-10 items-center gap-2 rounded-full border pl-2.5 pr-3.5 text-[13px] font-semibold transition-[border-color,background-color,color,box-shadow,transform] duration-150 active:scale-95',
                    isScoutCrossed
                      ? 'cursor-not-allowed border-line text-dim line-through opacity-40'
                      : isSelected
                        ? 'border-ink bg-raised text-ink -translate-y-0.5'
                        : 'border-control bg-black/25 text-soft hover:border-dim hover:text-ink',
                  ].join(' ')}
                  style={isSelected && !isScoutCrossed ? { boxShadow: `0 0 18px -6px ${HEX[seg.color]}` } : undefined}
                >
                  <span className="h-4 w-4 rounded-full ring-1 ring-black/40" style={{ background: HEX[seg.color] }} aria-hidden />
                  <span className="num">{seg.multiplier}×</span>
                </button>
              )
            })}
          </div>
          <div className="fw-hint min-h-9 flex w-full max-w-sm items-center justify-center px-2 shrink-0">
            <p className="text-center text-[13px] text-dim">
              {isBetting
                ? 'Pick a colour, place chips, then spin.'
                : spinning
                  ? 'Wheel spinning…'
                  : '\u00A0'}
            </p>
          </div>
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          <GameDockChipRow
            visible={isBetting || spinning}
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={spinning}
            minBet={minBet}
          />

          <div className={GAME_DOCK_SETTLED_SLOT}>
            {isBetting && <GameDockBetRow currentBet={currentBet} onClear={() => setCurrentBet(0)} />}
            {spinning && potentialWinnings > 0 && (
              <p className="text-sm text-soft">
                Potential total winnings:{' '}
                <span className="num font-semibold text-felt">{formatChips(potentialWinnings)}</span>
              </p>
            )}
            {isSettled && pendingResult && (
              <GameDockSettledRow
                betSummary={pendingResult.betSummary}
                resultSummary={pendingResult.resultSummary}
                profitLabel={pendingResult.profitLabel}
                tone={pendingResult.tone}
              />
            )}
            {!isBetting && !spinning && !(isSettled && pendingResult) && (
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
                    onClick={isSettled ? handleNextRound : handleSpin}
                    disabled={!isSettled && (!canSpin || spinning)}
                    className={GAME_DOCK_PRIMARY_BTN}
                  >
                    {isSettled ? 'Next →' : spinning ? 'Spinning…' : 'Spin →'}
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
