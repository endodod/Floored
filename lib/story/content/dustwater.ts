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
      a2: { kind: 'line', speaker: 'jo', text: "Two hundred dollars. That's everything we've got left.", next: 'a2b' },
      a2b: { kind: 'line', speaker: 'narrator', text: 'Six months ago your grandfather still owned the Gilded Floor: forty tables, a brass bar, and Jo dealing the late shift.', next: 'a2c' },
      a2c: { kind: 'line', speaker: 'jo', text: "Then Vale sat down. Nobody knows where Vale's money comes from. Half the houses on the circuit pay Vale rent and pretend they don't.", next: 'a3' },
      a3: { kind: 'line', speaker: 'jo', expression: 'angry', text: 'One hand. Your grandfather put the deed in the pot. Vale turned over the only card that beat him.', next: 'a3b' },
      a3b: { kind: 'line', speaker: 'jo', text: "He didn't last the winter. He left you his car, his debts, and a note that says three words. Get it back.", next: 'a3c' },
      a3c: { kind: 'line', speaker: 'jo', text: "Vale doesn't play strangers. Vale plays champions. Twelve towns on the circuit, each with a house champion. Beat all twelve and Vale owes you a seat at the Summit.", next: 'a4' },
      a4: { kind: 'line', speaker: 'jo', text: 'Win at that table and the Gilded Floor is yours again. This is town one. Cutter Hale runs the back table here.', next: 'a5' },
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
    id: 'dustwater-how-nights-work',
    city: 'dustwater',
    trigger: { on: 'tutorial' },
    once: false,
    start: 't1',
    nodes: {
      t1: { kind: 'line', speaker: 'jo', text: 'One more thing before you go in. How a night works. Your grandfather never asked, which is why he had nine of them end badly.', next: 't2' },
      t2: {
        kind: 'choice',
        options: [
          { text: '"I know how a casino works."', to: 's1' },
          { text: '"Go on."', to: 'f1' },
        ],
      },
      s1: { kind: 'line', speaker: 'jo', text: "You know casinos. This isn't one. You pick a room, you stay in it till you call it a night, and you get twelve bets a night. Each room has its own four games and they change a little every night.", next: 's2' },
      s2: { kind: 'line', speaker: 'jo', expression: 'pleased', text: "Comps, hustles and errands pay on the side, and standing adds a bonus on a good night. Go bust and the Notary will lend you a marker. The rest is in the menu, under How the nights work. Read it on a bad night.", next: 'end' },
      f1: { kind: 'line', speaker: 'jo', text: 'A night is one room. You pick it, you sit down, and you stay until you call it a night. No wandering.', next: 'f2' },
      f2: { kind: 'line', speaker: 'jo', text: 'Standing is how a town sees you. Every town starts you at nothing.', next: 'f2s' },
      f2s: { kind: 'line', speaker: 'jo', text: 'Finish a job for someone and it goes up one. Go bust and it drops one. Five is the most any town gives.', next: 'f3' },
      f3: { kind: 'line', speaker: 'jo', text: 'The dive takes anyone, standing or not. Bets up to twenty times the house minimum.', next: 'f4' },
      f4: { kind: 'line', speaker: 'jo', text: 'The main floor wants standing one. Bets up to a hundred times the minimum.', next: 'f4b' },
      f4b: { kind: 'line', speaker: 'jo', text: 'The high-roller room wants standing three. No limit, the best comps, and where you build the money for the back table.', next: 'f4c' },
      f4c: { kind: 'line', speaker: 'jo', text: 'No limit is not a compliment. It is a warning.', next: 'f4d' },
      f4d: { kind: 'line', speaker: 'jo', expression: 'pleased', text: 'Standing keeps paying after the doors are open. At two, four and five the house adds a bonus when you finish a night up: five, ten, then twenty percent of what you won at the tables.', next: 'f5' },
      f5: { kind: 'line', speaker: 'jo', text: 'Each room deals its own four games tonight. Tomorrow it swaps one or two. Never marry a game.', next: 'f6' },
      f6: { kind: 'line', speaker: 'jo', text: 'Twelve bets a night, then the house closes your tab. Spend them like money. They are.', next: 'f7' },
      f7: { kind: 'line', speaker: 'jo', text: "Comps. The house gives back a share of everything you bet that night, win or lose. It's not a prize for winning. Better rooms give a bigger share, and there's a cap.", next: 'f8' },
      f8: { kind: 'line', speaker: 'jo', text: "Hustles: two side goals on the board each night. They pay when the night ends. Errands are jobs people hand you, and those pay when you finish them.", next: 'f8b' },
      f8b: { kind: 'line', speaker: 'jo', text: "Nobody here trusts a new face with everything. Two people want a word on your first night, then one more each night after. Five jobs in all. Look for who's waving.", next: 'f9' },
      f9: { kind: 'line', speaker: 'jo', expression: 'pleased', text: "Marta's and Pike's games pay only the first time you play each night. After that it's practice. Practice is free, and it's how you get good.", next: 'f10' },
      f10: { kind: 'line', speaker: 'jo', text: "Ending the night: the motel room costs a bit. Short on cash, you sleep in the car, free. It smells like your grandfather.", next: 'f11' },
      f11: { kind: 'line', speaker: 'jo', expression: 'angry', text: "Drop under the minimum bet and you're bust. You lose a point of standing in this town. The Notary will lend you a marker. Fondly. Always fondly.", next: 'f12' },
      f12: { kind: 'line', speaker: 'jo', text: "Last: Cutter at the back table is the way out of town. Fifty times the house minimum to sit. Win and you take the purse. Lose, and he's back after two nights.", next: 'f13' },
      f13: { kind: 'line', speaker: 'jo', expression: 'pleased', text: "That's the lot. It's all in the menu, under How the nights work, if you forget. Now go see Marta.", next: 'end' },
      end: { kind: 'end' },
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
          { text: 'Walk on.', to: 'pw' },
        ],
      },
      pw: { kind: 'line', speaker: 'pike', text: "Your loss. Tell you what: win three at the cups in a row, any table, and the marks will believe anything. Come tell me when you have.", next: 'end' },
      p3: { kind: 'line', speaker: 'pike', expression: 'angry', text: "Huh. You caught the switch. Fine: help me spot marks who can't, and I'll split the take.", next: 'p5' },
      p4: { kind: 'line', speaker: 'pike', text: 'Jo sent you? Then you get the friends rate. Cutter Hale runs the Liar\'s Dice room. Nobody beats Cutter. Nobody yet.', next: 'p5' },
      p5: { kind: 'line', speaker: 'pike', text: "Come by any night. Follow the queen through my shuffle and I'll pay you for the lesson.", next: 'p6' },
      p6: { kind: 'line', speaker: 'pike', expression: 'pleased', text: 'And a job: win three at the cups in a row, any table. The marks see that, they line up.', next: 'end' },
      end: { kind: 'end', effects: [{ set: 'met-pike' }, { errand: 'dustwater-pike-marks', step: 'start' }] },
    },
  },
  {
    id: 'dustwater-jo-seed',
    city: 'dustwater',
    trigger: { on: 'dawn' },
    if: { flag: 'arrived-dustwater' },
    start: 'j1',
    nodes: {
      j1: { kind: 'line', speaker: 'jo', text: "Morning. The coffee here is a crime. Sit down, I've got a job for you.", next: 'j2' },
      j2: { kind: 'line', speaker: 'jo', text: "Finish one night up at the tables. Doesn't matter by how much. I want to see you walk out with more than you walked in with.", next: 'j3' },
      j3: {
        kind: 'choice',
        options: [
          { text: '"One good night. Easy."', to: 'j4' },
          { text: '"And if I come out down?"', to: 'j5' },
        ],
      },
      j4: { kind: 'line', speaker: 'jo', expression: 'pleased', text: "Your grandfather said that every night. Prove him wrong.", next: 'end' },
      j5: { kind: 'line', speaker: 'jo', text: 'Then you try again tomorrow. The job keeps.', next: 'end' },
      end: { kind: 'end', effects: [{ errand: 'dustwater-jo-stake', step: 'start' }] },
    },
  },
  {
    id: 'dustwater-marta-trucker',
    city: 'dustwater',
    trigger: { on: 'talk', character: 'marta' },
    if: { flag: 'met-marta' },
    start: 't1',
    nodes: {
      t1: { kind: 'line', speaker: 'marta', text: "Booth three. That trucker's been here since Tuesday telling everyone the casino never pays three to one.", next: 't2' },
      t2: { kind: 'line', speaker: 'marta', expression: 'pleased', text: "He bet me a week of breakfasts nobody wins three times their stake in one go. Win it and I'll split the breakfasts with you. In cash.", next: 'end' },
      end: { kind: 'end', effects: [{ errand: 'dustwater-marta-bet', step: 'start' }] },
    },
  },
  {
    id: 'dustwater-pike-lesson',
    city: 'dustwater',
    trigger: { on: 'talk', character: 'pike' },
    if: { flag: 'met-pike' },
    start: 'l1',
    nodes: {
      l1: { kind: 'line', speaker: 'pike', text: "You've been watching my hands for three nights. Don't think I didn't notice.", next: 'l2' },
      l2: { kind: 'line', speaker: 'pike', expression: 'pleased', text: "So prove it. Follow the queen through four of my five shuffles in one sitting and I'll put you on the payroll. Lookout rates.", next: 'end' },
      end: { kind: 'end', effects: [{ errand: 'dustwater-pike-lesson', step: 'start' }] },
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
          { text: 'See the Notary about a marker.', to: 'notary', effects: [{ marker: true }] },
        ],
      },
      car: { kind: 'line', speaker: 'jo', expression: 'pleased', text: 'The car it is. Marta and Pike pay every night. Two nights and we\'re back at the tables.', next: 'end' },
      notary: { kind: 'line', speaker: 'notary', text: 'Twenty times the minimum, repaid at one and a half. Half of every win comes to me until we are square. I will be watching. Fondly.', next: 'end' },
      end: { kind: 'end' },
    },
  },
]

export const DUSTWATER_ERRANDS: Errand[] = [
  // Night 0: Marta and Pike want a word. Night 1: Jo at breakfast. Night 2: Marta again. Night 3: Pike again.
  { id: 'dustwater-marta-shift', city: 'dustwater', giver: 'marta', title: 'The bar shift', task: "Clear at least 5 of the 6 rounds on a shift at Marta's bar.", goal: { kind: 'minigame', minigame: 'last-orders', score: 0.8 }, night: 0, opens: { flag: 'met-marta' }, rep: 1 },
  { id: 'dustwater-pike-marks', city: 'dustwater', giver: 'pike', title: "Pike's marks", task: 'Win 3 rounds of Street Cups in a row, to show the marks it can be done.', goal: { kind: 'streak', game: 'street-cups', wins: 3 }, night: 0, rep: 1 },
  { id: 'dustwater-jo-stake', city: 'dustwater', giver: 'jo', title: 'Seed money', task: 'Finish a night at the casino up on the night.', goal: { kind: 'night-up' }, night: 1, rep: 1 },
  { id: 'dustwater-marta-bet', city: 'dustwater', giver: 'marta', title: "A trucker's bet", task: 'A trucker bet Marta nobody wins three times their stake in one go. Prove him wrong.', goal: { kind: 'big-win', mult: 3 }, night: 2, rep: 1 },
  { id: 'dustwater-pike-lesson', city: 'dustwater', giver: 'pike', title: 'Lookout rates', task: "Follow the queen through at least 4 of Pike's 5 shuffles in one sitting.", goal: { kind: 'minigame', minigame: 'shuffle-tracker', score: 0.8 }, night: 3, rep: 1 },
]
