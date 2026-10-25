'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import {
  GAME_DOCK_SETTLED_SLOT,
  GAME_DOCK_INNER,
  GAME_DOCK_ACTIONS,
  GameActiveBetBadge,
  GameDockBackButton,
  GameDockGameOverButton,
  GameDockLeaveButton,
  GameDockSettledRow,
} from '@/components/game-dock-parts'
import { useSurvivalGameOver } from '@/hooks/use-survival-game-over'
import { PerkHint } from '@/components/survival/perk-hint'
import { GameDockRandomQuote } from '@/components/game-dock-random-quote'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { buildPendingResult, type GamePendingResult } from '@/lib/game-result-labels'
import { resolveGame } from '@/lib/survival/game-resolve'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { usePerkProc } from '@/hooks/use-perk-proc'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import {
  getCases,
  addCase,
  initCaseBattle,
  loseGame,
  removeCase,
  rerollUserItem,
  settleBattle,
  startBattle,
  winGame,
} from '@/games/case-battles/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { CaseBattleState, CaseRarity } from '@/games/case-battles/types'
import { useGameMinBet } from '@/hooks/use-game-min-bet'

interface CaseBattlesResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface CaseBattlesGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<CaseBattlesResult>
}

type PendingResult = GamePendingResult

const RARITY_TEXT: Record<CaseRarity, string> = {
  common:    'text-zinc-300',
  uncommon:  'text-green-400',
  rare:      'text-blue-400',
  epic:      'text-purple-400',
  legendary: 'text-yellow-400',
}

const RARITY_BORDER: Record<CaseRarity, string> = {
  common:    'border-zinc-600',
  uncommon:  'border-green-700',
  rare:      'border-blue-700',
  epic:      'border-purple-700',
  legendary: 'border-yellow-500',
}

// Slot rendering for opening/settled columns
function ItemSlot({
  caseEmoji, item, isRevealing, isRevealed, isRerolling = false,
}: {
  caseEmoji: string
  item: { name: string; icon: string; value: number; rarity: CaseRarity }
  isRevealing: boolean
  isRevealed: boolean
  isRerolling?: boolean
}) {
  const suspense = isRevealing || isRerolling
  const borderClass = suspense
    ? 'border-yellow-500 case-item-suspense'
    : isRevealed
      ? RARITY_BORDER[item.rarity]
      : 'border-zinc-800'

  return (
    <div className={`rounded-xl border-2 px-3 py-2.5 min-h-[4.5rem] flex items-center ${borderClass}`}>
      {isRevealed && !isRerolling ? (
        <div key="revealed" className="flex items-center gap-3 w-full case-item-reveal">
          <span className="text-3xl leading-none shrink-0">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm leading-snug truncate ${RARITY_TEXT[item.rarity]}`}>
              {item.name}
            </p>
            <p className="text-zinc-300 font-black tabular-nums text-sm">{formatChips(item.value)}</p>
          </div>
        </div>
      ) : suspense ? (
        <div key="revealing" className="flex items-center justify-center w-full">
          <span className="text-4xl">❓</span>
        </div>
      ) : (
        <div key="locked" className="flex items-center justify-center w-full opacity-30">
          <span className="text-3xl">{caseEmoji}</span>
        </div>
      )}
    </div>
  )
}

const FREEPLAY_BASE = 10

export function CaseBattlesGame({ mode, bankroll, onBet, onResolve }: CaseBattlesGameProps) {
  const router = useRouter()
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { caseXray, caseXrayLevel } = useSurvivalPerks('case-battles')
  const xrayProc = usePerkProc(mode === 'survival' && caseXray, 'perk_case_xray', caseXrayLevel)
  const minBet = useGameMinBet(mode, FREEPLAY_BASE)
  const cases = getCases(minBet)

  const [state, setState] = useState<CaseBattleState>(initCaseBattle)
  const stateRef = useRef(state)
  stateRef.current = state
  const [rerollPending, setRerollPending] = useState(false)
  const [rerollingIdx, setRerollingIdx] = useState(-1)
  const [infoCaseId, setInfoCaseId] = useState<number | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)
  const [revealingIdx, setRevealingIdx] = useState(-1)
  const [lastSelectedCases, setLastSelectedCases] = useState<number[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const xrayProcFiredRef = useRef(false)

  const isSetup = state.stage === 'setup'
  const isOpening = state.stage === 'opening'
  const isSettled = state.stage === 'settled'
  const { showGameOver, handleGameOver } = useSurvivalGameOver(mode, {
    idle: !isOpening && (isSetup || isSettled),
  })
  const isRerollPending = isOpening && rerollPending
  const showQuoteUntilNext = isOpening && !isRerollPending

  const canBattle = state.selectedCases.length > 0 && state.totalCost <= bankroll && state.totalCost >= minBet
  const numCases  = state.selectedCases.length

  const displayUserTotal = state.userItems.slice(0, revealedCount).reduce((s, oc) => s + oc.item.value, 0)
  const displayBotTotal  = state.botItems.slice(0, revealedCount).reduce((s, oc) => s + oc.item.value, 0)

  function clearTimeouts() {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }

  useEffect(() => {
    if (state.stage !== 'opening') return

    setRevealedCount(0)
    setRevealingIdx(0)
    const total = state.selectedCases.length

    for (let i = 0; i < total; i++) {
      const t = setTimeout(() => {
        setRevealedCount(i + 1)
        if (i + 1 < total) setRevealingIdx(i + 1)
        else setRevealingIdx(-1)
      }, i * 800 + 600)
      timeoutsRef.current.push(t)
    }

    const tSettle = setTimeout(() => {
      if (xrayProcFiredRef.current) {
        xrayProcFiredRef.current = false
        setRerollPending(true)
      } else {
        const settled = settleBattle(stateRef.current)
        settleCaseBattle(settled)
        setState(settled)
      }
    }, (total - 1) * 800 + 600 + 500)
    timeoutsRef.current.push(tSettle)

    return clearTimeouts
  }, [state.stage])

  useEffect(() => () => clearTimeouts(), [])

  function settleCaseBattle(s: CaseBattleState) {
    const pushPayout = Math.round((s.userTotal + s.botTotal) / 2)
    const payout = s.outcome === 'win'
      ? s.userTotal + s.botTotal
      : s.outcome === 'push'
        ? pushPayout
        : 0
    const mult = s.outcome === 'win' && s.totalCost > 0
      ? parseFloat(((s.userTotal + s.botTotal) / s.totalCost).toFixed(2))
      : s.outcome === 'push' && s.totalCost > 0
        ? parseFloat((pushPayout / s.totalCost).toFixed(2))
        : s.outcome === 'push'
          ? 1
          : 0
    const outcome = s.outcome!
    const resolved = resolveGame(onResolve, { outcome, betAmount: s.totalCost, payout, multiplier: mult })
    const resultLabel =
      outcome === 'win'
        ? `Won ${formatChips(payout)}`
        : 'Loss'
    const built = buildPendingResult(
      { outcome, betAmount: s.totalCost, payout: resolved.payout },
      {
        result: outcome === 'push' ? `Tie · ${formatChips(pushPayout)} each` : resultLabel,
      },
      { freeBet: resolved.firstBetWasFree },
    )
    setPendingResult(built)
  }

  function handleReroll(slotIndex: number) {
    setRerollPending(false)
    setRerollingIdx(slotIndex)
    setTimeout(() => {
      setRerollingIdx(-1)
      const withReroll = rerollUserItem(stateRef.current, slotIndex, cases)
      const settled = settleBattle(withReroll)
      settleCaseBattle(settled)
      setState(settled)
    }, 700)
  }

  function handleSkipReroll() {
    setRerollPending(false)
    const settled = settleBattle(stateRef.current)
    settleCaseBattle(settled)
    setState(settled)
  }

  function handleBattle() {
    if (!canBattle || !lock()) return
    onBet?.(state.totalCost)
    setLastSelectedCases(state.selectedCases)
    setQuoteIdx((prev) => pickQuote(prev))
    clearTimeouts()
    xrayProcFiredRef.current = !blessed && !cursed && xrayProc.rollForBet()
    setState((prev) => blessed ? winGame(prev, cases) : cursed ? loseGame(prev, cases) : startBattle(prev, cases))
    setPendingResult(null)
  }

  const handleNext = useCallback(() => {
    unlock()
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    setPendingResult(null)
    if (!survivalAfterNext(mode)) return
    const fresh = initCaseBattle()
    if (autoReBet && lastSelectedCases.length > 0) {
      const cost = lastSelectedCases.reduce((s, id) => s + (cases[id]?.price ?? 0), 0)
      if (cost <= bankroll) {
        setState({ ...fresh, selectedCases: lastSelectedCases, totalCost: cost })
        return
      }
    }
    setState(fresh)
  }, [pendingResult, autoReBet, lastSelectedCases, bankroll, cases, mode])

  const caseCounts = cases.map(c => state.selectedCases.filter(id => id === c.id).length)
  const infoCaseDef = infoCaseId !== null ? (cases[infoCaseId] ?? null) : null

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Case Battles</span>
        <span className="text-sm text-zinc-600">{state.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 h-full w-full flex-col items-center justify-center px-3 py-4 gap-3"
        entries={matchHistory}
        gameLabel="Case Battles"
      >
        <GameDockBackButton mode={mode} visible={isSetup && !showGameOver} />
        {isSetup && (blessed || cursed) && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            {blessed ? 'Guaranteed win this battle' : 'Guaranteed loss this battle'}
          </PerkHint>
        )}
        {isRerollPending && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Tap one of your items to reroll it
          </PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={!isSetup ? state.totalCost : 0}
          visible={!isSetup && state.totalCost > 0}
        />

        {/* Setup phase: case selector */}
        {isSetup && (
          <div className="w-full max-w-md flex flex-col gap-4">
            <p className="text-sm text-zinc-500 text-center uppercase tracking-wider font-semibold">
              Select up to 5 cases — {numCases}/5
            </p>
            <div className="grid grid-cols-5 gap-2.5">
              {cases.map(c => {
                const count = caseCounts[c.id] ?? 0
                const atMax = numCases >= 5 && count === 0
                return (
                  <div key={c.id} className="relative flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInfoCaseId(c.id)}
                      className="absolute -top-1 -right-1 z-10 w-5 h-5 flex items-center justify-center text-[10px] font-black text-zinc-400 hover:text-white bg-zinc-950 rounded-full border border-zinc-700 hover:border-zinc-400 transition-colors leading-none"
                    >
                      i
                    </button>
                    <button
                      type="button"
                      onClick={() => setState(prev => addCase(prev, c.id, cases))}
                      disabled={numCases >= 5}
                      className={[
                        'w-full h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all duration-150 active:scale-95',
                        count > 0
                          ? 'border-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 shadow-lg shadow-yellow-900/20'
                          : 'border-zinc-700 bg-zinc-800/60 hover:border-zinc-500 hover:bg-zinc-800',
                        atMax ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      <span className="text-3xl leading-none">{c.emoji}</span>
                      {count > 0 && (
                        <span className="text-xs font-black text-yellow-400 leading-none">×{count}</span>
                      )}
                    </button>
                    <p className="text-xs text-center font-semibold leading-tight text-zinc-400">
                      {c.name.replace(' Case', '')}
                    </p>
                    <p className="text-xs font-bold text-zinc-200 tabular-nums">{formatChips(c.price)}</p>
                    {count > 0 ? (
                      <button
                        type="button"
                        onClick={() => setState(prev => removeCase(prev, c.id, cases))}
                        className="w-full py-1.5 text-sm font-bold text-red-400 hover:text-white bg-red-950 hover:bg-red-700 border border-red-800 hover:border-red-600 rounded-lg transition-colors active:scale-95"
                      >
                        − Remove
                      </button>
                    ) : (
                      <span className="w-full py-1.5 text-sm invisible select-none border rounded-lg">− Remove</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Opening / settled phase: two columns */}
        {(isOpening || isSettled) && (
          <div className="w-full max-w-sm flex gap-4">
            {/* YOU column */}
            <div className="flex-1 flex flex-col gap-2">
              <p className={`text-xs uppercase tracking-widest text-center font-black ${isSettled && state.outcome === 'win' ? 'text-emerald-400' : isSettled && state.outcome === 'push' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                You {isSettled && state.outcome === 'win' ? '🏆' : isSettled && state.outcome === 'push' ? '🤝' : ''}
              </p>
              {state.userItems.map((oc, i) => (
                <div
                  key={i}
                  className={isRerollPending ? 'relative cursor-pointer group' : ''}
                  onClick={isRerollPending ? () => handleReroll(i) : undefined}
                >
                  <ItemSlot
                    caseEmoji={cases[oc.caseId]?.emoji ?? '📦'}
                    item={oc.item}
                    isRevealing={i === revealingIdx}
                    isRevealed={i < revealedCount}
                    isRerolling={i === rerollingIdx}
                  />
                  {isRerollPending && (
                    <div className="absolute inset-0 rounded-xl border-2 border-emerald-500/70 bg-emerald-950/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-bold text-emerald-300">↺ Reroll</span>
                    </div>
                  )}
                </div>
              ))}
              {(isSettled || (isOpening && revealedCount > 0)) && (
                <div className="border-t-2 border-zinc-700 pt-1.5 mt-0.5">
                  <p className={`text-sm font-black tabular-nums text-right ${isSettled && state.outcome === 'win' ? 'text-emerald-400' : isSettled && state.outcome === 'push' ? 'text-zinc-200' : 'text-zinc-300'}`}>
                    {formatChips(isSettled ? state.userTotal : displayUserTotal)}
                  </p>
                </div>
              )}
            </div>

            {/* BOT column */}
            <div className="flex-1 flex flex-col gap-2">
              <p className={`text-xs uppercase tracking-widest text-center font-black ${isSettled && state.outcome === 'loss' ? 'text-red-400' : isSettled && state.outcome === 'push' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                Bot {isSettled && state.outcome === 'loss' ? '🏆' : isSettled && state.outcome === 'push' ? '🤝' : ''}
              </p>
              {state.botItems.map((oc, i) => (
                <ItemSlot
                  key={i}
                  caseEmoji={cases[oc.caseId]?.emoji ?? '📦'}
                  item={oc.item}
                  isRevealing={i === revealingIdx}
                  isRevealed={i < revealedCount}
                />
              ))}
              {(isSettled || (isOpening && revealedCount > 0)) && (
                <div className="border-t-2 border-zinc-700 pt-1.5 mt-0.5">
                  <p className={`text-sm font-black tabular-nums text-right ${isSettled && state.outcome === 'loss' ? 'text-red-400' : isSettled && state.outcome === 'push' ? 'text-zinc-200' : 'text-zinc-300'}`}>
                    {formatChips(isSettled ? state.botTotal : displayBotTotal)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          {!isSettled && (
            <div className="flex min-h-12 items-center justify-center">
              {showQuoteUntilNext ? (
                <GameDockRandomQuote quoteIdx={quoteIdx} />
              ) : (
                <div className="invisible pointer-events-none flex gap-2" aria-hidden>
                  <div className="w-12 h-12 rounded-full" />
                  <div className="w-12 h-12 rounded-full" />
                  <div className="w-12 h-12 rounded-full" />
                  <div className="w-12 h-12 rounded-full" />
                </div>
              )}
            </div>
          )}

          <div className={GAME_DOCK_SETTLED_SLOT}>
            {isSetup && (
              <div className="flex items-center gap-2.5 flex-wrap justify-center">
                <span className="text-zinc-500 text-base">Total cost</span>
                <span
                  className={`font-bold text-xl tabular-nums ${state.totalCost > bankroll ? 'text-red-400' : 'text-white'}`}
                >
                  {state.totalCost > 0 ? formatChips(state.totalCost) : '—'}
                </span>
                {numCases > 0 && (
                  <button
                    type="button"
                    onClick={() => setState(initCaseBattle())  /* cost resets to 0 */}
                    className="px-2 py-0.5 text-xs font-medium rounded border border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
            {isOpening && !isRerollPending && (
              <p className="text-sm text-zinc-500">
                Opening {Math.min(revealedCount + 1, numCases)} of {numCases}…
              </p>
            )}
            {isRerollPending && (
              <p className="text-sm font-semibold text-emerald-300 animate-pulse">
                ✦ Perk active — tap one of your items to reroll
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
            {!isSetup && !isOpening && !(isSettled && pendingResult) && (
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
                  {isRerollPending && (
                    <button type="button" onClick={handleSkipReroll} className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white font-bold rounded-lg transition-colors text-base">Skip</button>
                  )}
                  <button
                    type="button"
                    onClick={isSettled ? handleNext : handleBattle}
                    disabled={(isOpening && !isRerollPending) || (isSetup && !canBattle)}
                    className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
                  >
                    {isSettled ? 'Next →' : isRerollPending ? 'Rerolling…' : isOpening ? 'Opening…' : 'Battle →'}
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {infoCaseDef && (() => {
        const totalWeight = infoCaseDef.items.reduce((s, e) => s + e.weight, 0)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setInfoCaseId(null)}
          >
            <div
              className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 w-72 flex flex-col gap-3 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{infoCaseDef.emoji}</span>
                  <div>
                    <p className="font-bold text-white text-sm">{infoCaseDef.name}</p>
                    <p className="text-zinc-500 text-xs">{formatChips(infoCaseDef.price)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoCaseId(null)}
                  className="text-zinc-500 hover:text-white text-lg leading-none px-1 transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {infoCaseDef.items.map((entry, i) => {
                  const pct = Math.round((entry.weight / totalWeight) * 100)
                  return (
                    <div key={i} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 bg-zinc-800/60 border ${RARITY_BORDER[entry.item.rarity]}`}>
                      <span className="text-xl leading-none">{entry.item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${RARITY_TEXT[entry.item.rarity]}`}>{entry.item.name}</p>
                        <p className="text-zinc-600 text-[10px] capitalize">{entry.item.rarity}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-zinc-200 font-bold tabular-nums text-xs">{formatChips(entry.item.value)}</p>
                        <p className="text-zinc-600 text-[10px]">{pct}%</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
