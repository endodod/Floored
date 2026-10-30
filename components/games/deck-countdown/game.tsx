'use client'
import { useRef, useState } from 'react'
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
import { bustChance, cashOutDeckCountdown, DECK_COUNTDOWN_MULTS, flipDeckCountdown, flipWithBurn, initDeckCountdown, loseFlip, startDeckCountdown, winFlip } from '@/games/deck-countdown/engine'
import type { DeckCountdownState } from '@/games/deck-countdown/types'

export function DeckCountdownGame({ mode, bankroll, onBet, onResolve }: { mode: GameMode; bankroll: number; onBet?: (amount: number) => void; onResolve: GameResolveFn }) {
  const minBet = useGameMinBet(mode)
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse(); const { blessed } = useBless()
  const perk = useSurvivalPerks('deck-countdown')
  const burn = usePerkProc(perk.deckBurn, 'perk_deck_burn', perk.deckBurnLevel)
  const { autoReBet } = useSettingsStore()
  const [round, setRound] = useState<DeckCountdownState>(initDeckCountdown)
  const [bet, setBet] = useState(0); const [lastBet, setLastBet] = useState(0)
  const [pending, setPending] = useState<GamePendingResult | null>(null)
  const [history, setHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  const [burnUsed, setBurnUsed] = useState(false)
  const [animating, setAnimating] = useState(false)
  const animationLock = useRef(false)
  const playing = round.stage === 'playing'; const betting = round.stage === 'betting'; const settled = round.stage === 'settled'
  const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: betting || (settled && pending != null) })
  useLadderAllIn(mode, bankroll, bet, setBet)
  const canDeal = bet >= minBet && bet <= bankroll

  function settle(next: DeckCountdownState) {
    setRound(next)
    if (next.stage !== 'settled') return
    const result = resolveGame(onResolve, { outcome: next.outcome === 'win' ? 'win' : 'loss', betAmount: next.betAmount, payout: next.outcome === 'win' ? Math.round(next.betAmount * next.multiplier) : 0, multiplier: next.outcome === 'win' ? next.multiplier : 0 })
    const resultText = next.outcome === 'win' ? `${next.flipped.length} ranks` : `Bust on ${next.bustCard?.rank ?? '?'}`
    const summary = next.outcome === 'win' ? `${next.flipped.length} ranks · ${formatMultiplier(next.multiplier)}` : resultText
    setPending(buildPendingResult({ outcome: next.outcome === 'win' ? 'win' : 'loss', betAmount: next.betAmount, payout: result.payout }, { result: resultText }, { gameMultiplier: next.outcome === 'win' ? next.multiplier : 0, historySubtitle: summary, freeBet: result.firstBetWasFree }))
  }
  function deal() { if (!canDeal || !lock()) return; onBet?.(bet); setLastBet(bet); setBet(0); setPending(null); setBurnUsed(false); setQuoteIdx(pickQuote(quoteIdx)); burn.rollForBet(); setRound(startDeckCountdown(bet)) }
  function flip() {
    if (!playing || animationLock.current) return
    animationLock.current = true
    setAnimating(true)
    const dev = mode !== 'daily' && mode !== 'ladder'
    const raw = dev ? blessed ? winFlip(round) : cursed ? loseFlip(round) : null : null
    const next = raw ?? (burn.perkEffective && !burnUsed ? flipWithBurn(round) : flipDeckCountdown(round))
    if (!raw && burn.perkEffective && !burnUsed && round.deck.length && round.flipped.some(c => c.rank === round.deck[round.deck.length - 1]?.rank)) setBurnUsed(true)
    window.setTimeout(() => { settle(next); setAnimating(false); animationLock.current = false }, 300)
  }
  function cashOut() { if (!playing || round.flipped.length < 2) return; settle(cashOutDeckCountdown(round)) }
  function nextRound() { unlock(); if (pending) setHistory(h => [pending.entry, ...h].slice(0, 80)); setPending(null); if (!survivalAfterNext(mode)) return; burn.resetPerk(); setRound(initDeckCountdown()); if (autoReBet && lastBet >= minBet && lastBet <= bankroll) setBet(lastBet) }

  return <div className={GAME_CARD_SHELL}>
    <div className={GAME_STATUS_BAR}><span className="text-[13px] font-semibold text-ink">Deck Countdown</span>{burn.perkEffective && <PerkHint>Burn Card — first repeat is safe</PerkHint>}<span className="text-[13px] text-dim">{round.message}</span></div>
    <GameFieldWithHistory className={GAME_BOARD_ARENA} boardClassName="relative" entries={history} gameLabel="Deck Countdown">
      <div className="dcd-board relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 px-3 py-3">
        <GameDockBackButton mode={mode} visible={betting && !showGameOver}/><GameActiveBetBadge betAmount={!betting ? round.betAmount : 0} visible={!betting}/>
        <div className="dcd-top flex items-center justify-center gap-5">
          <div className="flex flex-col items-center gap-1"><PlayingCard variant="back"/><span className="plaque px-2 py-1 text-xs">{round.deck.length} left</span></div>
          <div className="flex flex-col items-center gap-1"><span className="felt-print">Last card</span>{round.flipped.length || round.bustCard ? <PlayingCard key={`${(round.bustCard ?? round.flipped[round.flipped.length - 1])!.rank}-${(round.bustCard ?? round.flipped[round.flipped.length - 1])!.suit}`} rank={(round.bustCard ?? round.flipped[round.flipped.length - 1])!.rank} suit={(round.bustCard ?? round.flipped[round.flipped.length - 1])!.suit} className={round.bustCard ? 'g-shake' : 'g-flip'}/> : <PlayingCard variant="slot"/>}</div>
          {round.burnedCards.length > 0 && <div className="flex flex-col items-center gap-1"><span className="felt-print">Burned</span><PlayingCard variant="back"/></div>}
        </div>
        <div className="dcd-ranks grid grid-cols-7 gap-1.5 sm:grid-cols-13">{['2','3','4','5','6','7','8','9','10','J','Q','K','A'].map(rank => { const card = round.flipped.find(c => c.rank === rank); const busted = round.bustCard?.rank === rank; return <div key={rank} className={`plaque flex h-10 w-9 items-center justify-center text-sm ${busted ? 'bg-loss text-white' : card ? 'bg-felt text-white g-pop' : 'felt-print'}`}>{card ? `${card.suit}` : rank}</div> })}</div>
        <div className="dcd-figures flex gap-3"><div className="plaque px-3 py-2 text-center"><span className="felt-print block">Next flip busts</span><span className="num text-ink">{Math.round(bustChance(round) * 100)}%</span></div><div className="plaque px-3 py-2 text-center"><span className="felt-print block">Next flip pays</span><span className="num text-gold">{formatMultiplier(round.multiplier)}</span></div></div>
        {playing && <div className="flex gap-2"><button onClick={flip} disabled={animating} className={GAME_DOCK_PRIMARY_BTN}>Flip · {formatMultiplier(DECK_COUNTDOWN_MULTS[round.flipped.length + 1]!)}</button><button onClick={cashOut} disabled={animating} className={`${GAME_DOCK_PRIMARY_BTN} ${round.flipped.length < 2 ? 'invisible pointer-events-none' : ''}`}>Cash out {formatChips(Math.round(round.betAmount * round.multiplier))}</button></div>}
      </div>
    </GameFieldWithHistory>
    <div className={GAME_CONTROL_DOCK_M}><div className={GAME_DOCK_INNER}>
      <GameDockChipRow visible={betting || playing} bankroll={bankroll} currentBet={bet} onAddChip={v => setBet(p => Math.min(p + v, bankroll))} quoteIdx={quoteIdx} showQuote={playing} minBet={minBet}/>
      <div className={GAME_DOCK_SETTLED_SLOT}>{betting && <GameDockBetRow currentBet={bet} onClear={() => setBet(0)}/>}{playing && <p className="text-sm text-soft">{round.flipped.length} ranks · Cash out for {formatChips(Math.round(round.betAmount * round.multiplier))}</p>}{settled && pending && <GameDockSettledRow betSummary={pending.betSummary} resultSummary={pending.resultSummary} profitLabel={pending.profitLabel} tone={pending.tone}/>}</div>
      <div className={GAME_DOCK_ACTIONS}>{showGameOver ? <GameDockGameOverButton onClick={handleGameOver}/> : betting ? <button onClick={deal} disabled={!canDeal} className={GAME_DOCK_PRIMARY_BTN}>Deal →</button> : settled ? <GameDockSettledActions mode={mode} showGameOver={showGameOver} onGameOver={handleGameOver} onNext={nextRound}/> : <span className="invisible">Deal →</span>}</div>
    </div></div>
  </div>
}

