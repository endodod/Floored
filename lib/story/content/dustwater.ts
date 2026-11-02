import type { Errand, Scene } from '../types'

/**
 * Dustwater, act I: a truck stop with back rooms. You arrive with $200 and Jo.
 * The vertical slice (plan Phase 3) plays this city start to finish.
 */

export const DUSTWATER_SCENES: Scene[] = [
  {
    id: 'dustwater-arrival',
    city: 'dustwater',
    trigger: { on: 'arrival' },
    start: 'a1',
    nodes: {
      a1: { kind: 'line', speaker: 'narrator', text: 'Dustwater. One gas station, two motels and a casino behind the truck wash. The neon says OPEN 24 HRS. Three of the letters work.', next: 'a2' },
      a2: { kind: 'line', speaker: 'jo', text: 'Two hundred dollars. Your grandfather walked in here once with less and walked out with a deed.', next: 'a3' },
      a3: { kind: 'line', speaker: 'jo', expression: 'angry', text: 'Then Vale walked in with more and walked out with everything.', next: 'a4' },
      a4: { kind: 'line', speaker: 'jo', text: "To sit at Vale's table you need a seat on the circuit. Twelve towns, twelve champions. This is the first one.", next: 'a5' },
      a5: {
        kind: 'choice',
        prompt: 'Jo waits for an answer.',
        options: [
          { text: '"Then we start tonight."', to: 'a6', effects: [{ set: 'jo-trusts-you' }] },
          { text: '"I came to win the club back, not to tour truck stops."', to: 'a7', effects: [{ faction: 'old-guard', delta: 1 }] },
          { text: '"Who runs the back rooms here?"', to: 'a8', effects: [{ faction: 'underground', delta: 1 }] },
        ],
      },
      a6: { kind: 'line', speaker: 'jo', expression: 'pleased', text: "That's the spirit. Marta at the Starlite owes me a room. Start there.", next: 'end' },
      a7: { kind: 'line', speaker: 'jo', text: 'Vale owns the shortcut. Truck stops are what we have. Marta at the Starlite owes me a room.', next: 'end' },
      a8: { kind: 'line', speaker: 'jo', expression: 'pleased', text: "Pike. Three cups and a folding table outside the truck wash. Don't play his cups. Watch them.", next: 'end' },
      end: { kind: 'end', effects: [{ set: 'arrived-dustwater' }] },
    },
  },
  {
    id: 'dustwater-marta-first',
    city: 'dustwater',
    trigger: { on: 'talk', character: 'marta' },
    start: 'm1',
    nodes: {
      m1: { kind: 'line', speaker: 'marta', text: "Jo's grandkid. You've got his eyes and, I'm guessing, his bank balance.", next: 'm2' },
      m2: { kind: 'line', speaker: 'marta', expression: 'pleased', text: "Room's yours at the trucker rate. And if you can remember an order better than my last waiter, there's a shift at the bar every night.", next: 'm3' },
      m3: {
        kind: 'choice',
        options: [
          { text: '"I\'ll take the shift."', to: 'm4', effects: [{ errand: 'dustwater-marta-shift', step: 'start' }] },
          { text: '"What happened to the last waiter?"', to: 'm5' },
        ],
      },
      m4: { kind: 'line', speaker: 'marta', text: "Good. Doesn't pay much. Never loses either. That's more than the casino can say.", next: 'end' },
      m5: { kind: 'line', speaker: 'marta', expression: 'angry', text: 'Borrowed from the Notary to chase a hand. Now he waits tables for the Notary. Take the shift.', next: 'm4' },
      end: { kind: 'end', effects: [{ set: 'met-marta' }] },
    },
  },
  {
    id: 'dustwater-pike-first',
    city: 'dustwater',
    trigger: { on: 'talk', character: 'pike' },
    start: 'p1',
    nodes: {
      p1: { kind: 'line', speaker: 'pike', expression: 'pleased', text: 'Find the queen, double your money. Everybody wins. Mostly me.', next: 'p2' },
      p2: {
        kind: 'choice',
        options: [
          { text: 'Watch his hands instead of the cups.', to: 'p3', if: { flag: 'arrived-dustwater' } },
          { text: '"Jo says you know the back rooms."', to: 'p4', if: { faction: 'underground', atLeast: 1 }, effects: [{ faction: 'underground', delta: 1 }] },
          { text: 'Walk on.', to: 'end' },
        ],
      },
      p3: { kind: 'line', speaker: 'pike', expression: 'angry', text: "Huh. You caught the switch. Fine: help me spot marks who can't, and I'll split the take.", next: 'p5' },
      p4: { kind: 'line', speaker: 'pike', text: 'Jo sent you? Then you get the friends rate. Cutter Hale runs the Liar\'s Dice room. Nobody beats Cutter. Nobody yet.', next: 'p5' },
      p5: { kind: 'line', speaker: 'pike', text: "Come by any night. Follow the queen through my shuffle and I'll pay you for the lesson.", next: 'end' },
      end: { kind: 'end', effects: [{ set: 'met-pike' }] },
    },
  },
  {
    id: 'dustwater-boss-intro',
    city: 'dustwater',
    trigger: { on: 'boss-intro' },
    once: false,
    start: 'b1',
    nodes: {
      b1: { kind: 'line', speaker: 'cutter', text: "Fifty times the house minimum to sit. Last cup standing takes the circuit seat. Lose and you're back on the bus.", next: 'b2', expression: 'neutral' },
      b2: { kind: 'line', speaker: 'cutter', expression: 'pleased', text: 'Vale sends me a postcard every year. I always win.', next: 'b3' },
      b3: {
        kind: 'choice',
        options: [
          { text: 'Pay the buy-in and sit down.', to: 'go' },
          { text: '"Not tonight."', to: 'later' },
        ],
      },
      go: { kind: 'end', effects: [{ set: 'boss-accepted' }] },
      later: { kind: 'end' },
    },
  },
  {
    id: 'dustwater-boss-win',
    city: 'dustwater',
    trigger: { on: 'boss-win' },
    start: 'w1',
    nodes: {
      w1: { kind: 'line', speaker: 'cutter', expression: 'angry', text: 'Five dice on the table and you call it on the first bid. Who taught you that?', next: 'w2' },
      w2: { kind: 'line', speaker: 'jo', expression: 'pleased', text: 'Twenty years of dealing to people like you, Cutter.', next: 'w3' },
      w3: { kind: 'line', speaker: 'sloane', text: "Not bad for a truck stop. Rattlesnake Junction is next. I'll save you a seat. Near the door.", next: 'end' },
      end: { kind: 'end', effects: [{ set: 'dustwater-cleared' }, { faction: 'syndicate', delta: -1 }] },
    },
  },
  {
    id: 'dustwater-boss-loss',
    city: 'dustwater',
    trigger: { on: 'boss-loss' },
    once: false,
    start: 'l1',
    nodes: {
      l1: { kind: 'line', speaker: 'cutter', expression: 'pleased', text: "Postcard's going to be a short one this year. Come back when you've learned to count dice.", next: 'l2' },
      l2: { kind: 'line', speaker: 'jo', text: "He's off to the regional for two nights. Two nights to get the stake back. We've done worse.", next: 'end' },
      end: { kind: 'end' },
    },
  },
  {
    id: 'dustwater-bust',
    city: 'dustwater',
    trigger: { on: 'bust' },
    once: false,
    start: 'x1',
    nodes: {
      x1: { kind: 'line', speaker: 'jo', text: "Empty pockets. Happens to everyone once. Happened to your grandfather nine times that I know of.", next: 'x2' },
      x2: {
        kind: 'choice',
        options: [
          { text: 'Sleep in the car and work the shifts.', to: 'car' },
          { text: 'See the Notary about a marker.', to: 'notary', effects: [{ set: 'asked-notary' }] },
        ],
      },
      car: { kind: 'line', speaker: 'jo', expression: 'pleased', text: 'The car it is. Marta and Pike pay every night. Two nights and we\'re back at the tables.', next: 'end' },
      notary: { kind: 'line', speaker: 'notary', text: 'Twenty times the minimum, repaid at one and a half. Half of every win comes to me until we are square. I will be watching. Fondly.', next: 'end' },
      end: { kind: 'end' },
    },
  },
]

export const DUSTWATER_ERRANDS: Errand[] = [
  { id: 'dustwater-marta-shift', city: 'dustwater', giver: 'marta', title: 'The bar shift', task: "Work a shift at Marta's bar and get every order right." },
  { id: 'dustwater-pike-marks', city: 'dustwater', giver: 'pike', title: "Pike's marks", task: "Win three bets in a row at Pike's cups." },
  { id: 'dustwater-jo-stake', city: 'dustwater', giver: 'jo', title: 'Seed money', task: 'Finish a night at the Dustwater casino up on the night.' },
  { id: 'dustwater-marta-tab', city: 'dustwater', giver: 'marta', title: "A trucker's tab", task: 'Win a Liar\'s Dice game in the back room to collect a trucker\'s tab for Marta.' },
]
