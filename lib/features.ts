/**
 * Feature switches for game modes. Turning one off hides its entry points and
 * makes its routes 404, without removing its code.
 */
export const SURVIVAL_ENABLED = false

/** Ladder: climb 18 rungs with an all-in pot, one game per rung, checkpoints every 3. */
export const LADDER_ENABLED = true

/** Tables: multi-seat casino games against bots (Hold'em, Liar's Dice, Blackjack Showdown). */
export const TABLES_ENABLED = true

/**
 * Simple view (big buttons, fewer words). Off for now: its switches are hidden and a saved
 * "on" is ignored, so nobody is left in it without a way out. Turn on to bring it back.
 */
export const SIMPLE_VIEW_ENABLED = false
