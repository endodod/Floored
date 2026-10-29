import type { TutorialStep } from '@/components/mode-tutorial'
import { HOLDEM_BLINDS, HOLDEM_HANDS_PER_LEVEL, HOLDEM_STARTING_STACK } from '@/games/holdem/engine'
import { LIARS_DICE_PER_SEAT } from '@/games/liars-dice/engine'
import { SHOWDOWN_HANDS, SHOWDOWN_MAX_BET, SHOWDOWN_MIN_BET, SHOWDOWN_MIN_BET_MULTIPLIER, SHOWDOWN_STARTING_STACK } from '@/games/blackjack-showdown/engine'
import { formatChips } from '@/utils/format'
import { MIN_BUY_IN, TABLES_START_WALLET, TABLE_TIERS, payoutSplits } from './stakes'
import type { TableGameName } from './types'

/**
 * Rules for the Tables mode and each table game (/tables and
 * /how-to-play/tables/[game]). Figures mirror the engines and lib/tables/stakes.ts.
 */
export interface TableTutorial {
  intro: string
  steps: TutorialStep[]
  notes: string[]
}

const pct = (n: number) => `${Math.round(n * 100)}%`
const split = (seats: number, game: TableGameName = 'holdem') => payoutSplits(seats, game).map(pct).join(' / ')
const [sb0, bb0] = HOLDEM_BLINDS[0]!
const [sb1, bb1] = HOLDEM_BLINDS[1]!
const [sb2, bb2] = HOLDEM_BLINDS[2]!

export const TABLES_STEPS: TutorialStep[] = [
  {
    title: 'Pick a game and stakes',
    body: `Buy in for ${TABLE_TIERS.map((t) => formatChips(t.buyIn)).join(' / ')}. This comes from your Tables wallet and contributes to the prize pool; it is not your bankroll at the table. Choose opponent difficulty separately; your choice is remembered in this browser.`,
  },
  {
    title: 'Buy-ins make the prize pool',
    body: `The buy-in is separate from your playing bankroll. In Hold’em and Blackjack, every player starts with the same tournament bankroll, shown at their seat; in Liar’s Dice, everyone starts with the same number of dice. No house cut. Texas Hold’em pays ${split(6, 'holdem')} / ${split(4, 'holdem')} at six / four seats; Blackjack Showdown and Liar’s Dice are winner-takes-all.`,
  },
  {
    title: 'Play it out',
    body: 'The table runs until it is decided. Once you are out, your place and prize are banked; watch the rest or leave.',
  },
  {
    title: 'Bots play fair',
    body: 'A bot decides only from what a player in its seat could see. Each has its own style: rocks, maniacs, calling stations…',
  },
  {
    title: 'Leaving costs the buy-in',
    body: 'Leave a table before your place is decided and you finish last with no prize.',
  },
  {
    title: 'Your own wallet',
    body: `Tables has its own play money, ${formatChips(TABLES_START_WALLET)} to start. Below ${formatChips(MIN_BUY_IN)} you can refill it.`,
  },
]
export const TABLE_TUTORIALS: Record<TableGameName, TableTutorial> = {
  holdem: {
    intro: "No-limit Texas Hold'em as a Sit & Go: everyone starts even, last one with chips wins.",
    steps: [
      { title: 'Two cards each', body: 'Blinds go in, everyone gets two cards face down. Bet, call or fold before the flop.' },
      { title: 'Flop, turn, river', body: 'Three shared cards, then one, then one more, with a round of betting after each.' },
      { title: 'Showdown', body: 'Best five-card hand from your two cards and the five on the board wins the pot. Equal hands split it.' },
      { title: 'Blinds rise', body: `Blinds start at ${sb0}/${bb0} and go up every ${HOLDEM_HANDS_PER_LEVEL} hands (${sb1}/${bb1}, ${sb2}/${bb2}, …).` },
      { title: 'Last one standing', body: 'Lose all your chips and you are out. The last player with chips wins the table.' },
    ],
    notes: [
      `Everyone starts with ${formatChips(HOLDEM_STARTING_STACK)} tournament chips; they are not your wallet.`,
      'Fold, check, call, or bet / raise with the slider or the presets (Min, ½ pot, Pot, All in). The smallest raise is the size of the last bet or raise.',
      'All in for less than a full raise: the others may call, but players who already acted can’t raise again.',
      'Side pots: an all-in player can only win what they matched from each opponent.',
      'Six seats; on a phone the table seats four.',
      `Prizes: ${split(6, 'holdem')} of the pool at six seats, ${split(4, 'holdem')} at four.`,
      'You have 30 seconds to act; when time runs out you check, or fold if there is a bet.',
    ],
  },
  'liars-dice': {
    intro: 'Bid on the dice hidden under every cup, or call the last bid a lie.',
    steps: [
      { title: 'Roll under the cup', body: `Everyone rolls ${LIARS_DICE_PER_SEAT} dice and sees only their own.` },
      { title: 'Bid', body: 'Say how many dice of one face lie under all the cups, e.g. “four 5s”. Each bid must raise the last one.' },
      { title: 'Or call “Liar!”', body: 'The cups lift. If there are fewer than bid, the bidder loses a die; otherwise the caller does.' },
      { title: 'Last cup standing', body: 'The loser starts the next round. Lose your last die and you are out; the last player with dice wins.' },
    ],
    notes: [
      '1s are wild: they count toward every other face.',
      'A raise is more dice, or the same number of a higher face.',
      'Bidding on 1s: at least half the last count, rounded up. Leaving 1s: at least double the count plus one.',
      'The opening bid can’t be on 1s.',
      'Four seats; winner takes the full prize pool.',
      'You have 30 seconds to act; when time runs out you call “Liar!” (or open with one 2).',
    ],
  },
  'blackjack-showdown': {
    intro: `Tournament blackjack: ${SHOWDOWN_HANDS} hands against one dealer, and the most chips wins.`,
    steps: [
      { title: 'Bet in turn', body: `Minimum bets start at ${SHOWDOWN_MIN_BET} and multiply by ${SHOWDOWN_MIN_BET_MULTIPLIER} each hand, capped at ${SHOWDOWN_MAX_BET}. Bets are placed in seat order, and you see the bets before yours.` },
      { title: 'Play your hand', body: 'Hit, stand or double on two cards against the dealer, as in solo Blackjack. One shoe for the whole table.' },
      { title: 'Watch the standings', body: 'You are racing the other players, not the dealer. The leader wants calm; the chasers need swings.' },
      { title: 'Secret last bet', body: `On hand ${SHOWDOWN_HANDS} everyone bets face down, revealed together when the cards come out.` },
    ],
    notes: [
      `Everyone starts with ${formatChips(SHOWDOWN_STARTING_STACK)} tournament chips.`,
      'Blackjack pays 3:2, a win 1:1. The dealer hits 16 or less and stands on all 17s. Double on two cards; no split.',
      'The first bettor moves one seat round the table each hand.',
      `Drop below ${SHOWDOWN_MIN_BET} chips and you are out.`,
      'Four seats; the winner takes the full prize pool. Equal stacks share the prize.',
      'You have 30 seconds to act; when time runs out you bet the minimum, or stand.',
    ],
  },
}
