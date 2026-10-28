'use client'
import type { GameMode } from '@/store/types'

import { CardFace, CardBack } from './card'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import {
  GAME_DOCK_SETTLED_SLOT,
  GAME_DOCK_INNER,
  GAME_DOCK_ACTIONS,
  GameCurrentBetBadge,
  GameDockBackButton,
  GameDockBetRow,
  GameDockChipRow,
  GameDockSettledActions,
  GameDockGameOverButton,
  GameDockSettledRow,
} from '@/components/game-dock-parts'
import { GameFieldWithHistory } from '@/components/game-match-history'
import { PerkHint } from '@/components/survival/perk-hint'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { GAME_DOCK_PRIMARY_BTN, GAME_DOCK_SECONDARY_BTN } from '@/components/game-dock-parts'
import { type BlackjackResult, useBlackjackGame } from '@/hooks/use-blackjack-game'

const CARD_CSS: React.CSSProperties = {
  '--card-h': 'clamp(4.25rem, 14vh, 8.5rem)',
} as React.CSSProperties

/** A hand's label with its total as a mono pill; the pill lights up on 21. */
function HandLabel({ who, total }: { who: string; total: number | null }) {
  return (
    <p className="mb-2 flex items-center justify-center gap-2 text-[13px] text-soft">
      {who}
      {total != null && (
        <span
          className={`num rounded-full px-2 py-0.5 text-[13px] ${
            total === 21 ? 'bg-felt-tint text-felt glow-felt' : total > 21 ? 'bg-loss-tint text-loss' : 'bg-black/45 text-ink'
          }`}
        >
          {total}
        </span>
      )}
    </p>
  )
}

interface BlackjackGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<BlackjackResult>
}

export function BlackjackGame({ mode, bankroll, onBet, onResolve }: BlackjackGameProps) {
  const {
    round,
    currentBet,
    quoteIdx,
    pendingResult,
    matchHistory,
    playerVisibleLen,
    dealerVisibleLen,
    isBetting,
    isInProgress,
    playerCanAct,
    showGameOver,
    handleGameOver,
    showDealerHole,
    peekDealerLevel,
    bettingPreview,
    displayedDealerHand,
    canDouble,
    canDeal,
    minBet,
    calculateHandValue,
    addChip,
    handleDeal,
    handleHit,
    handleStand,
    handleDouble,
    handleNextHand,
  } = useBlackjackGame({ mode, bankroll, onBet, onResolve })

  return (
    <div className={GAME_CARD_SHELL} style={CARD_CSS}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-[13px] font-semibold text-ink">Blackjack</span>
        <span className="text-[13px] text-dim">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 md:px-8 py-4"
        entries={matchHistory}
        gameLabel="Blackjack"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {showDealerHole && (isInProgress || (isBetting && peekDealerLevel >= 2 && bettingPreview)) && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">Hole card visible</PerkHint>
        )}
        <GameCurrentBetBadge betAmount={round.betAmount} visible={!isBetting && round.betAmount > 0} />

        <div className="flex w-full max-w-lg flex-1 min-h-0 flex-col items-center justify-center gap-2">
          {/* Dealer zone */}
          <div className="flex min-h-[calc(var(--card-h)+2rem)] flex-col items-center justify-end">
            <HandLabel
              who="Dealer"
              total={
                !isBetting && !isInProgress && dealerVisibleLen > 0
                  ? calculateHandValue(displayedDealerHand.slice(0, dealerVisibleLen))
                  : null
              }
            />
            <div className="flex gap-2.5 flex-wrap items-end justify-center">
              {displayedDealerHand.length === 0 ? (
                <><CardBack /><CardBack /></>
              ) : (
                displayedDealerHand.map((card, i) => (
                  <CardFace
                    key={`d-${i}`}
                    card={card}
                    hidden={
                      i === 1 &&
                      !showDealerHole &&
                      (isInProgress || (isBetting && peekDealerLevel < 2))
                    }
                    animDelay={i * 100}
                  />
                ))
              )}
            </div>
          </div>

          {/* The table print: payouts on an arc, the house rules beneath it */}
          <div className="relative w-full max-w-md shrink-0 select-none" aria-label="Blackjack pays 3 to 2. Dealer hits 16 and below.">
            <svg viewBox="0 0 400 54" className="w-full" aria-hidden>
              <defs>
                <path id="bj-arc" d="M 24 44 Q 200 -6 376 44" />
              </defs>
              <path d="M 14 50 Q 200 -2 386 50" fill="none" stroke="rgba(217,164,65,0.28)" strokeWidth="1" />
              <text className="felt-print" fill="currentColor" textAnchor="middle" style={{ fontSize: 12.5 }}>
                <textPath href="#bj-arc" startOffset="50%">
                  Blackjack pays 3 to 2 · Win pays 1 to 1
                </textPath>
              </text>
            </svg>
            <p className="felt-print -mt-1 text-center text-[9.5px] opacity-80">
              Dealer hits 16 and below · Double on two cards · No split
            </p>
          </div>

          {/* Player zone */}
          <div className="flex min-h-[calc(var(--card-h)+2rem)] flex-col items-center justify-start">
            <HandLabel
              who="You"
              total={playerVisibleLen > 0 ? calculateHandValue(round.playerHand.slice(0, playerVisibleLen)) : null}
            />
            <div className="flex gap-2.5 flex-wrap items-end justify-center">
              {round.playerHand.length === 0 ? (
                <><CardBack /><CardBack /></>
              ) : (
                round.playerHand.map((card, i) => (
                  <CardFace key={`p-${i}`} card={card} animDelay={i * 100} />
                ))
              )}
            </div>
          </div>

          <div className="min-h-10 flex w-full shrink-0 items-center justify-center">
            <p className="max-w-md px-2 text-center text-[13px] text-dim">
              {isBetting
                ? 'Place chips and deal. Blackjack pays 3:2; push returns your bet.'
                : playerCanAct
                  ? 'Hit, stand, or double on two cards. Dealer hits on 16 and below.'
                  : ' '}
            </p>
          </div>
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          <GameDockChipRow
            visible={isBetting || playerCanAct}
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={playerCanAct}
            minBet={minBet}
          />

          <div className={GAME_DOCK_SETTLED_SLOT}>
            {isBetting && <GameDockBetRow currentBet={currentBet} onClear={() => addChip(-currentBet)} />}
            {round.stage === 'settled' && pendingResult && (
              <GameDockSettledRow
                betSummary={pendingResult.betSummary}
                resultSummary={pendingResult.resultSummary}
                profitLabel={pendingResult.profitLabel}
                tone={pendingResult.tone}
              />
            )}
            {!isBetting && !(round.stage === 'settled' && pendingResult) && (
              <p className="text-sm invisible select-none">{' '}</p>
            )}
          </div>

          <div className={`${GAME_DOCK_ACTIONS} min-h-[2.75rem] justify-center`}>
            {isBetting && (
              showGameOver ? (
                <GameDockGameOverButton onClick={handleGameOver} />
              ) : (
                <button type="button" onClick={handleDeal} disabled={!canDeal} className={GAME_DOCK_PRIMARY_BTN}>
                  Deal →
                </button>
              )
            )}
            {!isBetting && playerCanAct && (
              <div className="flex flex-wrap justify-center gap-2.5">
                <button type="button" onClick={handleHit} className={`${GAME_DOCK_PRIMARY_BTN} min-w-[6rem]`}>Hit</button>
                <button type="button" onClick={handleStand} className={GAME_DOCK_SECONDARY_BTN}>Stand</button>
                <button type="button" onClick={handleDouble} disabled={!canDouble} className={GAME_DOCK_SECONDARY_BTN}>
                  Double <span className="num ml-1 text-gold">×2</span>
                </button>
              </div>
            )}
            {round.stage === 'settled' && pendingResult && (
              <GameDockSettledActions
                mode={mode}
                showGameOver={showGameOver}
                onGameOver={handleGameOver}
                onNext={handleNextHand}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
