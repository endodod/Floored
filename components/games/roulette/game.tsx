'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
  GAME_DOCK_PRIMARY_BTN,
} from '@/components/game-dock-parts'
import { useRunEnd } from '@/hooks/use-run-end'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { buildPendingResult, formatBetSummary, type GamePendingResult } from '@/lib/game-result-labels'
import { resolveGame } from '@/lib/survival/game-resolve'
import { rouletteEliminatedNumbers } from '@/games/roulette/engine'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { usePerkProc } from '@/hooks/use-perk-proc'
import { PerkHint } from '@/components/survival/perk-hint'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import {
  BET_LABELS,
  EUROPEAN_WHEEL_ORDER,
  getOutcomeLabelForTarget,
  formatRouletteResultLabel,
  getNumberColor,
  getPayoutForTarget,
  initRoulette,
  isNumberCoveredByTarget,
  loseGame,
  spinRoulette,
  spinRouletteWithResult,
  winGame,
} from '@/games/roulette/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { RouletteState } from '@/games/roulette/types'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'

// Standard European roulette table layout: 3 rows top-to-bottom, 12 columns left-to-right
const BOARD_ROWS = [
  [3,  6,  9,  12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2,  5,  8,  11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1,  4,  7,  10, 13, 16, 19, 22, 25, 28, 31, 34],
]

const SPIN_MS = 4600
/** How long the wheel and ball travel; the round settles a beat after they stop. */
const SPIN_ANIMATION_MS = 4000

/** The real European wheel, clockwise from 0; pocket i sits at i × STEP degrees from the top. */
const POCKETS = EUROPEAN_WHEEL_ORDER
const STEP = 360 / POCKETS.length

const POCKET_FILL = { red: '#a92b42', black: '#141318', green: '#2a7a57' } as const
const CELL_FILL = { red: 'bg-[#a92b42]', black: 'bg-[#141318]', green: 'bg-[#2a7a57]' } as const

interface RouletteResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface RouletteGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<RouletteResult>
}

type PendingResult = GamePendingResult

/** A wedge of the pocket ring between two radii, centred on `angle` (0 = top, clockwise). */
function wedgePath(angle: number, r0: number, r1: number): string {
  const a0 = ((angle - STEP / 2 - 90) * Math.PI) / 180
  const a1 = ((angle + STEP / 2 - 90) * Math.PI) / 180
  const p = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(3)} ${(r * Math.sin(a)).toFixed(3)}`
  return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`
}

/**
 * The wheel: a wooden rim, the ball track, 37 pockets in their real order and a gold
 * turret. The wheel turns clockwise while the ball runs the other way round the track,
 * drops off it near the end and settles in the winning pocket under the marker.
 */
function RouletteWheel({
  rotation,
  ballRotation,
  spinKey,
  spinning,
  result,
}: {
  rotation: number
  ballRotation: number
  spinKey: number
  spinning: boolean
  result: number | null
}) {
  const transition = `transform ${SPIN_ANIMATION_MS}ms cubic-bezier(0.12, 0.6, 0.14, 1)`
  return (
    <svg viewBox="-100 -100 200 200" className="roulette-wheel h-full w-full drop-shadow-[0_24px_40px_rgba(0,0,0,0.65)]" role="img" aria-label={result != null && !spinning ? `Wheel stopped on ${result}` : 'Roulette wheel'}>
      <defs>
        <radialGradient id="rw-wood" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
          <stop offset="0.86" stopColor="#3a2617" />
          <stop offset="0.94" stopColor="#5a3b22" />
          <stop offset="1" stopColor="#2a1a0f" />
        </radialGradient>
        <radialGradient id="rw-cone" cx="0" cy="0" r="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#24432f" />
          <stop offset="0.7" stopColor="#163021" />
          <stop offset="1" stopColor="#0f2017" />
        </radialGradient>
        <radialGradient id="rw-ball" cx="-1.2" cy="-1.4" r="4.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#b9b6ae" />
        </radialGradient>
      </defs>

      {/* rim and ball track (they do not turn) */}
      <circle r="99" fill="url(#rw-wood)" />
      <circle r="99" fill="none" stroke="rgba(217,164,65,0.55)" strokeWidth="0.8" />
      <circle r="90" fill="#0d0c10" />
      <circle r="90" fill="none" stroke="rgba(217,164,65,0.35)" strokeWidth="0.6" />

      {/* the turning wheel */}
      <g className="roulette-anim" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? transition : 'none' }}>
        {POCKETS.map((n, i) => (
          <path key={n} d={wedgePath(i * STEP, 56, 82)} fill={POCKET_FILL[getNumberColor(n)]} stroke="rgba(217,164,65,0.6)" strokeWidth="0.45" />
        ))}
        {POCKETS.map((n, i) => (
          <text
            key={`t${n}`}
            x="0"
            y="-73"
            transform={`rotate(${i * STEP})`}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#f4f1ea"
            style={{ fontSize: 6.6, fontWeight: 600, fontFamily: 'var(--font-floored-sans), sans-serif' }}
          >
            {n}
          </text>
        ))}
        {/* pocket floor ring and frets */}
        <circle r="64" fill="none" stroke="rgba(217,164,65,0.45)" strokeWidth="0.5" />
        <circle r="56" fill="url(#rw-cone)" />
        <circle r="56" fill="none" stroke="rgba(217,164,65,0.6)" strokeWidth="0.8" />
        {/* the turret: four gold spokes and a cap */}
        {[0, 45, 90, 135].map((a) => (
          <rect key={a} x="-1.2" y="-30" width="2.4" height="60" rx="1.2" fill="#c99a45" transform={`rotate(${a})`} opacity={a % 90 === 0 ? 1 : 0.55} />
        ))}
        <circle r="10" fill="#d9a441" />
        <circle r="6" fill="#a87a2e" />
        <circle r="2.2" fill="#f2d48f" />
      </g>

      {/* the ball: orbits against the wheel, falls from the track into the pocket ring */}
      <g className="roulette-anim" style={{ transform: `rotate(${ballRotation}deg)`, transition: spinning ? transition : 'none' }}>
        <g key={spinKey} className={spinning ? 'roulette-ball-drop' : ''} style={{ transform: 'translateY(-61px)' } as CSSProperties}>
          <circle cx="0" cy="0" r="3.6" fill="url(#rw-ball)" />
        </g>
      </g>

      {/* the marker the ball comes to rest under */}
      <path d="M 0 -91 L -3.4 -97.5 L 3.4 -97.5 Z" fill="#d9a441" />
    </svg>
  )
}

/** A chip sitting on the table where the bet is placed. */
function TableChip() {
  return (
    <span
      aria-hidden
      className="chip pointer-events-none absolute left-1/2 top-1/2 z-10 h-[min(22px,80%)] w-[min(22px,80%)] -translate-x-1/2 -translate-y-1/2 shadow-[0_3px_8px_rgba(0,0,0,0.6)]"
      style={{ '--chip': '#d9a441', '--chip-ink': '#1d1c21' } as CSSProperties}
    />
  )
}

export function RouletteGame({ mode, bankroll, onBet, onResolve }: RouletteGameProps) {
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { rouletteTracker, rouletteTrackerLevel } = useSurvivalPerks('roulette')
  const trackerProc = usePerkProc(
    mode === 'survival' && rouletteTracker,
    'perk_roulette_tracker',
    rouletteTrackerLevel,
  )
  const minBet = useGameMinBet(mode)

  const [round, setRound] = useState<RouletteState>(initRoulette())
  const [trackerEliminated, setTrackerEliminated] = useState<number[]>([])
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
  const [currentTarget, setCurrentTarget] = useState<string | null>(null)
  const [lastBet, setLastBet] = useState(0)
  const [lastTarget, setLastTarget] = useState<string | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [ballRotation, setBallRotation] = useState(0)
  const [spinKey, setSpinKey] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  const settleRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSpinResult = useRef<number | null>(null)

  const isBetting = round.stage === 'betting' && !spinning
  const isSettled = round.stage === 'settled' && !spinning
  const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: !spinning })

  // Ball Tracker: proc + eliminated numbers during betting (before spin).
  useEffect(() => {
    if (mode !== 'survival' || !rouletteTracker || !isBetting) {
      pendingSpinResult.current = null
      if (!isBetting) setTrackerEliminated([])
      return
    }
    const proc = trackerProc.rollForBet()
    if (proc) {
      const winning = Math.floor(Math.random() * 37)
      pendingSpinResult.current = winning
      setTrackerEliminated(rouletteEliminatedNumbers(winning))
    } else {
      pendingSpinResult.current = null
      setTrackerEliminated([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- roll once per betting phase
  }, [isBetting, mode, rouletteTracker, round.stage])
  const canSpin =
    currentTarget !== null && currentBet >= minBet && currentBet <= bankroll
  const activeBet = spinning || isSettled ? lastBet : 0
  const potentialWinnings = useMemo(() => {
    if (!spinning || !lastTarget || lastBet <= 0) return 0
    return lastBet * getPayoutForTarget(lastTarget)
  }, [spinning, lastTarget, lastBet])

  function selectTarget(target: string) {
    if (currentTarget === target) {
      setCurrentTarget(null)
    } else {
      setCurrentTarget(target)
    }
  }

  function addChip(value: number) {
    if (!currentTarget) return
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function clearBet() {
    setCurrentBet(0)
    setCurrentTarget(null)
  }

  function handleSpin() {
    if (!canSpin || spinning || !currentTarget || !lock()) return

    const total = currentBet
    const spunTarget = currentTarget

    onBet?.(total)
    setLastBet(currentBet)
    setLastTarget(currentTarget)
    setCurrentBet(0)
    setCurrentTarget(null)
    setPendingResult(null)

    const preRolled = pendingSpinResult.current
    const result = blessed
      ? winGame(spunTarget, total)
      : cursed
        ? loseGame(spunTarget, total)
        : preRolled != null
          ? spinRouletteWithResult(spunTarget, total, preRolled)
          : spinRoulette(spunTarget, total)
    pendingSpinResult.current = null
    setQuoteIdx((prev) => pickQuote(prev))

    // The outcome is already decided; aim the wheel so its pocket ends under the marker,
    // five turns clockwise, while the ball makes four turns the other way back to the top.
    const pocket = Math.max(0, POCKETS.indexOf(result.result ?? 0))
    setWheelRotation((prev) => {
      const target = (((-pocket * STEP - prev) % 360) + 360) % 360
      return prev + 360 * 5 + target
    })
    setBallRotation((prev) => Math.floor(prev / 360) * 360 - 360 * 4)
    setSpinKey((k) => k + 1)
    setSpinning(true)

    settleRef.current = setTimeout(() => {
      setSpinning(false)
      setRound(result)

      const outcome = result.outcome ?? 'loss'
      const resolved = resolveGame(onResolve, {
        outcome,
        betAmount: result.totalBetAmount,
        payout: result.totalPayout,
        multiplier: total > 0 ? result.totalPayout / total : 0,
      })

      const resultLabel = formatRouletteResultLabel(
        result.result ?? 0,
        result.resultColor ?? 'green',
      )
      const betLabel = getOutcomeLabelForTarget(spunTarget)
      const partial =
        outcome === 'loss' && result.totalPayout > 0 && result.totalPayout < result.totalBetAmount
      const outcomeWord = outcome === 'win' ? 'Win!' : outcome === 'push' ? 'Push' : partial ? 'Partial return' : 'Miss'
      const built = buildPendingResult(
        { outcome, betAmount: result.totalBetAmount, payout: resolved.payout },
        {
          betSpecification: betLabel,
          result: resultLabel,
        },
        {
          historySubtitle:
            total > 0
              ? `${formatBetSummary(total, betLabel)} → ${resultLabel} · ${outcomeWord}`
              : `${resultLabel} · ${outcomeWord}`,
          freeBet: resolved.firstBetWasFree,
        },
      )
      setPendingResult(built)
    }, SPIN_MS)
  }

  const handleNewRound = useCallback(() => {
    unlock()
    trackerProc.resetPerk()
    setTrackerEliminated([])
    setRound(initRoulette())
    setPendingResult(null)
    if (autoReBet && lastBet > 0 && lastTarget && lastBet <= bankroll) {
      setCurrentBet(lastBet)
      setCurrentTarget(lastTarget)
    }
  }, [autoReBet, lastBet, lastTarget, bankroll])

  function handleNext() {
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    if (!survivalAfterNext(mode)) return
    handleNewRound()
  }

  useEffect(() => () => {
    if (settleRef.current) clearTimeout(settleRef.current)
  }, [])

  // What the table shows: the bet being placed, or the one riding on the spin.
  const shownTarget = isBetting ? currentTarget : lastTarget
  const eliminated = new Set(isBetting ? trackerEliminated : [])

  function cellState(n: number) {
    const target = shownTarget
    const direct = target === String(n)
    const covered = target != null && !direct && isNumberCoveredByTarget(n, target)
    const isResult = isSettled && round.result === n
    return { direct, covered, isResult }
  }

  function numberCell(n: number, extra = '') {
    const { direct, covered, isResult } = cellState(n)
    const out = eliminated.has(n)
    return (
      <button
        key={n}
        type="button"
        onClick={() => selectTarget(String(n))}
        disabled={!isBetting}
        aria-label={`${n} ${getNumberColor(n)}`}
        aria-pressed={direct}
        className={[
          'relative flex items-center justify-center font-semibold text-[#f4f1ea] transition-[filter,box-shadow,opacity] duration-150 select-none',
          'num text-[10px] sm:text-[13px]',
          CELL_FILL[getNumberColor(n)],
          isResult
            ? 'z-10 shadow-[inset_0_0_0_2px_#fff,0_0_22px_4px_rgba(255,255,255,0.45)]'
            : covered
              ? 'shadow-[inset_0_0_0_2px_rgba(217,164,65,0.85)]'
              : '',
          isSettled && !isResult ? 'opacity-55' : '',
          out ? 'opacity-25 line-through' : '',
          isBetting ? 'cursor-pointer hover:brightness-125' : 'cursor-default',
          extra,
        ].join(' ')}
      >
        {n}
        {direct && <TableChip />}
      </button>
    )
  }

  function outsideCell(type: 'even' | 'red' | 'black' | 'odd') {
    const active = shownTarget === type
    return (
      <button
        key={type}
        type="button"
        onClick={() => selectTarget(type)}
        disabled={!isBetting}
        aria-label={`${BET_LABELS[type]}, pays 1 to 1`}
        aria-pressed={active}
        className={[
          'relative col-span-3 flex h-9 items-center justify-center bg-[#163021] text-[12px] font-semibold text-[#f4f1ea] transition-[filter] duration-150 select-none sm:h-11 sm:text-[13px]',
          isBetting ? 'cursor-pointer hover:brightness-125' : 'cursor-default',
        ].join(' ')}
      >
        {type === 'red' || type === 'black' ? (
          <span
            className="h-4 w-6 sm:h-5 sm:w-8"
            style={{ clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)', background: POCKET_FILL[type], boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)' }}
            aria-hidden
          />
        ) : (
          BET_LABELS[type]
        )}
        {active && <TableChip />}
      </button>
    )
  }

  const shownNumber = isSettled ? round.result : null
  const shownColor = isSettled ? round.resultColor : null

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-[13px] font-semibold text-ink">Roulette</span>
        <span className="text-[13px] text-dim">{spinning ? 'No more bets…' : round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 h-full w-full flex-col items-center justify-center px-3 py-4 sm:px-6"
        entries={matchHistory}
        gameLabel="Roulette"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {trackerProc.perkActive && trackerEliminated.length > 0 && isBetting && (
          <PerkHint className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
            Not winning: {trackerEliminated.join(', ')}
          </PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={activeBet}
          betType={activeBet > 0 && lastTarget ? getOutcomeLabelForTarget(lastTarget) : undefined}
          visible={activeBet > 0 && !isBetting}
        />

        <div className="mt-10 flex w-full max-w-4xl flex-col items-center gap-5 sm:mt-6 lg:flex-row lg:items-center lg:gap-10">
          {/* The wheel and the number it stopped on */}
          <div className="flex shrink-0 flex-col items-center gap-3">
            <div className="aspect-square w-[clamp(160px,min(30vh,42vw),300px)]">
              <RouletteWheel
                rotation={wheelRotation}
                ballRotation={ballRotation}
                spinKey={spinKey}
                spinning={spinning}
                result={round.result}
              />
            </div>
            <div className="flex h-9 items-center gap-2" aria-live="polite">
              {shownNumber != null && shownColor ? (
                <>
                  <span
                    className="rise num flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-[17px] text-[#f4f1ea] shadow-[0_0_20px_-2px_rgba(255,255,255,0.35)]"
                    style={{ background: POCKET_FILL[shownColor] }}
                  >
                    {shownNumber}
                  </span>
                  <span className="text-[13px] text-soft">
                    {shownNumber === 0
                      ? 'Zero'
                      : `${shownColor === 'red' ? 'Red' : 'Black'} · ${shownNumber % 2 === 1 ? 'Odd' : 'Even'}`}
                  </span>
                </>
              ) : (
                <span className="text-[13px] text-dim">{spinning ? 'The ball is rolling…' : 'Place your bet'}</span>
              )}
            </div>
          </div>

          {/* The table: zero, the 3 × 12 grid and the outside bets, ruled in gold */}
          <div className={`w-full max-w-[560px] ${!isBetting ? 'pointer-events-none' : ''}`}>
            <div
              className="grid gap-px rounded-sm bg-[rgba(217,164,65,0.4)] p-px shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)]"
              style={{ gridTemplateColumns: 'minmax(26px,1.15fr) repeat(12, minmax(0, 1fr))' }}
            >
              {numberCell(0, 'row-span-3 rounded-l-sm')}
              {BOARD_ROWS.map((row) => row.map((n) => numberCell(n, 'aspect-[4/5] sm:aspect-[5/6]')))}
              <span aria-hidden className="bg-[#163021]" />
              {(['even', 'red', 'black', 'odd'] as const).map((type) => (
                <span key={type} className="contents">
                  {outsideCell(type)}
                </span>
              ))}
            </div>
            <p className="felt-print mt-2 text-center text-[9.5px]">Numbers pay 36 for 1 · Outside bets pay 2 for 1</p>
          </div>
        </div>

        <div className="mt-4 flex min-h-8 w-full shrink-0 items-center justify-center px-2">
          <p className="max-w-md text-center text-[13px] text-dim">
            {isBetting
              ? 'Pick a number or an outside bet, add chips, then spin.'
              : spinning
                ? 'No more bets.'
                : ' '}
          </p>
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
            {isBetting && (
              <>
                <GameDockBetRow
                  currentBet={currentBet}
                  onClear={clearBet}
                />
              </>
            )}
            {spinning && potentialWinnings > 0 && (
              <p className="text-[14px] text-soft">
                A hit pays <span className="num text-felt glow-felt">{formatChips(potentialWinnings)}</span>
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
              <p className="text-sm invisible select-none">{' '}</p>
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
