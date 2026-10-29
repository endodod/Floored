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
  GAME_DOCK_PRIMARY_BTN,
  GAME_DOCK_SECONDARY_BTN,
  GameActiveBetBadge,
  GameDockBackButton,
  GameDockGameOverButton,
  GameDockLeaveButton,
  GameDockSettledRow,
} from '@/components/game-dock-parts'
import { useRunEnd } from '@/hooks/use-run-end'
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
  getLadderCases,
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
import type { CaseBattleState, CaseDef, CaseItem, CaseRarity } from '@/games/case-battles/types'
import { ItemIcon } from './item-icons'
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

// Rarity colours come from the cb-r-* classes in globals.css (--rar).
const RARITY_CLASS: Record<CaseRarity, string> = {
  common:    'cb-r-common',
  uncommon:  'cb-r-uncommon',
  rare:      'cb-r-rare',
  epic:      'cb-r-epic',
  legendary: 'cb-r-legendary',
}

// The opening reel: a run of the case's own items (drawn by their odds) that
// slows down and stops with the real result under the marker.
const OPEN_MS = 1300
const REEL_LEN = 34
const REEL_TARGET = 29

function reelFor(pool: CaseDef['items'], result: CaseItem, seed: number): CaseItem[] {
  let h = seed * 2654435761 >>> 0
  for (const ch of result.name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  const rand = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0
    return h / 4294967296
  }
  const total = pool.reduce((s, e) => s + e.weight, 0)
  return Array.from({ length: REEL_LEN }, (_, k) => {
    if (k === REEL_TARGET) return result
    let r = rand() * total
    for (const e of pool) if ((r -= e.weight) < 0) return e.item
    return pool[0]!.item
  })
}

// One metal per case tier: Bronze, Silver, Gold, Diamond, Crown.
const CASE_METAL = [
  { body: '#8a5426', dark: '#4a2a10', trim: '#d39557' },
  { body: '#8d9099', dark: '#45474e', trim: '#dadce2' },
  { body: '#b0812c', dark: '#5e4313', trim: '#f2d48f' },
  { body: '#3f7f95', dark: '#1d4252', trim: '#bfe6f2' },
  { body: '#2c2433', dark: '#120e16', trim: '#d9a441' },
]

function CaseArt({ tier, className = '' }: { tier: number; className?: string }) {
  const m = CASE_METAL[tier % CASE_METAL.length] ?? CASE_METAL[0]!
  return (
    <svg viewBox="0 0 40 32" className={className} aria-hidden>
      <path d="M15 6.5V4a1.6 1.6 0 0 1 1.6-1.6h6.8A1.6 1.6 0 0 1 25 4v2.5" fill="none" stroke={m.dark} strokeWidth="2.2" />
      <rect x="2" y="6" width="36" height="24" rx="3.5" fill={m.body} stroke={m.dark} strokeWidth="1.2" />
      <path d="M2.6 13.5h34.8" stroke={m.dark} strokeWidth="1.2" />
      <path d="M5.5 7.5h29" stroke={m.trim} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <rect x="8.5" y="6.6" width="2.6" height="22.8" fill={m.trim} opacity="0.5" />
      <rect x="28.9" y="6.6" width="2.6" height="22.8" fill={m.trim} opacity="0.5" />
      <rect x="16.8" y="10.8" width="6.4" height="5.6" rx="1.2" fill={m.trim} stroke={m.dark} strokeWidth="0.8" />
      <circle cx="20" cy="13.6" r="1" fill={m.dark} />
      {tier === 3 && <path d="M20 19.5l3 3.5-3 3.8-3-3.8z" fill={m.trim} />}
      {tier === 4 && <path d="M15.5 26.5v-6l2.3 2.3L20 19.5l2.2 3.3 2.3-2.3v6z" fill={m.trim} />}
    </svg>
  )
}

function WinnerCrown() {
  return (
    <svg viewBox="0 0 20 14" className="inline-block h-3 w-4 align-[-1px] text-gold" aria-label="winner">
      <path d="M2 12.5V3.5l4.2 4L10 1.5l3.8 6 4.2-4v9z" fill="currentColor" />
    </svg>
  )
}

// One opened case on a side: the closed case, then the reel, then the item.
function ItemSlot({
  tier, pool, seed, item, isRevealing, isRevealed, isRerolling = false, dim = false,
}: {
  tier: number
  pool: CaseDef['items']
  seed: number
  item: CaseItem
  isRevealing: boolean
  isRevealed: boolean
  isRerolling?: boolean
  dim?: boolean
}) {
  const open = isRevealing || isRerolling
  const shown = isRevealed && !isRerolling
  const base = 'cb-slot relative flex items-center gap-2 overflow-hidden rounded-lg border-2 px-2'

  if (shown)
    return (
      <div
        key="shown"
        title={`${item.name} · ${item.rarity} · ${formatChips(item.value)}`}
        className={`${base} cb-slot-shown g-fade ${RARITY_CLASS[item.rarity]} ${item.rarity === 'legendary' || item.rarity === 'epic' ? 'g-gold' : ''} ${dim ? 'g-dim' : ''}`}
      >
        <CaseArt tier={tier} className="cb-tag" />
        <ItemIcon name={item.name} className="cb-icon shrink-0" />
        <p className="cb-row-text min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight" style={{ color: 'var(--rar)' }}>
          {item.name}
        </p>
        <span className="cb-row-text num shrink-0 text-[13px] text-ink">{formatChips(item.value)}</span>
        <span className="cb-tile-value num text-[10px] leading-none text-ink">{formatChips(item.value)}</span>
      </div>
    )
  if (open)
    return (
      <div key={isRerolling ? 'reroll' : 'open'} className={`${base} cb-slot-open`} aria-label="Opening">
        <div
          className="cb-roll"
          style={{ '--from': '-5.5', '--to': `-${REEL_TARGET + 0.5}`, '--roll': `${OPEN_MS - 150}ms` } as React.CSSProperties}
          aria-hidden
        >
          {reelFor(pool, item, seed).map((it, k) => (
            <span key={k} className={`cb-cell ${RARITY_CLASS[it.rarity]}`}>
              <ItemIcon name={it.name} className="cb-icon" />
            </span>
          ))}
        </div>
        <span className="cb-marker absolute inset-y-0.5 left-1/2 -translate-x-1/2 rounded-full" />
        <CaseArt tier={tier} className="cb-tag z-[1]" />
      </div>
    )
  return (
    <div key="closed" className={`${base} justify-center`}>
      <CaseArt tier={tier} className="cb-icon opacity-40" />
    </div>
  )
}

const FREEPLAY_BASE = 10
const CASE_COUNT = 5

export function CaseBattlesGame({ mode, bankroll, onBet, onResolve }: CaseBattlesGameProps) {
  const router = useRouter()
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { caseXray, caseXrayLevel } = useSurvivalPerks('case-battles')
  const xrayProc = usePerkProc(mode === 'survival' && caseXray, 'perk_case_xray', caseXrayLevel)
  const minBet = useGameMinBet(mode, FREEPLAY_BASE)
  const [state, setState] = useState<CaseBattleState>(initCaseBattle)
  const stateRef = useRef(state)
  stateRef.current = state
  // Ladder: one of each case for the whole pot — priced off the stake once a battle starts, since the pot is then spent.
  const ladder = mode === 'ladder'
  const cases = ladder
    ? getLadderCases(state.stage === 'setup' ? minBet : state.totalCost)
    : getCases(minBet)
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
  const { showGameOver, handleGameOver } = useRunEnd(mode, {
    idle: !isOpening && (isSetup || isSettled),
  })
  const isRerollPending = isOpening && rerollPending
  const showQuoteUntilNext = isOpening && !isRerollPending

  const canBattle = state.selectedCases.length > 0 && state.totalCost <= bankroll && state.totalCost >= minBet
  const numCases  = state.selectedCases.length

  const displayUserTotal = state.userItems.slice(0, revealedCount).reduce((s, oc, i) => s + (i === rerollingIdx ? 0 : oc.item.value), 0)
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
      }, (i + 1) * OPEN_MS)
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
    }, total * OPEN_MS + 500)
    timeoutsRef.current.push(tSettle)

    return clearTimeouts
  }, [state.stage])

  useEffect(() => () => clearTimeouts(), [])

  // Ladder: every case is always selected, so the battle opens all five for exactly the pot.
  const ladderCost = ladder ? cases.reduce((s, c) => s + c.price, 0) : 0
  useEffect(() => {
    if (!ladder || state.stage !== 'setup') return
    if (state.selectedCases.length === CASE_COUNT && state.totalCost === ladderCost) return
    setState((prev) => ({
      ...prev,
      selectedCases: Array.from({ length: CASE_COUNT }, (_, i) => i),
      totalCost: ladderCost,
      message: 'One of each case — all five open.',
    }))
  }, [ladder, ladderCost, state.stage, state.selectedCases.length, state.totalCost])

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
    // Rolled up front so the reel can stop on the new item; it settles once the reel lands.
    const withReroll = rerollUserItem(stateRef.current, slotIndex, cases)
    setState(withReroll)
    setRerollingIdx(slotIndex)
    setTimeout(() => {
      setRerollingIdx(-1)
      const settled = settleBattle(withReroll)
      settleCaseBattle(settled)
      setState(settled)
    }, OPEN_MS)
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
        <span className="text-[13px] font-semibold text-ink">Case Battles</span>
        {isSetup && (blessed || cursed) && (
          <PerkHint>{blessed ? 'Guaranteed win this battle' : 'Guaranteed loss this battle'}</PerkHint>
        )}
        {isRerollPending && (
          <PerkHint>Tap one of your items to reroll it</PerkHint>
        )}
        <span className="text-[13px] text-dim">{state.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 h-full w-full flex-col items-center justify-center px-3 py-4 gap-3"
        entries={matchHistory}
        gameLabel="Case Battles"
      >
        <GameDockBackButton mode={mode} visible={isSetup && !showGameOver} />
        <GameActiveBetBadge
          betAmount={!isSetup ? state.totalCost : 0}
          visible={!isSetup && state.totalCost > 0}
        />

        {/* Setup phase: case selector */}
        {isSetup && (
          <div className="cb-pick flex flex-col gap-3">
            <p className="cb-pick-title text-center text-xs font-semibold uppercase tracking-wider text-dim">
              {ladder ? 'One of each case — all five open' : <>Select up to 5 cases — <span className="num">{numCases}/5</span></>}
            </p>
            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {cases.map((c, idx) => {
                const count = caseCounts[c.id] ?? 0
                const atMax = numCases >= 5 && count === 0
                return (
                  <div key={c.id} className="g-pop relative flex min-w-0 flex-col items-center gap-1" style={{ '--i': idx } as React.CSSProperties}>
                    <button
                      type="button"
                      onClick={() => setInfoCaseId(c.id)}
                      aria-label={`${c.name} contents`}
                      className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-control bg-surface text-[10px] font-semibold leading-none text-soft transition-colors hover:border-dim hover:text-ink"
                    >
                      i
                    </button>
                    <button
                      type="button"
                      onClick={() => setState(prev => addCase(prev, c.id, cases))}
                      disabled={ladder || numCases >= 5}
                      aria-label={`Add ${c.name}`}
                      className={[
                        'g-lift m-still relative flex w-full items-center justify-center rounded-xl border py-1.5 transition-[border-color,background-color,box-shadow,transform] duration-150 active:scale-95',
                        count > 0
                          ? 'border-felt bg-felt-tint -translate-y-1 shadow-[0_0_18px_-6px_rgba(79,174,132,0.7)]'
                          : 'border-line bg-surface/60 hover:border-control',
                        atMax ? 'opacity-30 cursor-not-allowed' : ladder ? 'cursor-default' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      <CaseArt tier={c.id} className="cb-case" />
                      {count > 0 && (
                        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                          <span key={count} className="g-pop num block rounded-full bg-gold px-1.5 text-[11px] font-semibold leading-4 text-ground">
                            ×{count}
                          </span>
                        </span>
                      )}
                    </button>
                    <p className="mt-1 w-full truncate text-center text-[11px] font-semibold leading-tight text-soft">
                      {c.name.replace(' Case', '')}
                    </p>
                    <p className="num text-[11px] leading-tight text-ink">{formatChips(c.price)}</p>
                    {!ladder && (count > 0 ? (
                      <button
                        type="button"
                        onClick={() => setState(prev => removeCase(prev, c.id, cases))}
                        className="m-still h-6 w-full rounded-full border border-loss/60 text-[11px] font-semibold text-loss transition-colors hover:bg-loss-tint active:scale-95"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="invisible h-6 w-full" aria-hidden />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Opening / settled phase: the duel */}
        {(isOpening || isSettled) && (() => {
          const won = isSettled && state.outcome === 'win'
          const lost = isSettled && state.outcome === 'loss'
          const tied = isSettled && state.outcome === 'push'
          const showTotals = isSettled || (isOpening && revealedCount > 0)
          const sides = [
            { label: 'You', items: state.userItems, total: isSettled ? state.userTotal : displayUserTotal, wins: won, loses: lost, user: true },
            { label: 'Bot', items: state.botItems, total: isSettled ? state.botTotal : displayBotTotal, wins: lost, loses: won, user: false },
          ]
          return (
            <div className="cb-duel flex gap-2.5 sm:gap-3">
              {/* Which case each row opened: both sides open the same case per row. */}
              <div className="cb-cases order-1 flex shrink-0 flex-col items-center gap-1.5" aria-label="Cases">
                <span className="cb-head-gap block h-4" aria-hidden />
                {state.userItems.map((oc, i) => (
                  <span
                    key={i}
                    title={cases[oc.caseId]?.name}
                    className={`cb-case-row flex items-center justify-center ${i === revealingIdx ? '' : i < revealedCount ? 'opacity-70' : 'opacity-40'}`}
                  >
                    <CaseArt tier={oc.caseId} className="cb-case-mark" />
                  </span>
                ))}
              </div>
              {sides.map(side => (
                <div key={side.label} className={`cb-side ${side.user ? 'order-0' : 'order-2'} flex min-w-0 flex-1 flex-col gap-1.5`}>
                  <p className={`cb-head shrink-0 text-center text-xs font-semibold uppercase tracking-wider ${side.wins ? (side.user ? 'text-felt' : 'text-loss') : tied ? 'text-soft' : 'text-dim'}`}>
                    {side.label} {side.wins && <WinnerCrown />}
                  </p>
                  <div className="cb-items flex flex-col gap-1.5">
                    {side.items.map((oc, i) => {
                      const slot = (
                        <ItemSlot
                          tier={oc.caseId}
                          pool={cases[oc.caseId]?.items ?? []}
                          seed={i * 2 + (side.user ? 0 : 1) + (side.user && i === rerollingIdx ? 7 : 0)}
                          item={oc.item}
                          isRevealing={i === revealingIdx}
                          isRevealed={i < revealedCount}
                          isRerolling={side.user && i === rerollingIdx}
                          dim={side.loses}
                        />
                      )
                      if (!side.user || !isRerollPending) return <div key={i} className="relative">{slot}</div>
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleReroll(i)}
                          aria-label={`Reroll ${oc.item.name}`}
                          className="group relative block rounded-lg text-left ring-1 ring-felt/70"
                        >
                          {slot}
                          <span className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-felt bg-felt-tint/90 text-xs font-semibold text-felt opacity-0 transition-opacity group-hover:opacity-100">
                            Reroll
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {showTotals && (
                    <p
                      key={isSettled ? 'final' : 'live'}
                      className={`cb-total g-fade num mt-0.5 shrink-0 border-t-2 border-line pt-1.5 text-right text-sm font-semibold ${side.wins ? (side.user ? 'text-felt glow-felt' : 'text-loss') : tied ? 'text-soft' : 'text-ink'}`}
                    >
                      {formatChips(side.total)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )
        })()}
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
                <span className="text-base text-dim">Total cost</span>
                <span
                  className={`num text-xl font-semibold ${state.totalCost > bankroll ? 'text-loss' : 'text-ink'}`}
                >
                  {state.totalCost > 0 ? formatChips(state.totalCost) : '—'}
                </span>
                {numCases > 0 && !ladder && (
                  <button
                    type="button"
                    onClick={() => setState(initCaseBattle())  /* cost resets to 0 */}
                    className="m-still rounded-full border border-control px-2.5 py-0.5 text-xs font-medium text-soft transition-colors hover:border-dim hover:text-ink"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
            {isOpening && !isRerollPending && (
              <p className="text-sm text-dim">
                Opening <span className="num text-soft">{Math.min(revealedCount + 1, numCases)}</span> of <span className="num">{numCases}</span>…
              </p>
            )}
            {isRerollPending && (
              <p className="cb-wait text-sm font-semibold text-felt">
                Perk active — tap one of your items to reroll
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
                    <button type="button" onClick={handleSkipReroll} className={GAME_DOCK_SECONDARY_BTN}>Skip</button>
                  )}
                  <button
                    type="button"
                    onClick={isSettled ? handleNext : handleBattle}
                    disabled={(isOpening && !isRerollPending) || (isSetup && !canBattle)}
                    className={GAME_DOCK_PRIMARY_BTN}
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
              className="g-pop flex w-72 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CaseArt tier={infoCaseDef.id} className="h-8 w-10" />
                  <div>
                    <p className="text-sm font-semibold text-ink">{infoCaseDef.name}</p>
                    <p className="num text-xs text-dim">{formatChips(infoCaseDef.price)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoCaseId(null)}
                  aria-label="Close"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-dim transition-colors hover:bg-raised hover:text-ink"
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {infoCaseDef.items.map((entry, i) => {
                  const pct = Math.round((entry.weight / totalWeight) * 100)
                  return (
                    <div key={i} className={`flex items-center gap-2.5 rounded-lg border border-line bg-raised/50 px-2.5 py-2 ${RARITY_CLASS[entry.item.rarity]}`}>
                      <ItemIcon name={entry.item.name} className="h-6 w-6 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold" style={{ color: 'var(--rar)' }}>{entry.item.name}</p>
                        <p className="text-[10px] capitalize text-dim">{entry.item.rarity}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="num text-xs text-ink">{formatChips(entry.item.value)}</p>
                        <p className="num text-[10px] text-dim">{pct}%</p>
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
