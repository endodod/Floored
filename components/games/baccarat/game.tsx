'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { GameMode } from '@/store/types'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useBetGuard } from '@/hooks/use-bet-guard'
import { useRunEnd } from '@/hooks/use-run-end'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { usePerkProc } from '@/hooks/use-perk-proc'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import { useSettingsStore } from '@/store/settings-store'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { resolveGame } from '@/lib/survival/game-resolve'
import { buildPendingResult, formatBetSummary, type GamePendingResult } from '@/lib/game-result-labels'
import { pickQuote } from '@/lib/gambling-quotes'
import { formatChips } from '@/utils/format'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GAME_DOCK_INNER, GAME_DOCK_SETTLED_SLOT, GAME_DOCK_ACTIONS, GAME_DOCK_PRIMARY_BTN, GAME_DOCK_SECONDARY_BTN, GameDockBackButton, GameActiveBetBadge, GameDockChipRow, GameDockChipPicker, GameDockBetRow, GameDockSettledRow, GameDockSettledActions, GameDockGameOverButton, dockChips, useOpeningTicketChip, stakeForFraction, type StakeFraction } from '@/components/game-dock-parts'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { PlayingCard } from '@/components/games/playing-card'
import { PerkHint } from '@/components/survival/perk-hint'
import { TableChipLayer } from '@/components/games/table-chips'
import { dealBaccarat, loseGame, peekPlayerCard, winGame } from '@/games/baccarat/engine'
import type { BaccaratBets, BaccaratSpot, BaccaratState } from '@/games/baccarat/types'

const SPOTS: BaccaratSpot[] = ['player-pair', 'player', 'tie', 'banker', 'banker-pair']
const LABELS: Record<BaccaratSpot, string> = { 'player-pair': 'P Pair', player: 'Player', tie: 'Tie', banker: 'Banker', 'banker-pair': 'B Pair' }
const PAYS: Record<BaccaratSpot, string> = { 'player-pair': '11 to 1', player: '1 to 1', tie: '8 to 1', banker: '0.95 to 1', 'banker-pair': '11 to 1' }
const DISPLAY_ORDER = ['♠', '♥', '♦', '♣']
const ROLL_MS = 350

export function BaccaratGame({ mode, bankroll, onBet, onResolve }: { mode: GameMode; bankroll: number; onBet?: (amount: number) => void; onResolve: GameResolveFn }) {
  const minBet = useGameMinBet(mode)
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse(); const { blessed } = useBless()
  const perk = useSurvivalPerks('baccarat')
  const shoePeek = usePerkProc(perk.baccaratPeek, 'perk_baccarat_peek', perk.baccaratPeekLevel)
  const { autoReBet } = useSettingsStore()
  const [round, setRound] = useState<BaccaratState>(() => ({ stage: 'betting', player: [], banker: [], playerTotal: 0, bankerTotal: 0, winner: null, deal: [], totalBetAmount: 0, totalPayout: 0, outcome: null, message: 'Place your bets.' }))
  const [bets, setBets] = useState<BaccaratBets>({})
  const [lastBets, setLastBets] = useState<BaccaratBets>({})
  const [placed, setPlaced] = useState<{ target: BaccaratSpot; amount: number }[]>([])
  const [chipValue, setChipValue] = useState(0)
  const [fraction, setFraction] = useState<StakeFraction | null>(null)
  const ticketChip = useOpeningTicketChip(minBet)
  const chips = useMemo(() => ticketChip ? [ticketChip] : dockChips(minBet), [ticketChip, minBet])
  const selectedChip = chips.find(c => c.value === chipValue)?.value ?? chips[0]!.value
  const [peekCard, setPeekCard] = useState<ReturnType<typeof peekPlayerCard> | null>(null)
  const [dealing, setDealing] = useState(false)
  const [pendingDeal, setPendingDeal] = useState<BaccaratState | null>(null)
  const [revealed, setRevealed] = useState(0)
  const [lastBetTotal, setLastBetTotal] = useState(0)
  const [pending, setPending] = useState<GamePendingResult | null>(null)
  const [history, setHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const betting = round.stage === 'betting' && !dealing
  const settled = round.stage === 'settled' && !dealing
  const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: betting || (settled && pending != null) })
  const totalBet = Object.values(bets).reduce((sum, amount) => sum + (amount ?? 0), 0)
  const lastTotal = Object.values(lastBets).reduce((sum, amount) => sum + (amount ?? 0), 0)
  const canDeal = totalBet >= minBet && totalBet <= bankroll

  useEffect(() => {
    if (!betting || mode !== 'survival' || !perk.baccaratPeek) { setPeekCard(null); return }
    if (shoePeek.rollForBet()) setPeekCard(peekPlayerCard())
    else setPeekCard(null)
  // one shoe peek is drawn when each betting phase opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betting, mode, perk.baccaratPeek])

  function place(target: BaccaratSpot) {
    if (!betting) return
    if (mode === 'ladder') { setBets({ [target]: bankroll }); setPlaced([{ target, amount: bankroll }]); return }
    const cap = ticketChip ? ticketChip.value : bankroll
    const amount = fraction && !ticketChip ? stakeForFraction(fraction, bankroll, cap - totalBet, minBet) : selectedChip
    if (amount <= 0 || totalBet + amount > cap) return
    setBets(prev => ({ ...prev, [target]: (prev[target] ?? 0) + amount }))
    setPlaced(prev => [...prev, { target, amount }])
  }
  function undo() {
    const last = placed[placed.length - 1]
    if (!last) return
    setPlaced(placed.slice(0, -1))
    setBets(prev => { const next = { ...prev }, rest = (next[last.target] ?? 0) - last.amount; if (rest > 0) next[last.target] = rest; else delete next[last.target]; return next })
  }
  function clear() { setBets({}); setPlaced([]) }
  function finish(result: BaccaratState, betMap: BaccaratBets) {
    setRound(result); setDealing(false); setPendingDeal(null); setRevealed(0)
    const outcome = result.outcome ?? 'loss'
    const resolved = resolveGame(onResolve, { outcome, betAmount: result.totalBetAmount, payout: result.totalPayout, multiplier: result.totalBetAmount ? result.totalPayout / result.totalBetAmount : 0 })
    const winner = result.winner === 'tie' ? 'Tie' : result.winner === 'player' ? 'Player' : 'Banker'
    const built = buildPendingResult({ outcome, betAmount: result.totalBetAmount, payout: resolved.payout }, { result: `${winner} ${result.playerTotal}–${result.bankerTotal}` }, { historySubtitle: `${formatBetSummary(result.totalBetAmount, Object.keys(betMap).map(k => LABELS[k as BaccaratSpot]).join(', '))} → ${winner} ${result.playerTotal}–${result.bankerTotal}`, freeBet: resolved.firstBetWasFree })
    setPending(built)
  }
  function deal() {
    if (!canDeal || !lock()) return
    const betMap = bets, amount = totalBet
    onBet?.(amount); setLastBetTotal(amount); setLastBets(betMap); setBets({}); setPlaced([]); setPending(null); setQuoteIdx(pickQuote(quoteIdx))
    const preRoll = peekCard
    const result = blessed ? winGame(betMap) : cursed ? loseGame(betMap) : dealBaccarat(betMap, preRoll ?? undefined)
    if (preRoll && !blessed && !cursed) setPeekCard(null)
    setPendingDeal(result); setRevealed(1); setDealing(true)
    let i = 1
    const revealNext = () => {
      if (i < result.deal.length) {
        const delay = i < 4 ? ROLL_MS : 500
        timer.current = setTimeout(() => { i++; setRevealed(i); revealNext() }, delay)
      } else {
        timer.current = setTimeout(() => finish(result, betMap), 400)
      }
    }
    if (result.deal.length > 1) { timer.current = setTimeout(() => { i++; setRevealed(i); revealNext() }, ROLL_MS) }
    else timer.current = setTimeout(() => finish(result, betMap), 400)
  }
  function nextRound() {
    unlock(); if (pending) setHistory(h => [pending.entry, ...h].slice(0, 80)); setPending(null)
    if (!survivalAfterNext(mode)) return
    shoePeek.resetPerk()
    setRound({ stage: 'betting', player: [], banker: [], playerTotal: 0, bankerTotal: 0, winner: null, deal: [], totalBetAmount: 0, totalPayout: 0, outcome: null, message: 'Place your bets.' })
    if (autoReBet && lastBetTotal > 0 && bankroll > 0) {
      if (mode === 'ladder') {
        const target = Object.keys(lastBets)[0] as BaccaratSpot | undefined
        if (target) { setBets({ [target]: bankroll }); setPlaced([{ target, amount: bankroll }]) }
      } else if (lastBetTotal <= bankroll) {
        setBets(lastBets); setPlaced(Object.entries(lastBets).map(([target, amount]) => ({ target: target as BaccaratSpot, amount: amount! })))
      }
    }
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const visible = pendingDeal ? pendingDeal.deal.slice(0, revealed) : []
  const player = visible.filter(d => d.hand === 'player').map(d => d.card)
  const banker = visible.filter(d => d.hand === 'banker').map(d => d.card)
  const cellFor = (target: string) => ({ gridColumn: String(SPOTS.indexOf(target as BaccaratSpot) + 1), gridRow: '1' })
  const gridStyle = { gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gridTemplateRows: '1fr' }
  const winning = (winner: BaccaratState['winner'], target: string) => target === 'player-pair' ? round.player[0]?.rank === round.player[1]?.rank : target === 'banker-pair' ? round.banker[0]?.rank === round.banker[1]?.rank : winner === target || (winner === 'tie' && (target === 'player' || target === 'banker'))

  return <div className={GAME_CARD_SHELL}>
    <div className={GAME_STATUS_BAR}><span className="text-[13px] font-semibold text-ink">Baccarat</span>{shoePeek.perkEffective && peekCard && <PerkHint>Shoe Peek — Player’s first card is shown</PerkHint>}<span className="text-[13px] text-dim">{round.message}</span></div>
    <GameFieldWithHistory className={GAME_BOARD_ARENA} boardClassName="relative" entries={history} gameLabel="Baccarat">
      <div className="bac-board relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 px-3 py-3">
        <GameDockBackButton mode={mode} visible={betting && !showGameOver}/><GameActiveBetBadge betAmount={!betting ? (round.totalBetAmount || lastBetTotal) : 0} visible={!betting}/>
        <div className="bac-hands flex w-full max-w-2xl items-center justify-around gap-3">
          {(['player','banker'] as const).map(hand => {
            const cards = hand === 'player' ? player : banker
            const total = cards.length ? cards.reduce((s,c) => s + (['10','J','Q','K'].includes(c.rank) ? 0 : c.rank === 'A' ? 1 : Number(c.rank)), 0) % 10 : hand === 'player' && peekCard ? (peekCard.rank === 'A' ? 1 : ['10','J','Q','K'].includes(peekCard.rank) ? 0 : Number(peekCard.rank)) : null
            const handWinner = round.winner === 'tie' || round.winner === hand
            return <div key={hand} className={`bac-hand flex flex-col items-center gap-1 ${settled && handWinner ? 'g-win' : settled ? 'g-dim' : ''}`}>
              <div className="felt-print flex items-center gap-2">{hand === 'player' ? 'Player' : 'Banker'}{total != null && <span className="plaque num px-2 py-0.5 text-ink">{total}</span>}</div>
              <div className="bac-card-row flex items-center justify-center gap-1">{Array.from({ length: 3 }, (_, i) => {
                const card = cards[i] ?? (hand === 'player' && i === 0 && !dealing ? peekCard : null)
                return card ? <PlayingCard key={`${card.rank}${card.suit}-${i}`} rank={card.rank} suit={card.suit} className={i >= 2 ? 'bac-third g-flip' : 'g-flip'}/> : <PlayingCard key={`slot-${hand}-${i}`} variant="slot" className="invisible" />
              })}</div>
            </div>
          })}
        </div>
        <div className="bac-mat relative grid w-full max-w-4xl gap-1 rounded-xl border border-gold bg-ground p-1" style={gridStyle as CSSProperties}>
          {SPOTS.map(spot => <button key={spot} onClick={() => place(spot)} disabled={!betting} className={`relative flex min-h-14 flex-col items-center justify-center rounded-lg border border-line bg-felt px-1 py-1 text-center ${spot === 'tie' ? 'text-gold' : 'text-ink'} disabled:cursor-default`}><span className="felt-print">{LABELS[spot]}</span><span className="text-[10px] text-soft">{PAYS[spot]}</span></button>)}
          <TableChipLayer bets={betting ? bets as Record<string,number> : lastBets as Record<string,number>} chips={chips} result={settled ? round.winner : null} cellFor={cellFor} isWinning={winning} gridTemplateColumns="repeat(5, minmax(0, 1fr))" gridTemplateRows="1fr" />
        </div>
        <p className="felt-print">Player / Banker pay 1 to 1 · Tie 8 to 1</p>
      </div>
    </GameFieldWithHistory>
    <div className={GAME_CONTROL_DOCK_M}><div className={GAME_DOCK_INNER}>
      {betting ? <GameDockChipPicker chips={chips} selected={selectedChip} onSelect={v => { setChipValue(v); setFraction(null) }} remaining={(ticketChip ? ticketChip.value : bankroll) - totalBet} fraction={ticketChip ? null : fraction} onSelectFraction={ticketChip ? undefined : f => setFraction(f)}><button type="button" onClick={undo} disabled={!placed.length} className={GAME_DOCK_SECONDARY_BTN}>Undo</button></GameDockChipPicker> : <GameDockChipRow visible={dealing} bankroll={bankroll} currentBet={0} onAddChip={() => {}} quoteIdx={quoteIdx} showQuote={dealing} minBet={minBet}/>}
      <div className={GAME_DOCK_SETTLED_SLOT}>{betting && <GameDockBetRow currentBet={totalBet} onClear={clear}/>}{dealing && <p className="text-sm text-soft">Cards are being dealt…</p>}{settled && pending && <GameDockSettledRow betSummary={pending.betSummary} resultSummary={pending.resultSummary} profitLabel={pending.profitLabel} tone={pending.tone}/>}</div>
      <div className={GAME_DOCK_ACTIONS}>{showGameOver ? <GameDockGameOverButton onClick={handleGameOver}/> : betting ? <button onClick={deal} disabled={!canDeal} className={GAME_DOCK_PRIMARY_BTN}>Deal →</button> : settled ? <GameDockSettledActions mode={mode} showGameOver={showGameOver} onGameOver={handleGameOver} onNext={nextRound}/> : <span className="invisible">Deal →</span>}</div>
    </div></div>
  </div>
}
