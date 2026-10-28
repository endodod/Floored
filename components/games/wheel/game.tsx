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

const COLOR_STYLES: Record<WheelColor, { bg: string; border: string; text: string; ring: string }> = {
  red:   { bg: 'bg-red-600',     border: 'border-red-400',     text: 'text-red-300',     ring: 'ring-red-400'     },
  blue:  { bg: 'bg-blue-600',    border: 'border-blue-400',    text: 'text-blue-300',    ring: 'ring-blue-400'    },
  green: { bg: 'bg-emerald-600', border: 'border-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-400' },
  gold:  { bg: 'bg-yellow-500',  border: 'border-yellow-400',  text: 'text-yellow-300',  ring: 'ring-yellow-400'  },
}

const COLOR_ICONS: Record<WheelColor, string> = {
  red:   '🔥',
  blue:  '💎',
  green: '🍀',
  gold:  '⭐',
}

/** Black outline + subtle highlight — color bet buttons and wheel slice icons. */
const COLOR_ICON_OUTLINE_STYLE = {
  filter: 'drop-shadow(0 0 1px #000) drop-shadow(0 0 2px #000) drop-shadow(0 0 1px #fff)',
} as const

const SPIN_DURATION = 2000

/** Taller than GAME_CONTROL_DOCK_M — room between color picks and chip row. */
const WHEEL_CONTROL_DOCK = `${GAME_CONTROL_DOCK_M} min-h-[252px]`

// 12 equal slices: 6 red · 3 blue · 2 green · 1 gold
// No-adjacent layout: R B R G R B R Gold R G R B
const TOTAL_SLICES = 12
const SLICE_DEG = 360 / TOTAL_SLICES

const HEX: Record<WheelColor, string> = {
  red: '#dc2626', blue: '#2563eb', green: '#16a34a', gold: '#ca8a04',
}

// Separator color between slices — more visible dark divider
const SEPARATOR_COLOR = '#000000'
const SEPARATOR_WIDTH = 2

// No adjacent same-color: R B R G R B R Gold R G R B
const SLICE_COLORS: WheelColor[] = [
  'red', 'blue', 'red', 'green', 'red', 'blue',
  'red', 'gold', 'red', 'green', 'red', 'blue',
]

function slicePath(i: number, cx: number, cy: number, r: number): string {
  const a0 = (i * SLICE_DEG - 90) * (Math.PI / 180)
  const a1 = ((i + 1) * SLICE_DEG - 90) * (Math.PI / 180)
  const x0 = (cx + r * Math.cos(a0)).toFixed(3)
  const y0 = (cy + r * Math.sin(a0)).toFixed(3)
  const x1 = (cx + r * Math.cos(a1)).toFixed(3)
  const y1 = (cy + r * Math.sin(a1)).toFixed(3)
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`
}

function sliceIconTransform(i: number, cx: number, cy: number, r: number): string {
  const aMid = ((i + 0.5) * SLICE_DEG - 90) * (Math.PI / 180)
  const tx = cx + r * 0.62 * Math.cos(aMid)
  const ty = cy + r * 0.62 * Math.sin(aMid)
  const rotateDeg = (i + 0.5) * SLICE_DEG - 90
  return `translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) rotate(${rotateDeg.toFixed(1)})`
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
  const icon = COLOR_ICONS[color]
  return seg ? `${icon} ${name} ${seg.multiplier}×` : `${icon} ${name}`
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
        <span className="text-[13px] text-dim">{spinning ? 'Spinning…' : round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 md:px-8 py-4 gap-4"
        entries={matchHistory}
        gameLabel="Fortune Wheel"
      >

        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {scoutProc.perkActive && isBetting && crossedOutColor && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Scout: {wheelColorLabel(crossedOutColor)} won&apos;t land
          </PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={activeBet}
          betType={activeBet > 0 && !isBetting ? wheelColorBetLabel(round.betColor ?? selectedColor) : undefined}
          visible={activeBet > 0 && !isBetting}
        />

        <div className="flex flex-col items-center gap-3 shrink-0">
        <div className="relative flex items-center justify-center shrink-0">
          {/* Pointer — fixed above the wheel, points downward */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
            <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[18px] border-l-transparent border-r-transparent border-t-white drop-shadow-lg" />
          </div>

          {/* SVG wheel — 41 equal slices */}
          <div className="w-[13.5rem] h-[13.5rem] sm:w-60 sm:h-60 rounded-full shadow-2xl border-4 border-white/20 overflow-hidden">
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full"
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                transition: spinning
                  ? `transform ${SPIN_DURATION}ms cubic-bezier(0.1, 0.8, 0.4, 1)`
                  : 'none',
              }}
            >
              {/* Slices */}
              {SLICE_COLORS.map((color, i) => (
                <path
                  key={i}
                  d={slicePath(i, 100, 100, 96)}
                  fill={HEX[color]}
                  stroke={SEPARATOR_COLOR}
                  strokeWidth={SEPARATOR_WIDTH}
                  strokeLinejoin="round"
                />
              ))}

              {/* Icons per slice — outline on the glyph only (same as color bet buttons) */}
              {SLICE_COLORS.map((color, i) => (
                <g key={`icon-${i}`} transform={sliceIconTransform(i, 100, 100, 96)}>
                  <foreignObject
                    x={-10}
                    y={-10}
                    width={20}
                    height={20}
                    overflow="visible"
                    style={{ background: 'transparent', overflow: 'visible' }}
                  >
                    <div
                      className="flex h-full w-full items-center justify-center overflow-visible bg-transparent"
                    >
                      <span
                        className="inline-block text-[13px] leading-none"
                        style={{ userSelect: 'none', ...COLOR_ICON_OUTLINE_STYLE }}
                      >
                        {COLOR_ICONS[color]}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              ))}

              {/* Center cap */}
              <circle cx="100" cy="100" r="14" fill="#09090b" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
            </svg>
          </div>
        </div>

          <div className="min-h-10 flex w-full max-w-sm items-center justify-center px-2 shrink-0">
            <p className="text-center text-xs text-zinc-500">
              {isBetting
                ? 'Pick a color multiplier, place chips, then spin.'
                : spinning
                  ? 'Wheel spinning…'
                  : '\u00A0'}
            </p>
          </div>
        </div>
      </GameFieldWithHistory>

      <div className={WHEEL_CONTROL_DOCK}>
        <div className={GAME_DOCK_INNER}>
          <div className={`flex shrink-0 justify-center min-h-10 mb-4 ${!isBetting ? 'hidden' : ''}`}>
            <div className="flex gap-2">
              {WHEEL_SEGMENTS.map((seg) => {
                const cs = COLOR_STYLES[seg.color]
                const isSelected = selectedColor === seg.color
                const isScoutCrossed =
                  scoutProc.perkActive && isBetting && crossedOutColor === seg.color
                return (
                  <button
                    key={seg.color}
                    type="button"
                    disabled={isScoutCrossed}
                    onClick={() => setColor(seg.color)}
                    className={`relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl border-2 font-bold text-sm transition-all duration-100 ${
                      isScoutCrossed
                        ? 'border-zinc-700 bg-zinc-900/60 text-zinc-600 opacity-50 cursor-not-allowed'
                        : isSelected
                          ? `${cs.bg} ${cs.border} text-white shadow-lg scale-105`
                          : `${cs.border} ${cs.text} opacity-40 hover:opacity-70`
                    }`}
                  >
                    {isScoutCrossed && (
                      <span className="absolute -top-2 -right-2 text-[10px] font-bold text-red-400">✕</span>
                    )}
                    <span className="text-base leading-none" style={COLOR_ICON_OUTLINE_STYLE}>
                      {COLOR_ICONS[seg.color]}
                    </span>
                    <span className="text-xs leading-none">{seg.multiplier}×</span>
                  </button>
                )
              })}
            </div>
          </div>

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
              <p className="text-sm text-zinc-400">
                Potential total winnings:{' '}
                <span className="font-semibold text-emerald-400">{formatChips(potentialWinnings)}</span>
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
                    className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
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
