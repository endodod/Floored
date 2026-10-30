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
      <div className="toc-board relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 px-3 py-3">
        <GameDockBackButton mode={mode} visible={betting && !showGameOver}/><GameActiveBetBadge betAmount={!betting ? round.betAmount : 0} visible={!betting}/>
        <div className="toc-multiplier num text-[18px] text-gold glow-gold">{round.multiplier > 0 ? formatMultiplier(round.multiplier) : 'Four calls · cash out between them'}</div>
        <div className="toc-stair grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">{STEP_LABELS.map((label, index) => {
          const n = index + 1, card = round.cards[index], active = playing && round.step === n, failed = settled && round.outcome === 'loss' && n === round.cards.length
          return <div key={label} className={`toc-step plaque flex flex-col items-center gap-1 p-2 ${active ? 'ring-2 ring-felt' : ''} ${failed ? 'g-shake' : card && settled ? 'g-dim' : ''}`}>
            <span className="felt-print">{label}</span>
            {card ? <PlayingCard key={`${card.rank}${card.suit}`} rank={card.rank} suit={card.suit} className={failed ? 'g-shake' : 'g-flip'} style={{ '--i': index } as CSSProperties}/> : <PlayingCard variant="slot"/>}
            {card && (round.stepMultipliers[index] != null || (round.outcome === 'push' && n === 1)) && <span className="gold-print num">{round.outcome === 'push' && n === 1 ? 'Push' : formatMultiplier(round.stepMultipliers[index]!)}</span>}
          </div>
        })}</div>
        <div className="toc-actions flex min-h-12 w-full max-w-2xl items-center justify-center gap-2">
          {playing && <div className="flex w-full justify-center gap-2">{choices.map(option => { const callKey = `${round.step}-${option.pick}`; const suit = ['♠','♥','♦','♣'].includes(option.pick); return <button key={callKey} onClick={() => call(option.pick)} disabled={animating || option.mult == null} className={`m-still min-w-0 flex-1 rounded-full border border-line bg-control px-2 py-2 text-sm font-semibold text-ink disabled:opacity-40 ${round.step === 1 ? option.pick === 'red' ? 'toc-red' : 'toc-black' : ''} ${round.step === 2 ? option.pick === 'higher' ? 'hilo-higher' : 'hilo-lower' : ''} ${suit && (option.pick === '♥' || option.pick === '♦') ? 'text-loss' : ''}`}>{CALL_LABELS[option.pick] ?? option.pick} <span className="num ml-1">{option.mult == null ? '—' : formatMultiplier(option.mult)}</span></button> })}</div>}
          {riding && <><button onClick={cashOut} className={`${GAME_DOCK_PRIMARY_BTN} flex-1`}>Cash out {formatChips(cashout)}</button><button onClick={goOn} className="m-still h-12 flex-1 rounded-full border border-gold text-sm font-semibold text-gold">Go on</button></>}
        </div>
      </div>
    </GameFieldWithHistory>
    <div className={GAME_CONTROL_DOCK_M}><div className={GAME_DOCK_INNER}>
      <GameDockChipRow visible={betting || playing || riding} bankroll={bankroll} currentBet={bet} onAddChip={v => setBet(p => Math.min(p + v, bankroll))} quoteIdx={quoteIdx} showQuote={playing || riding} minBet={minBet}/>
      <div className={GAME_DOCK_SETTLED_SLOT}>{betting && <GameDockBetRow currentBet={bet} onClear={() => setBet(0)}/ >}{riding && <p className="text-sm text-soft">Cash out now for <span className="num text-felt">{formatChips(cashout)}</span></p>}{settled && pending && <GameDockSettledRow betSummary={pending.betSummary} resultSummary={pending.resultSummary} profitLabel={pending.profitLabel} tone={pending.tone}/>}</div>
      <div className={GAME_DOCK_ACTIONS}>{showGameOver ? <GameDockGameOverButton onClick={handleGameOver}/> : betting ? <button onClick={deal} disabled={!canDeal} className={GAME_DOCK_PRIMARY_BTN}>Deal →</button> : settled ? <GameDockSettledActions mode={mode} showGameOver={showGameOver} onGameOver={handleGameOver} onNext={nextRound}/> : <span className="invisible">Deal →</span>}</div>
    </div></div>
  </div>
}
