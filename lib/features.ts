/**
 * Feature switches for game modes. Turning one off hides its entry points and
 * makes its routes 404, without removing its code.
 */
export const SURVIVAL_ENABLED = true

/** Ladder: climb 18 rungs with an all-in pot, one game per rung, checkpoints every 3. */
export const LADDER_ENABLED = true

/** Tables is a separate multiplayer mode; its games never enter GameName. */
export const TABLES_ENABLED = true
