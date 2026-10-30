'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
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
import { formatMultiplier } from '@/utils/format'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GAME_DOCK_INNER, GAME_DOCK_SETTLED_SLOT, GAME_DOCK_ACTIONS, GAME_DOCK_PRIMARY_BTN, GAME_DOCK_RACK_BTN, GameDockBackButton, GameActiveBetBadge, GameDockChipRow, GameDockChipPicker, GameDockBetRow, GameDockSettledRow, GameDockSettledActions, GameDockGameOverButton, dockChips, useOpeningTicketChip, stakeForFraction, type StakeFraction } from '@/components/game-dock-parts'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { PlayingCard } from '@/components/games/playing-card'
import { PerkHint } from '@/components/survival/perk-hint'
import { TableChipLayer } from '@/components/games/table-chips'
import { dealDragonTiger, drawCard, initDragonTiger, loseGame, winGame } from '@/games/dragon-tiger/engine'
import type { DragonTigerBet, DragonTigerBets, DragonTigerState } from '@/games/dragon-tiger/types'

const BETS: DragonTigerBet[] = ['dragon', 'tie', 'tiger']
type DragonTigerHand = 'dragon' | 'tiger'
const LABELS: Record<DragonTigerBet, string> = { dragon: 'Dragon', tiger: 'Tiger', tie: 'Tie' }
const PAYS: Record<DragonTigerBet, string> = { dragon: '1 to 1', tiger: '1 to 1', tie: '11 to 1' }
/** Pause after Deal, then between the two cards as they turn over. */
const DRAW_COOLDOWN_MS = 900

export function DragonTigerGame({ mode, bankroll, onBet, onResolve }: { mode: GameMode; bankroll: number; onBet?: (amount: number) => void; onResolve: GameResolveFn }) {
  const minBet = useGameMinBet(mode); const { lock, unlock } = useBetGuard(); const { cursed } = useCurse(); const { blessed } = useBless()
  const perk = useSurvivalPerks('dragon-tiger'); const dragonPeek = usePerkProc(perk.dragonTigerPeek, 'perk_dragon_tiger_peek', perk.dragonTigerPeekLevel)
  const rollDragonPeek = dragonPeek.rollForBet
  const { autoReBet } = useSettingsStore()
  const [round, setRound] = useState<DragonTigerState>(initDragonTiger); const [bets, setBets] = useState<DragonTigerBets>({}); const [lastBets, setLastBets] = useState<DragonTigerBets>({}); const [placed, setPlaced] = useState<{ target: DragonTigerBet; amount: number }[]>([])
  const [chipValue, setChipValue] = useState(0); const [fraction, setFraction] = useState<StakeFraction | null>(null)
  const [lastBet, setLastBet] = useState(0); const [lastPick, setLastPick] = useState<DragonTigerBet | null>(null); const [peek, setPeek] = useState<ReturnType<typeof drawCard> | null>(null)
  const [pending, setPending] = useState<GamePendingResult | null>(null); const [history, setHistory] = useState<MatchHistoryEntry[]>([]); const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  /** The drawn hand while the two cards are being turned over, plus their reveal order. */
  const [draw, setDraw] = useState<{ result: DragonTigerState; order: DragonTigerHand[]; shown: number } | null>(null)
  const drawTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const betting = round.stage === 'betting'; const settled = round.stage === 'settled'; const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: betting || (settled && pending != null) })
  const ticketChip = useOpeningTicketChip(minBet)
  const chips = useMemo(() => ticketChip ? [ticketChip] : dockChips(minBet), [ticketChip, minBet])
  const selectedChip = chips.find((chip) => chip.value === chipValue)?.value ?? chips[0]!.value
  const totalBet = Object.values(bets).reduce((sum, amount) => sum + (amount ?? 0), 0)
  useLadderAllIn(mode, bankroll, totalBet, (value) => setBets(value > 0 ? { dragon: value } : {}))
  useEffect(() => {
    if (betting && mode === 'survival') {
      const active = rollDragonPeek()
      setPeek(active ? drawCard() : null)
    } else if (betting) {
      setPeek(null)
    }
  }, [betting, mode, rollDragonPeek])
  useEffect(() => () => { if (drawTimer.current) clearTimeout(drawTimer.current) }, [])
  function placeChip(target: DragonTigerBet) {
    if (!betting) return
    if (mode === 'ladder') { setBets({ [target]: bankroll }); setPlaced([{ target, amount: bankroll }]); return }
    const cap = ticketChip ? ticketChip.value : bankroll
    const amount = fraction && !ticketChip ? stakeForFraction(fraction, bankroll, cap - totalBet, minBet) : selectedChip
    if (amount <= 0 || totalBet + amount > cap) return
    setBets((previous) => ({ ...previous, [target]: (previous[target] ?? 0) + amount }))
    setPlaced((previous) => [...previous, { target, amount }])
  }
  function undoChip() {
    const last = placed[placed.length - 1]
    if (!last) return
    setPlaced(placed.slice(0, -1))
    setBets((previous) => {
      const next = { ...previous }
      const left = (next[last.target] ?? 0) - last.amount
      if (left > 0) next[last.target] = left
      else delete next[last.target]
      return next
    })
  }
  function clearBet() { setBets({}); setPlaced([]) }
  function deal() {
    if (totalBet < minBet || totalBet > bankroll || !lock()) return
    const betMap = bets
    const first = dragonPeek.perkEffective ? (peek ?? drawCard()) : undefined
    const result = mode !== 'daily' && mode !== 'ladder' && (blessed || cursed) ? (blessed ? winGame(betMap) : loseGame(betMap)) : dealDragonTiger(betMap, first)
    const keys = Object.keys(betMap) as DragonTigerBet[]
    const betLabel = keys.map((key) => LABELS[key]).join(', ')
    // Turn over the side the player backed first; a Tie-only ticket leads with Dragon.
    const lead: DragonTigerHand = keys.find((key) => key === 'dragon' || key === 'tiger') === 'tiger' ? 'tiger' : 'dragon'
    const order: DragonTigerHand[] = [lead, lead === 'dragon' ? 'tiger' : 'dragon']
    onBet?.(totalBet); setLastBet(totalBet); setLastPick((keys[0] ?? 'dragon') as DragonTigerBet); setLastBets(betMap); setBets({}); setPlaced([]); setPending(null); setQuoteIdx(pickQuote(quoteIdx))
    setPeek(null)
    setRound({ ...initDragonTiger(), stage: 'dealing', betAmount: totalBet, bets: betMap, message: 'Drawing cards…' })
    setDraw({ result, order, shown: 0 })
    const finish = () => {
      const outcome = result.outcome ?? 'loss'
      const resolved = resolveGame(onResolve, { outcome, betAmount: totalBet, payout: result.payout, multiplier: result.payout / Math.max(1, totalBet) })
      setRound(result)
      setPending(buildPendingResult({ outcome, betAmount: totalBet, payout: resolved.payout }, { betSpecification: betLabel, result: LABELS[result.winner ?? 'tie'], resultSpecification: `${result.dragon?.rank ?? '?'} vs ${result.tiger?.rank ?? '?'}` }, { gameMultiplier: result.payout / Math.max(1, totalBet), freeBet: resolved.firstBetWasFree }))
      setDraw(null)
    }
    drawTimer.current = setTimeout(() => {
      setDraw((current) => current ? { ...current, shown: 1 } : current)
      drawTimer.current = setTimeout(finish, DRAW_COOLDOWN_MS)
    }, DRAW_COOLDOWN_MS)
  }
  function nextRound() { if (drawTimer.current) clearTimeout(drawTimer.current); unlock(); if (pending) setHistory((h) => [pending.entry, ...h].slice(0, 80)); setPending(null); if (!survivalAfterNext(mode)) return; dragonPeek.resetPerk(); setRound(initDragonTiger()); if (autoReBet && lastBet >= minBet && lastBet <= bankroll && lastPick) { setBets({ [lastPick]: lastBet }); setPlaced([{ target: lastPick, amount: lastBet }]) } }
  const matCols = 'repeat(3, minmax(0, 1fr))'
  const cellFor = (target: string) => ({ gridColumn: String(BETS.indexOf(target as DragonTigerBet) + 1), gridRow: '1' })
  const winning = (winner: DragonTigerBet, target: string) => winner === target
  const shownCard = (hand: DragonTigerHand) => draw ? (draw.order.indexOf(hand) < draw.shown ? draw.result[hand] : null) : round[hand]
  return <div className={GAME_CARD_SHELL}>
    <div className={GAME_STATUS_BAR}><span className="text-[13px] font-semibold text-ink">Dragon Tiger</span>{dragonPeek.perkEffective && peek && <PerkHint>Tiger Eye — Dragon card previewed</PerkHint>}<span className="text-[13px] text-dim">{round.message}</span></div>
    <GameFieldWithHistory className={GAME_BOARD_ARENA} boardClassName="relative" entries={history} gameLabel="Dragon Tiger">
      <div className="dtg-board relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-4 px-3 py-3">
        <GameDockBackButton mode={mode} visible={betting && !showGameOver}/><GameActiveBetBadge betAmount={!betting ? round.betAmount : 0} visible={!betting}/>
        <div className="dtg-hands flex w-full max-w-xl items-center justify-around gap-4">{(['dragon', 'tiger'] as const).map((hand) => { const card = shownCard(hand); return <div key={hand} className={`flex flex-col items-center gap-2 ${settled && round.winner === hand ? 'g-win' : settled ? 'g-dim' : ''}`}><span className="felt-print text-lg">{LABELS[hand]}</span>{card ? <PlayingCard key={`${card.rank}-${card.suit}`} rank={card.rank} suit={card.suit} className="g-flip"/> : hand === 'dragon' && betting && peek ? <PlayingCard rank={peek.rank} suit={peek.suit}/> : <PlayingCard variant="slot"/>}<span className="num text-soft">{card?.rank ? card.rank : '—'}</span></div> })}</div>
        <div className={`dtg-mat ${!betting ? 'pointer-events-none' : ''}`}>
          <div className="relative">
            <div className="grid gap-px rounded-sm bg-[rgba(217,164,65,0.4)] p-px shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)]" style={{ gridTemplateColumns: matCols } as CSSProperties}>
              {BETS.map((option) => <button key={option} type="button" disabled={!betting} onClick={() => placeChip(option)} aria-pressed={(bets[option] ?? 0) > 0} className={`relative flex min-h-[var(--cell-h)] flex-col items-center justify-center bg-[#163021] p-2 text-center text-[12px] font-semibold text-[#f4f1ea] transition-[filter,box-shadow,opacity] duration-150 select-none ${betting ? 'cursor-pointer hover:brightness-125' : 'cursor-default'} ${settled && round.winner === option ? 'g-win' : settled ? 'g-dim' : ''}`}><span>{LABELS[option]}</span><span className="felt-print font-normal">{PAYS[option]}</span></button>)}
            </div>
            <TableChipLayer bets={betting ? bets : lastBets} chips={chips} result={settled ? round.winner : null} cellFor={cellFor} isWinning={winning} gridTemplateColumns={matCols} gridTemplateRows="var(--cell-h)" align="bottom-left" />
          </div>
        </div>
        <p className="dtg-note felt-print">Aces low · Kings high · Tie pays {formatMultiplier(12)}</p>
      </div>
    </GameFieldWithHistory>
    <div className={GAME_CONTROL_DOCK_M}><div className={GAME_DOCK_INNER}>
      {betting && mode !== 'ladder' ? <GameDockChipPicker chips={chips} selected={selectedChip} onSelect={(value) => { setChipValue(value); setFraction(null) }} remaining={(ticketChip ? ticketChip.value : bankroll) - totalBet} fraction={ticketChip ? null : fraction} onSelectFraction={ticketChip ? undefined : setFraction}><button type="button" onClick={undoChip} disabled={!placed.length} className={GAME_DOCK_RACK_BTN}>Undo</button></GameDockChipPicker> : <GameDockChipRow bankroll={bankroll} currentBet={totalBet} onAddChip={(v) => setBets((previous) => ({ ...previous, dragon: (previous.dragon ?? 0) + v }))} quoteIdx={quoteIdx} visible={betting} minBet={minBet}/>}
      <div className={GAME_DOCK_SETTLED_SLOT}>{betting && <GameDockBetRow currentBet={totalBet} onClear={clearBet}/>} {!betting && pending && <GameDockSettledRow betSummary={pending.betSummary} resultSummary={pending.resultSummary} profitLabel={pending.profitLabel} tone={pending.tone}/>}</div>
      <div className={GAME_DOCK_ACTIONS}>{showGameOver ? <GameDockGameOverButton onClick={handleGameOver}/> : betting ? <button onClick={deal} disabled={totalBet < minBet || totalBet > bankroll} className={GAME_DOCK_PRIMARY_BTN}>Deal →</button> : settled ? <GameDockSettledActions mode={mode} showGameOver={showGameOver} onGameOver={handleGameOver} onNext={nextRound}/> : <span className="invisible">Deal →</span>}</div>
    </div></div>
  </div>
}
