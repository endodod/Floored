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
import { dealAndarBahar, initAndarBahar, loseGame, winGame } from '@/games/andar-bahar/engine'
import type { AndarBaharSide, AndarBaharState } from '@/games/andar-bahar/types'

/** Deal pacing: joker, first card, each later card, then the result. */
const JOKER_REVEAL_MS = 400
const FIRST_CARD_MS = 650
const CARD_INTERVAL_MS = 520
const SETTLE_MS = 650

export function AndarBaharGame({ mode, bankroll, onBet, onResolve }: { mode: GameMode; bankroll: number; onBet?: (amount: number) => void; onResolve: GameResolveFn }) {
  const minBet = useGameMinBet(mode)
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const perk = useSurvivalPerks('andar-bahar')
  const sideCount = usePerkProc(perk.andarBaharCount, 'perk_andar_bahar_count', perk.andarBaharCountLevel)
  const rollSideCount = sideCount.rollForBet
  const { autoReBet } = useSettingsStore()
  const [round, setRound] = useState<AndarBaharState>(initAndarBahar)
  const [bets, setBets] = useState<Partial<Record<AndarBaharSide, number>>>({})
  const [placed, setPlaced] = useState<{ target: AndarBaharSide; amount: number }[]>([])
  const [lastBets, setLastBets] = useState<Partial<Record<AndarBaharSide, number>>>({})
  const [chipValue, setChipValue] = useState(0)
  const [fraction, setFraction] = useState<StakeFraction | null>(null)
  const [lastBet, setLastBet] = useState(0)
  const [lastSide, setLastSide] = useState<AndarBaharSide | null>(null)
  const [pending, setPending] = useState<GamePendingResult | null>(null)
  const [history, setHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  const [revealed, setRevealed] = useState(0)
  const [jokerRevealed, setJokerRevealed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ticketChip = useOpeningTicketChip(minBet)
  const chips = useMemo(() => ticketChip ? [ticketChip] : dockChips(minBet), [ticketChip, minBet])
  const selectedChip = chips.find((chip) => chip.value === chipValue)?.value ?? chips[0]!.value
  const totalBet = Object.values(bets).reduce((sum, amount) => sum + (amount ?? 0), 0)
  const betting = round.stage === 'betting'
  const settled = round.stage === 'settled'
  const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: betting || (settled && pending != null) })
  useLadderAllIn(mode, bankroll, totalBet, (value) => setBets(value > 0 ? { andar: value } : {}))
  const canDeal = totalBet >= minBet && totalBet <= bankroll
  useEffect(() => {
    if (betting && mode === 'survival') rollSideCount()
  }, [betting, mode, rollSideCount])

  function settle(next: AndarBaharState) {
    setRound(next)
    const outcome = next.outcome ?? 'loss'
    const resolved = resolveGame(onResolve, { outcome, betAmount: next.betAmount, payout: next.payout, multiplier: next.payout / Math.max(1, next.betAmount) })
    setPending(buildPendingResult({ outcome, betAmount: next.betAmount, payout: resolved.payout }, { betSpecification: next.betSide === 'andar' ? 'Andar' : 'Bahar', result: next.winner === 'andar' ? 'Andar' : 'Bahar', resultSpecification: next.joker?.rank ? `Joker ${next.joker.rank}` : undefined }, { gameMultiplier: next.payout / Math.max(1, next.betAmount), freeBet: resolved.firstBetWasFree }))
  }
  function placeChip(target: AndarBaharSide) {
    if (!betting) return
    if (mode === 'ladder') {
      setBets({ [target]: bankroll }); setPlaced([{ target, amount: bankroll }]); return
    }
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
    if (!canDeal || !lock()) return
    const betMap = bets
    const betSide = (Object.keys(betMap)[0] ?? 'andar') as AndarBaharSide
    onBet?.(totalBet); setLastBet(totalBet); setLastSide(betSide); setLastBets(betMap); setBets({}); setPlaced([]); setPending(null); setQuoteIdx(pickQuote(quoteIdx))
    const result = mode !== 'daily' && mode !== 'ladder' && sideCount.perkEffective
      ? blessed ? winGame(betMap) : loseGame(betMap)
      : blessed ? winGame(betMap) : cursed ? loseGame(betMap) : dealAndarBahar(betMap)
    setRound({ ...result, stage: 'dealing', andar: [], bahar: [], matchCard: null })
    setJokerRevealed(false)
    setRevealed(0)
    let index = 0
    const revealNext = () => {
      index += 1
      setRevealed(index)
      if (index < result.deal.length) timer.current = setTimeout(revealNext, CARD_INTERVAL_MS)
      else timer.current = setTimeout(() => settle(result), SETTLE_MS)
    }
    timer.current = setTimeout(() => {
      setJokerRevealed(true)
      timer.current = setTimeout(revealNext, FIRST_CARD_MS)
    }, JOKER_REVEAL_MS)
  }
  function nextRound() {
    unlock(); if (pending) setHistory((h) => [pending.entry, ...h].slice(0, 80)); setPending(null)
    if (!survivalAfterNext(mode)) return
    sideCount.resetPerk(); setRound(initAndarBahar())
    if (autoReBet && lastBet >= minBet && lastBet <= bankroll && lastSide) { setBets({ [lastSide]: lastBet }); setPlaced([{ target: lastSide, amount: lastBet }]) }
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const shownDeal = round.deal.slice(0, revealed)
  const shownPiles = {
    andar: shownDeal.filter((item) => item.side === 'andar').map((item) => item.card),
    bahar: shownDeal.filter((item) => item.side === 'bahar').map((item) => item.card),
  }
  const shownJoker = jokerRevealed && round.joker ? round.joker : null
  const matCols = 'repeat(2, minmax(0, 1fr))'
  const cellFor = (target: string) => ({ gridColumn: target === 'andar' ? '1' : '2', gridRow: '1' })
  const winning = (winner: AndarBaharSide, target: string) => winner === target
  return <div className={GAME_CARD_SHELL}>
    <div className={GAME_STATUS_BAR}><span className="text-[13px] font-semibold text-ink">Andar Bahar</span>{sideCount.perkEffective && <PerkHint>Side Count — your chosen pile is favoured</PerkHint>}<span className="text-[13px] text-dim">{round.message}</span></div>
    <GameFieldWithHistory className={GAME_BOARD_ARENA} boardClassName="relative" entries={history} gameLabel="Andar Bahar">
      <div className="ab-board relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-4 px-3 py-3">
        <GameDockBackButton mode={mode} visible={betting && !showGameOver}/><GameActiveBetBadge betAmount={!betting ? round.betAmount : 0} visible={!betting}/>
        <div className="ab-joker flex flex-col items-center gap-1"><span className="felt-print">Joker</span>{shownJoker ? <PlayingCard rank={shownJoker.rank} suit={shownJoker.suit} className="g-flip"/> : <PlayingCard variant="slot"/>}</div>
        <div className={`ab-mat ${!betting ? 'pointer-events-none' : ''}`}>
          <div className="relative">
            <div className="grid gap-px rounded-sm bg-[rgba(217,164,65,0.4)] p-px shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)]" style={{ gridTemplateColumns: matCols }}>
              {(['andar', 'bahar'] as const).map((pile) => {
                const cards = shownPiles[pile]
                const latest = cards[cards.length - 1] ?? null
                const earlier = cards.slice(0, -1)
                return (
                  <button key={pile} type="button" disabled={!betting} onClick={() => placeChip(pile)} aria-pressed={(bets[pile] ?? 0) > 0} className={`ab-seat relative flex flex-col items-center justify-start bg-[#163021] px-2 py-2 text-center text-[12px] font-semibold text-[#f4f1ea] transition-[filter,box-shadow,opacity] duration-150 select-none ${betting ? 'cursor-pointer hover:brightness-125' : 'cursor-default'} ${round.winner === pile ? 'g-win' : settled ? 'g-dim' : ''}`}>
                    <span className="felt-print text-base">{pile === 'andar' ? 'Andar' : 'Bahar'}</span>
                    <span className="text-[11px] font-normal text-soft">{pile === 'andar' ? 'Left pile' : 'Right pile'}</span>
                    <div className="ab-pile relative w-full overflow-hidden">
                      {earlier.map((card, i) => (
                        <PlayingCard key={`${card.rank}-${card.suit}-${i}`} rank={card.rank} suit={card.suit} className="ab-pile-card absolute top-0 g-flip" style={pileCardStyle(i, earlier.length)} />
                      ))}
                    </div>
                    <div className="ab-latest flex min-h-0 w-full flex-1 items-center justify-center">
                      {latest ? <PlayingCard key={`${latest.rank}-${latest.suit}-${cards.length}`} rank={latest.rank} suit={latest.suit} className="g-flip g-pop" /> : <PlayingCard variant="slot" />}
                    </div>
                  </button>
                )
              })}
            </div>
            <TableChipLayer bets={betting ? bets : lastBets} chips={chips} result={settled ? round.winner : null} cellFor={cellFor} isWinning={winning} gridTemplateColumns={matCols} gridTemplateRows="var(--cell-h)" align="bottom-left" />
          </div>
        </div>
        <p className="ab-note felt-print">Matching rank pays {formatMultiplier(1.95)} · Andar deals first</p>
      </div>
    </GameFieldWithHistory>
    <div className={GAME_CONTROL_DOCK_M}><div className={GAME_DOCK_INNER}>
      {betting && mode !== 'ladder' ? <GameDockChipPicker chips={chips} selected={selectedChip} onSelect={(value) => { setChipValue(value); setFraction(null) }} remaining={(ticketChip ? ticketChip.value : bankroll) - totalBet} fraction={ticketChip ? null : fraction} onSelectFraction={ticketChip ? undefined : setFraction}><button type="button" onClick={undoChip} disabled={!placed.length} className={GAME_DOCK_RACK_BTN}>Undo</button></GameDockChipPicker> : <GameDockChipRow visible={betting} bankroll={bankroll} currentBet={totalBet} onAddChip={(v) => setBets((previous) => ({ ...previous, andar: (previous.andar ?? 0) + v }))} quoteIdx={quoteIdx} minBet={minBet}/>}
      <div className={GAME_DOCK_SETTLED_SLOT}>{betting && <GameDockBetRow currentBet={totalBet} onClear={clearBet}/>} {!betting && pending && <GameDockSettledRow betSummary={pending.betSummary} resultSummary={pending.resultSummary} profitLabel={pending.profitLabel} tone={pending.tone}/>}</div>
      <div className={GAME_DOCK_ACTIONS}>{showGameOver ? <GameDockGameOverButton onClick={handleGameOver}/> : betting ? <button onClick={deal} disabled={!canDeal} className={GAME_DOCK_PRIMARY_BTN}>Deal →</button> : settled ? <GameDockSettledActions mode={mode} showGameOver={showGameOver} onGameOver={handleGameOver} onNext={nextRound}/> : <span className="invisible">Deal →</span>}</div>
    </div></div>
  </div>
}

/** First five cards fan across the pile; later cards stack on the last slot so they stay in bounds. */
function pileCardStyle(index: number, count: number): CSSProperties {
  const cap = Math.min(count, 5)
  const slot = Math.min(index, 4)
  const left = cap <= 1
    ? 'calc(50% - var(--card-h) * 5 / 14)'
    : `calc(${slot} / ${cap - 1} * (100% - var(--card-h) * 5 / 7))`
  // Inline positioning beats the shared .pcard { position: relative } rule.
  return { position: 'absolute', top: 0, left, zIndex: index + 1 }
}
