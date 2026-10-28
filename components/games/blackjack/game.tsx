'use client'
import type { GameMode } from '@/store/types'

import { CardFace, CardBack } from './card'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import {
  GAME_DOCK_PRIMARY_BTN,
  GAME_DOCK_SECONDARY_BTN,
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
import { BOARD_HINT, BOARD_LABEL } from '@/components/game-board-ui'
import { GameFieldWithHistory } from '@/components/game-match-history'
import { PerkHint } from '@/components/survival/perk-hint'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { type BlackjackResult, useBlackjackGame } from '@/hooks/use-blackjack-game'

const CARD_CSS: React.CSSProperties = {
  '--card-h': 'clamp(4rem, 13vh, 9rem)',
} as React.CSSProperties

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
            <p className={`${BOARD_LABEL} mb-2`}>
              Dealer
              {!isBetting && !isInProgress && dealerVisibleLen > 0 && (
                <span className="num ml-2 text-[13px] text-ink">
                  {calculateHandValue(displayedDealerHand.slice(0, dealerVisibleLen))}
                </span>
              )}
            </p>
            <div className="flex gap-3 flex-wrap items-end justify-center">
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

          {/* Divider with inline rules */}
          <div className="shrink-0 my-0.5">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 pb-1 text-xs text-dim">
              <span>Blackjack 3:2</span>
              <span className="text-control">·</span>
              <span>Win 1:1</span>
              <span className="text-control">·</span>
              <span>Push returned</span>
            </div>
            <div className="border-t border-white/10" />
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 pt-1 text-xs text-dim">
              <span>Dealer hits ≤ 16</span>
              <span className="text-control">·</span>
              <span>Double on 2 cards</span>
              <span className="text-control">·</span>
              <span>No split</span>
              <span className="text-control">·</span>
              <span>No surrender</span>
            </div>
          </div>

          {/* Player zone */}
          <div className="flex min-h-[calc(var(--card-h)+2rem)] flex-col items-center justify-start">
            <p className={`${BOARD_LABEL} mb-2`}>
              You
              {playerVisibleLen > 0 && (
                <span className="num ml-2 text-[13px] text-ink">
                  {calculateHandValue(round.playerHand.slice(0, playerVisibleLen))}
                </span>
              )}
            </p>
            <div className="flex gap-3 flex-wrap items-end justify-center">
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
            <p className={BOARD_HINT}>
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
                <button
                  type="button"
                  onClick={handleDeal}
                  disabled={!canDeal}
                  className={GAME_DOCK_PRIMARY_BTN}
                >
                  Deal →
                </button>
              )
            )}
            {!isBetting && playerCanAct && (
              <div className="flex flex-wrap justify-center gap-2.5">
                <button type="button" onClick={handleHit} className={`${GAME_DOCK_PRIMARY_BTN} !min-w-[5.25rem]`}>Hit</button>
                <button type="button" onClick={handleStand} className={GAME_DOCK_SECONDARY_BTN}>Stand</button>
                <button type="button" onClick={handleDouble} disabled={!canDouble} className={GAME_DOCK_SECONDARY_BTN}>Double</button>
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
