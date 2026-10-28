import type { GameName } from '@/store/types'
import type { TutorialStep } from '@/components/mode-tutorial'

/**
 * How to play each game: the page at /how-to-play/[game]. `steps` walk through
 * one round in order; `notes` are the rules worth knowing before the first bet.
 * Figures here mirror the engines in games/* — change both together.
 */
export interface GameTutorial {
  /** One line under the title: the game in a sentence. */
  intro: string
  steps: TutorialStep[]
  notes: string[]
}

export const GAME_TUTORIALS: Record<GameName, GameTutorial> = {
  blackjack: {
    intro: 'Get closer to 21 than the dealer without going over.',
    steps: [
      { title: 'Place your bet', body: 'Add chips, then deal. You and the dealer get two cards; one of the dealer’s stays face down.' },
      { title: 'Hit or stand', body: 'Hit to take another card, stand to keep your total. Go over 21 and you bust.' },
      { title: 'Double down', body: 'On your first two cards you can double your bet, take exactly one more card and stand.' },
      { title: 'Dealer plays', body: 'The dealer reveals the hole card and hits on 16 or less. Higher total without busting wins.' },
    ],
    notes: [
      'A win pays 1:1, a blackjack (ace + ten-value card) pays 3:2.',
      'A tie is a push — your bet comes back.',
      'Face cards count 10, aces count 1 or 11. No split, no surrender.',
    ],
  },
  crash: {
    intro: 'Ride a rising multiplier and cash out before it crashes.',
    steps: [
      { title: 'Place your bet', body: 'Add chips and start. The multiplier begins at 0.75× and climbs.' },
      { title: 'Watch it rise', body: 'The curve accelerates the longer it runs. It can crash at any moment.' },
      { title: 'Cash out', body: 'Press Cash out to lock in your bet × the current multiplier.' },
      { title: 'Or crash', body: 'If the curve crashes before you cash out, the bet is lost.' },
    ],
    notes: [
      'The curve starts below 1× — cashing out very early returns less than your bet.',
      'A round never runs past 30×.',
    ],
  },
  plinko: {
    intro: 'Drop balls through a field of pins and collect what they land on.',
    steps: [
      { title: 'Pick a risk', body: 'Low keeps payouts close to 1×, high swings from 0× in the middle to 100× at the edges.' },
      { title: 'Set your bet', body: 'Your bet is per ball. Choose how many balls to drop with − and +.' },
      { title: 'Drop', body: 'Each ball bounces left or right on every pin across 12 rows.' },
      { title: 'Collect', body: 'Every ball pays its bet × the slot it lands in. Edge slots pay the most.' },
    ],
    notes: [
      'Most balls end near the middle; the edges are rare.',
      'Risk can’t change while balls are in the air.',
    ],
  },
  'over-under': {
    intro: 'Set a safe zone, then roll 1–100 and hope you land inside it.',
    steps: [
      { title: 'Size the safe zone', body: 'Drag the bar between 10% and 90%. A smaller zone pays more.' },
      { title: 'Place your bet', body: 'The payout updates as you drag, so you see the exact multiplier first.' },
      { title: 'Roll', body: 'A number from 1 to 100 is rolled and the marker slides to it.' },
      { title: 'Win or lose', body: 'Inside the safe zone pays bet × payout; in the danger zone the bet is lost.' },
    ],
    notes: ['The payout is a little under the true odds — a 50% zone pays 1.84×.', 'The biggest payout is 9.2× at a 10% zone.'],
  },
  wheel: {
    intro: 'Pick a colour, spin the wheel, and win if the pointer lands on it.',
    steps: [
      { title: 'Pick a colour', body: 'Red pays 2×, blue 3×, green 4×, gold 5×.' },
      { title: 'Place your bet', body: 'Add chips, then spin.' },
      { title: 'Spin', body: 'The wheel has 12 equal slices: 6 red, 3 blue, 2 green and 1 gold.' },
      { title: 'Collect', body: 'If the pointer stops on your colour you win bet × its multiplier.' },
    ],
    notes: ['Rarer colours pay more — gold is one slice in twelve.'],
  },
  'run-dice': {
    intro: 'Roll two dice against a map of winning, losing and neutral totals.',
    steps: [
      { title: 'Read the map', body: 'Each round marks two totals W (win), three L (loss) and the rest N (neutral).' },
      { title: 'Place your bet', body: 'Win chance and payout are shown before you roll — rarer winning totals pay more.' },
      { title: 'Roll', body: 'Roll two dice. W wins the payout, L loses the bet.' },
      { title: 'Neutral re-rolls', body: 'An N total lets you roll again, up to three rolls. Three neutrals in a row is a push.' },
    ],
    notes: ['7 is the most likely total, 2 and 12 the least.', 'The map changes every round.'],
  },
  mines: {
    intro: 'Reveal safe tiles on a 5×5 grid and cash out before you hit a mine.',
    steps: [
      { title: 'Pick a difficulty', body: 'Easy hides 3 mines, medium 7, hard 13, insane 20.' },
      { title: 'Place your bet', body: 'Add chips and start the round.' },
      { title: 'Reveal tiles', body: 'Every safe tile raises the multiplier — more mines raise it faster.' },
      { title: 'Cash out', body: 'Take bet × multiplier at any time. Hit a mine and the bet is lost.' },
    ],
    notes: ['The multiplier has no cap — clearing a hard board pays enormously.', 'The board is revealed when the round ends.'],
  },
  'chicken-road': {
    intro: 'Walk a chicken across ten lanes; every step pays more and risks more.',
    steps: [
      { title: 'Place your bet', body: 'Add chips and start the road.' },
      { title: 'Advance', body: 'Each step moves the chicken one lane and raises the multiplier, from 0.9× up to 40×.' },
      { title: 'Watch the danger', body: 'The chance of getting hit grows each step — 10% on the first, 90% on the last.' },
      { title: 'Cash out', body: 'Cash out between steps to keep bet × multiplier. Get hit and the bet is lost.' },
    ],
    notes: ['The first step pays 0.9× — you need two steps to be in profit.'],
  },
  slots: {
    intro: 'Spin three reels and match symbols on the centre line.',
    steps: [
      { title: 'Place your bet', body: 'Add chips, then spin.' },
      { title: 'Spin', body: 'The reels stop one by one on the centre line.' },
      { title: 'Match', body: 'Three of a kind pays the most — 777 pays 50×. Some pairs pay too.' },
      { title: 'Wilds', body: 'A ★ stands in for any symbol to complete a line.' },
    ],
    notes: ['The pay table on the board lists every winning line.'],
  },
  roulette: {
    intro: 'Bet on where the ball lands on a European wheel of 0–36.',
    steps: [
      { title: 'Pick a bet', body: 'Tap a single number, or an outside bet: red, black, odd or even.' },
      { title: 'Place your chips', body: 'Add chips to the selected bet, then spin.' },
      { title: 'Spin', body: 'The wheel lands on one pocket from 0 to 36.' },
      { title: 'Collect', body: 'A single number pays 36×, red / black / odd / even pay 2×.' },
    ],
    notes: ['0 is green — it loses every outside bet.'],
  },
  'dragon-tower': {
    intro: 'Climb five floors by picking the tile without the dragon.',
    steps: [
      { title: 'Place your bet', body: 'Add chips and start climbing.' },
      { title: 'Pick a tile', body: 'Each floor has three tiles and one dragon. Pick a safe tile to climb.' },
      { title: 'Climb', body: 'Each floor raises the multiplier: 1.40×, 1.96×, 2.74×, 3.84×, 5.38×.' },
      { title: 'Cash out', body: 'Cash out after any safe floor. Find the dragon and the bet is lost.' },
    ],
    notes: ['Every floor is a fresh one-in-three chance of the dragon.'],
  },
  'chicken-race': {
    intro: 'Back one of four chickens and win if it crosses the line first.',
    steps: [
      { title: 'Pick a chicken', body: 'Nugget, Clucky, Feathers or Goldie — each has the same 25% chance.' },
      { title: 'Place your bet', body: 'Add chips, then race.' },
      { title: 'Race', body: 'The chickens run with random bursts of speed. Leads change.' },
      { title: 'Collect', body: 'If your chicken wins you get bet × 3.6.' },
    ],
    notes: ['No chicken is faster than the others — pick any.'],
  },
  'street-cups': {
    intro: 'Watch where the crown goes, follow the shuffle, then pick the cup.',
    steps: [
      { title: 'Place your bet', body: 'Add chips and start.' },
      { title: 'Memorise', body: 'The crown is shown under one of three cups before they close.' },
      { title: 'Follow the shuffle', body: 'The cups swap places twelve times. Keep your eye on the right one.' },
      { title: 'Pick a cup', body: 'Find the crown and win bet × 2.5. Pick wrong and the bet is lost.' },
    ],
    notes: ['The shuffle is fair — a sharp eye beats the one-in-three odds.'],
  },
  'case-battles': {
    intro: 'Open cases against a rival — the higher total value takes everything.',
    steps: [
      { title: 'Pick cases', body: 'Choose up to five cases. Each costs its price; the total is your bet.' },
      { title: 'Check the odds', body: 'Tap ⓘ on a case to see every item it can drop and how likely it is.' },
      { title: 'Battle', body: 'You and the rival open the same cases, item by item.' },
      { title: 'Winner takes all', body: 'Higher total value wins both sides’ items. A tie splits the pot.' },
    ],
    notes: ['Pricier cases hold rarer, more valuable items.'],
  },
  'poker-1p': {
    intro: 'Five-card draw: hold the cards you want, replace the rest, make a hand.',
    steps: [
      { title: 'Place your bet', body: 'Add chips and deal five cards.' },
      { title: 'Hold', body: 'Tap the cards you want to keep. Held cards rise and are marked.' },
      { title: 'Draw', body: 'Every card you didn’t hold is replaced once.' },
      { title: 'Get paid', body: 'Your final hand pays from the pay table — a pair of jacks or better to win.' },
    ],
    notes: ['A royal flush pays 800×, two pair 2×, jacks or better 1× (your bet back).'],
  },
  hilo: {
    intro: 'Guess whether the next card is higher or lower and build a streak.',
    steps: [
      { title: 'Place your bet', body: 'Add chips and deal the first card.' },
      { title: 'Guess', body: 'Call higher or lower for the next card. Aces count high.' },
      { title: 'Build the streak', body: 'A right guess starts at 2× and each one after multiplies by 1.5.' },
      { title: 'Cash out or go again', body: 'Take your winnings or guess again. One wrong guess loses it all.' },
    ],
    notes: ['A tie keeps your streak alive and returns the bet.', 'The streak has no cap.'],
  },
  keno: {
    intro: 'Pick up to five numbers and match them against the draw.',
    steps: [
      { title: 'Pick numbers', body: 'Choose 1–5 numbers from the 25 on the board, or use Quick pick.' },
      { title: 'Place your bet', body: 'Add chips, then play.' },
      { title: 'The draw', body: 'Five balls are drawn one by one. Your hits light up as they land.' },
      { title: 'Get paid', body: 'More hits pay more: 1 hit 0.5×, 2 hits 2×, 3 hits 5×, 4 hits 15×, 5 hits 100×.' },
    ],
    notes: ['Picking more numbers gives you more chances to hit.', 'Reveal all skips the draw animation.'],
  },
  'coin-flip': {
    intro: 'Call heads or tails and let the winnings ride on a streak.',
    steps: [
      { title: 'Pick a side', body: 'Choose heads or tails.' },
      { title: 'Place your bet', body: 'Add chips, then flip.' },
      { title: 'Win and ride', body: 'A right call doubles your bet. Each call after doubles it again.' },
      { title: 'Cash out or flip again', body: 'Bank the streak at any time. One wrong call loses everything.' },
    ],
    notes: ['Every flip is 50/50 — the streak only gets riskier.', 'The streak has no cap.'],
  },
}
