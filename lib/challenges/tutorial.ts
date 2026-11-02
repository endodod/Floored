import type { TutorialStep } from '@/components/mode-tutorial'
import { formatChips } from '@/utils/format'
import { CHALLENGE_START_BANKROLL } from './types'

/** How challenges work, shown at the top of the Challenges page. Mirrors the rules in the challenge store. */
export const CHALLENGE_STEPS: TutorialStep[] = [
  {
    title: 'Same start, set games',
    body: `Every challenge starts at ${formatChips(CHALLENGE_START_BANKROLL)} with its own set of games and a fixed number of bets on each.`,
  },
  {
    title: 'Place every bet',
    body: "Play the games in any order and split your bankroll however you like. Each bet must be at least the challenge's min bet.",
  },
  {
    title: 'Stay above the min bet',
    body: 'If your bankroll falls below the min bet while bets are left, the attempt fails.',
  },
  {
    title: 'Retry for your best',
    body: 'Try a challenge as often as you like. Only attempts with every bet placed count towards your best bankroll.',
  },
  {
    title: 'One at a time',
    body: 'Only one challenge runs at a time. Starting another gives up the current one, and that still counts as a try.',
  },
  {
    title: 'Daily and community',
    body: 'The Daily challenge works the same way, once a day and the same for everyone. Community challenges are made by players; sign in to publish your own.',
  },
]
