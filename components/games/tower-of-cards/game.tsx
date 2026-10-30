'use client'
import { useRef, useState, type CSSProperties } from 'react'
import type { GameMode } from '@/store/types'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'
import { useBetGuard } from '@/hooks/use-bet-guard'
import { useRunEnd } from '@/hooks/use-run-end'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { usePerkProc } from '@/hooks/use-perk-proc'
import { useSettingsStore } from '@/store/settings-store'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { resolveGame } from '@/lib/survival/game-resolve'
import { buildPendingResult, type GamePendingResult } from '@/lib/game-result-labels'
import { pickQuote } from '@/lib/gambling-quotes'
import { formatChips, formatMultiplier } from '@/utils/format'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GAME_DOCK_INNER, GAME_DOCK_SETTLED_SLOT, GAME_DOCK_ACTIONS, GAME_DOCK_PRIMARY_BTN, GameDockBackButton, GameActiveBetBadge, GameDockChipRow, GameDockBetRow, GameDockSettledRow, GameDockSettledActions, GameDockGameOverButton } from '@/components/game-dock-parts'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { PlayingCard } from '@/components/games/playing-card'
import { PerkHint } from '@/components/survival/perk-hint'
import { cashOutTower, callTower, goOnTower, initTower, loseCall, optionsFor, startTower, winCall } from '@/games/tower-of-cards/engine'
import type { TowerCall, TowerState } from '@/games/tower-of-cards/types'

const STEP_LABELS = ['Colour', 'Higher / Lower', 'Inside / Outside', 'Suit']
const CALL_LABELS: Record<string, string> = { red: 'Red', black: 'Black', higher: '↑ Higher', lower: '↓ Lower', inside: 'Inside', outside: 'Outside' }
/** What the player has to decide, shown in the dock above the call buttons. */
const CALL_PROMPTS = ['Call the colour of the next card', 'Higher or lower than the first card', 'Inside or outside the first two cards', 'Call the suit of the next card']

/** A step's call button in the dock's action row — the step colours are layered on top. */
const CALL_BTN =
  'm-still h-10 min-w-0 flex-1 rounded-full border border-[rgba(217,164,65,0.55)] bg-control px-2 text-[13px] font-semibold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-[border-color,filter,box-shadow,transform] duration-150 hover:border-gold hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:text-[14px]'

/** Go on: the gold-outlined twin of the Cash out button, as HiLo's Go again. */
const GO_ON_BTN =
  'm-still h-10 min-w-0 flex-1 rounded-full border border-gold px-4 text-[14px] font-semibold text-gold transition-[background-color,box-shadow,transform] duration-150 hover:bg-gold-tint hover:shadow-[0_0_24px_-6px_rgba(217,164,65,0.8)] active:scale-[0.97]'

export function TowerOfCardsGame({ mode, bankroll, onBet, onResolve }: { mode: GameMode; bankroll: number; onBet?: (amount: number) => void; onResolve: GameResolveFn }) {
  const minBet = useGameMinBet(mode)
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse(); const { blessed } = useBless()
  const perk = useSurvivalPerks('tower-of-cards')
  const net = usePerkProc(perk.towerNet, 'perk_tower_net', perk.towerNetLevel)
  const { autoReBet } = useSettingsStore()
  const [round, setRound] = useState<TowerState>(initTower)
  const [bet, setBet] = useState(0); const [lastBet, setLastBet] = useState(0)
  const [pending, setPending] = useState<GamePendingResult | null>(null)
  const [history, setHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  const [animating, setAnimating] = useState(false)
  const animationLock = useRef(false)
  const betting = round.stage === 'betting', playing = round.stage === 'playing', riding = round.stage === 'riding', settled = round.stage === 'settled'
  const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: betting || (settled && pending != null) })
  useLadderAllIn(mode, bankroll, bet, setBet)
  const canDeal = bet >= minBet && bet <= bankroll
  const cashout = Math.round(round.betAmount * round.multiplier)
  const choices = playing ? optionsFor(round) : []

  function settle(next: TowerState) {
    setRound(next)
    if (next.stage !== 'settled') return
    const outcome = next.outcome ?? 'loss'
    const payout = outcome === 'loss' ? 0 : Math.round(next.betAmount * next.multiplier)
    const resolved = resolveGame(onResolve, { outcome, betAmount: next.betAmount, payout, multiplier: outcome === 'loss' ? 0 : next.multiplier })
    const result = outcome === 'loss' ? `Wrong ${next.lastCall?.pick ?? 'call'}` : outcome === 'push' ? 'Safety Net · push' : `Step ${next.cards.length}`
    setPending(buildPendingResult({ outcome, betAmount: next.betAmount, payout: resolved.payout }, { result }, { gameMultiplier: outcome === 'loss' ? 0 : next.multiplier, freeBet: resolved.firstBetWasFree }))
  }
  function deal() { if (!canDeal || !lock()) return; onBet?.(bet); setLastBet(bet); setBet(0); setPending(null); setQuoteIdx(pickQuote(quoteIdx)); net.rollForBet(); setRound(startTower(bet)) }
  function call(pick: TowerCall['pick']) {
    if (!playing || animationLock.current) return
    const callInfo = { step: round.step, pick } as TowerCall
    animationLock.current = true; setAnimating(true)
    const dev = mode !== 'daily' && mode !== 'ladder'
    const next = dev && blessed ? winCall(round, callInfo) : dev && cursed ? loseCall(round, callInfo) : callTower(round, callInfo, net.perkEffective)
    window.setTimeout(() => { settle(next); setAnimating(false); animationLock.current = false }, 300)
  }
  function cashOut() { settle(cashOutTower(round)) }
  function goOn() { setRound(goOnTower(round)) }
  function nextRound() { unlock(); if (pending) setHistory(h => [pending.entry, ...h].slice(0, 80)); setPending(null); if (!survivalAfterNext(mode)) return; net.resetPerk(); setRound(initTower()); if (autoReBet && lastBet >= minBet && lastBet <= bankroll) setBet(lastBet) }

  return <div className={GAME_CARD_SHELL}>
    <div className={GAME_STATUS_BAR}><span className="text-[13px] font-semibold text-ink">Tower of Cards</span>{net.perkEffective && <PerkHint>Safety Net active — a wrong call returns your banked amount</PerkHint>}<span className="text-[13px] text-dim">{round.message}</span></div>
    <GameFieldWithHistory className={GAME_BOARD_ARENA} boardClassName="relative" entries={history} gameLabel="Tower of Cards">
      <div className="toc-board relative flex h-full min-h-0 w-full flex-col items-center gap-3 px-3 pb-3 pt-14">
        <GameDockBackButton mode={mode} visible={betting && !showGameOver}/><GameActiveBetBadge betAmount={!betting ? round.betAmount : 0} visible={!betting}/>
        <div className="toc-multiplier num text-[18px] text-gold glow-gold">{round.multiplier > 0 ? formatMultiplier(round.multiplier) : 'Four calls · cash out between them'}</div>
        <div className="toc-stair grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">{STEP_LABELS.map((label, index) => {
          const n = index + 1, card = round.cards[index], failed = settled && round.outcome === 'loss' && n === round.cards.length
          return <div key={label} className={`toc-step flex flex-col items-center gap-1 p-2 ${failed ? 'g-shake' : card && settled ? 'g-dim' : ''}`}>
            <span className="felt-print">{label}</span>
            {card ? <PlayingCard key={`${card.rank}${card.suit}`} rank={card.rank} suit={card.suit} className={failed ? 'g-shake' : 'g-flip'} style={{ '--i': index } as CSSProperties}/> : <PlayingCard variant="slot"/>}
            {card && (round.stepMultipliers[index] != null || (round.outcome === 'push' && n === 1)) && <span className="gold-print num">{round.outcome === 'push' && n === 1 ? 'Push' : formatMultiplier(round.stepMultipliers[index]!)}</span>}
          </div>
        })}</div>
      </div>
    </GameFieldWithHistory>
    <div className={GAME_CONTROL_DOCK_M}><div className={GAME_DOCK_INNER}>
      <GameDockChipRow visible={betting || playing || riding} bankroll={bankroll} currentBet={bet} onAddChip={v => setBet(p => Math.min(p + v, bankroll))} quoteIdx={quoteIdx} showQuote={playing || riding} minBet={minBet}/>
      <div className={GAME_DOCK_SETTLED_SLOT}>{betting && <GameDockBetRow currentBet={bet} onClear={() => setBet(0)}/ >}{playing && <p className="text-sm text-soft">{CALL_PROMPTS[round.step - 1]}</p>}{riding && <p className="text-sm text-soft">Cash out now for <span className="num text-felt">{formatChips(cashout)}</span></p>}{settled && pending && <GameDockSettledRow betSummary={pending.betSummary} resultSummary={pending.resultSummary} profitLabel={pending.profitLabel} tone={pending.tone}/>}</div>
      <div className={GAME_DOCK_ACTIONS}>{showGameOver ? <GameDockGameOverButton onClick={handleGameOver}/> : betting ? <button onClick={deal} disabled={!canDeal} className={GAME_DOCK_PRIMARY_BTN}>Deal →</button> : settled ? <GameDockSettledActions mode={mode} showGameOver={showGameOver} onGameOver={handleGameOver} onNext={nextRound}/> : playing ? <div className="flex w-full max-w-2xl justify-center gap-2">{choices.map(option => { const callKey = `${round.step}-${option.pick}`; const suit = ['♠','♥','♦','♣'].includes(option.pick); return <button key={callKey} onClick={() => call(option.pick)} disabled={animating || option.mult == null} className={`${CALL_BTN} ${round.step === 1 ? option.pick === 'red' ? 'toc-red' : 'toc-black' : ''} ${round.step === 2 ? option.pick === 'higher' ? 'hilo-higher' : 'hilo-lower' : ''} ${suit && (option.pick === '♥' || option.pick === '♦') ? 'text-loss' : ''}`}>{CALL_LABELS[option.pick] ?? option.pick} <span className="num ml-1">{option.mult == null ? '—' : formatMultiplier(option.mult)}</span></button> })}</div> : riding ? <div className="flex w-full max-w-2xl justify-center gap-2"><button onClick={cashOut} className={`${GAME_DOCK_PRIMARY_BTN} min-w-0 flex-1 px-4`}>Cash out {formatChips(cashout)}</button><button onClick={goOn} className={GO_ON_BTN}>Go on</button></div> : <span className="invisible">Deal →</span>}</div>
    </div></div>
  </div>
}
