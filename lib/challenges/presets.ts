import type { ChallengeDef } from './types'

/**
 * The 20 house challenges. Hand-picked, so every player gets the same set: each
 * has a theme, 2–6 games and 1–6 bets per game, and starts from 1,000
 * (CHALLENGE_START_BANKROLL). Ids are stable — stats are keyed by them, so never
 * renumber or reuse one; add new challenges at the end.
 */
export const PRESET_CHALLENGES: ChallengeDef[] = [
  {
    id: 'card-sharp',
    name: 'Card Sharp',
    theme: 'Cards',
    description: 'Only the felt and the deck. Read the dealer, count nothing, trust your gut.',
    minBet: 10,
    games: [
      { game: 'blackjack', bets: 4 },
      { game: 'baccarat', bets: 3 },
      { game: 'hilo', bets: 3 },
    ],
  },
  {
    id: 'dice-den',
    name: 'Dice Den',
    theme: 'Dice',
    description: 'Three kinds of dice, a handful of throws each.',
    minBet: 10,
    games: [
      { game: 'sic-bo', bets: 3 },
      { game: 'run-dice', bets: 3 },
      { game: 'over-under', bets: 3 },
    ],
  },
  {
    id: 'coin-toss',
    name: 'Heads or Tails',
    theme: 'Quick',
    description: 'Two games, two bets. Over before you know it.',
    minBet: 25,
    games: [
      { game: 'coin-flip', bets: 1 },
      { game: 'dragon-tiger', bets: 1 },
    ],
  },
  {
    id: 'farmyard',
    name: 'Farmyard',
    theme: 'Chickens',
    description: 'Cross the road, back the right bird, and keep your feathers.',
    minBet: 10,
    games: [
      { game: 'chicken-road', bets: 4 },
      { game: 'chicken-race', bets: 4 },
    ],
  },
  {
    id: 'minefield',
    name: 'Minefield',
    theme: 'Risky',
    description: 'Every step could be the last one. Pick your tiles and know when to stop.',
    minBet: 20,
    games: [
      { game: 'mines', bets: 5 },
      { game: 'dragon-tower', bets: 3 },
    ],
  },
  {
    id: 'liftoff',
    name: 'Liftoff',
    theme: 'Risky',
    description: 'Ride the rocket, then drop the ball. Big multipliers, short fuses.',
    minBet: 10,
    games: [
      { game: 'crash', bets: 5 },
      { game: 'plinko', bets: 3 },
    ],
  },
  {
    id: 'spin-cycle',
    name: 'Spin Cycle',
    theme: 'Spinners',
    description: 'Everything that spins: wheel, reels and the ball on the rim.',
    minBet: 10,
    games: [
      { game: 'wheel', bets: 3 },
      { game: 'slots', bets: 4 },
      { game: 'roulette', bets: 3 },
    ],
  },
  {
    id: 'high-roller',
    name: 'High Roller',
    theme: 'Big bets',
    description: 'One bet per game and a 100 minimum. Ten games of nerve in six bets.',
    minBet: 100,
    games: [
      { game: 'roulette', bets: 1 },
      { game: 'blackjack', bets: 1 },
      { game: 'baccarat', bets: 1 },
      { game: 'crash', bets: 1 },
      { game: 'wheel', bets: 1 },
      { game: 'dragon-tiger', bets: 1 },
    ],
  },
  {
    id: 'grind',
    name: 'The Grind',
    theme: 'Marathon',
    description: 'Six games, six bets each. Thirty-six chances to build or bleed.',
    minBet: 5,
    games: [
      { game: 'blackjack', bets: 6 },
      { game: 'hilo', bets: 6 },
      { game: 'mines', bets: 6 },
      { game: 'keno', bets: 6 },
      { game: 'over-under', bets: 6 },
      { game: 'coin-flip', bets: 6 },
    ],
  },
  {
    id: 'street-hustle',
    name: 'Street Hustle',
    theme: 'Street',
    description: 'Follow the cup, open the case, call the side.',
    minBet: 10,
    games: [
      { game: 'street-cups', bets: 4 },
      { game: 'case-battles', bets: 3 },
      { game: 'andar-bahar', bets: 3 },
    ],
  },
  {
    id: 'lucky-numbers',
    name: 'Lucky Numbers',
    theme: 'Numbers',
    description: 'Pick your numbers on the board, the wheel and the dice.',
    minBet: 10,
    games: [
      { game: 'keno', bets: 4 },
      { game: 'roulette', bets: 3 },
      { game: 'sic-bo', bets: 3 },
    ],
  },
  {
    id: 'east-meets-west',
    name: 'East Meets West',
    theme: 'Classics',
    description: 'Asian table classics against a Western favourite.',
    minBet: 20,
    games: [
      { game: 'dragon-tiger', bets: 3 },
      { game: 'andar-bahar', bets: 3 },
      { game: 'sic-bo', bets: 2 },
      { game: 'blackjack', bets: 2 },
    ],
  },
  {
    id: 'climber',
    name: 'Climber',
    theme: 'Towers',
    description: 'Up the tower, up the cards. Every floor pays more and risks it all.',
    minBet: 10,
    games: [
      { game: 'dragon-tower', bets: 4 },
      { game: 'tower-of-cards', bets: 4 },
      { game: 'chicken-road', bets: 2 },
    ],
  },
  {
    id: 'poker-face',
    name: 'Poker Face',
    theme: 'Cards',
    description: 'Draw your hand, count down the deck, and keep your face straight.',
    minBet: 10,
    games: [
      { game: 'poker-1p', bets: 4 },
      { game: 'deck-countdown', bets: 3 },
      { game: 'hilo', bets: 2 },
    ],
  },
  {
    id: 'one-shot',
    name: 'One Shot',
    theme: 'Quick',
    description: 'Three games, one bet each. Size every stake like it matters.',
    minBet: 50,
    games: [
      { game: 'plinko', bets: 1 },
      { game: 'mines', bets: 1 },
      { game: 'slots', bets: 1 },
    ],
  },
  {
    id: 'arcade',
    name: 'Arcade',
    theme: 'Fun',
    description: 'Bright lights and bouncing balls. Pure arcade luck.',
    minBet: 10,
    games: [
      { game: 'plinko', bets: 4 },
      { game: 'slots', bets: 4 },
      { game: 'wheel', bets: 2 },
      { game: 'keno', bets: 2 },
    ],
  },
  {
    id: 'safe-hands',
    name: 'Safe Hands',
    theme: 'Low risk',
    description: 'Close-to-even games with a high minimum. Steady wins it — or does it?',
    minBet: 50,
    games: [
      { game: 'coin-flip', bets: 3 },
      { game: 'baccarat', bets: 3 },
      { game: 'over-under', bets: 3 },
    ],
  },
  {
    id: 'house-tour',
    name: 'House Tour',
    theme: 'Variety',
    description: 'A walk through the whole floor: six different games, two bets each.',
    minBet: 10,
    games: [
      { game: 'crash', bets: 2 },
      { game: 'tower-of-cards', bets: 2 },
      { game: 'street-cups', bets: 2 },
      { game: 'chicken-race', bets: 2 },
      { game: 'deck-countdown', bets: 2 },
      { game: 'case-battles', bets: 2 },
    ],
  },
  {
    id: 'double-down',
    name: 'Double Down',
    theme: 'Cards',
    description: 'Blackjack on its own, six hands, and a dragon to finish.',
    minBet: 20,
    games: [
      { game: 'blackjack', bets: 6 },
      { game: 'dragon-tiger', bets: 2 },
    ],
  },
  {
    id: 'all-or-nothing',
    name: 'All or Nothing',
    theme: 'Risky',
    description: 'The wildest swings in the house. Bust early or leave a legend.',
    minBet: 25,
    games: [
      { game: 'crash', bets: 2 },
      { game: 'mines', bets: 2 },
      { game: 'dragon-tower', bets: 2 },
      { game: 'plinko', bets: 2 },
      { game: 'case-battles', bets: 2 },
    ],
  },
]

export const PRESET_BY_ID = new Map(PRESET_CHALLENGES.map((c) => [c.id, c]))
