/**
 * Board-level vocabulary shared by every game table, so the pieces on the felt
 * read the same from game to game: one label style, one option toggle, one grid
 * cell, one panel, one choice button. Colour follows the app's rules — felt for
 * the selection and a win, loss red for a loss, gold for the special case — and
 * a game keeps its own colours only where they belong to the scene itself
 * (roulette pockets, wheel segments, cards, the coin).
 */

/** Small label over a board element: "Dealer", "Pick your chicken", "Pay table". */
export const BOARD_LABEL = 'text-xs text-dim'

/** One-line hint under the board explaining what to do next. */
export const BOARD_HINT = 'max-w-md px-2 text-center text-[13px] leading-5 text-dim'

/** Inset panel on the felt: pay tables, stat boxes, outcome maps. */
export const BOARD_PANEL = 'rounded-md bg-black/30 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'

/** A stat inside a panel: label over a mono figure. */
export const BOARD_STAT_LABEL = 'text-[11px] text-dim'
export const BOARD_STAT_VALUE = 'num text-[15px] text-ink'

/** Option toggle group (risk, difficulty, colour): a dark rail of pills. */
export const BOARD_SEGMENTED =
  'inline-flex items-center gap-0.5 rounded-full bg-black/35 p-0.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'

export function boardSegment(active: boolean) {
  return [
    'h-7 rounded-full px-3 text-[12px] font-medium transition-[color,background-color,box-shadow] disabled:cursor-not-allowed',
    active
      ? 'bg-felt-tint text-felt shadow-[inset_0_0_0_1px_var(--felt),0_0_14px_-4px_rgba(79,174,132,0.7)]'
      : 'text-soft hover:text-ink disabled:opacity-40 disabled:hover:text-soft',
  ].join(' ')
}

/** Big choice on the board (Heads / Tails, Higher / Lower, Red / Black): an outlined pill. */
export function boardChoice(active = false) {
  return [
    'm-still h-11 min-w-[6rem] rounded-full border px-5 text-[14px] font-semibold transition-[color,background-color,border-color,box-shadow,transform] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35',
    active
      ? 'border-felt bg-felt-tint text-felt shadow-[0_0_18px_-6px_rgba(79,174,132,0.8)]'
      : 'border-control bg-black/25 text-soft hover:border-felt hover:text-ink',
  ].join(' ')
}

/** Grid cell (keno numbers, mines tiles, tower tiles, outcome map). Combine with one CELL_* state. */
export const BOARD_CELL = 'rounded-md border text-sm font-semibold tabular-nums transition-[color,background-color,border-color,box-shadow]'
export const CELL_IDLE = 'border-white/10 bg-black/25 text-soft'
export const CELL_OPEN = `${CELL_IDLE} hover:border-[rgba(79,174,132,0.6)] hover:bg-felt-tint hover:text-ink`
export const CELL_MUTED = 'border-white/5 bg-black/15 text-dim'
export const CELL_PICKED = 'border-felt bg-felt-tint text-felt'
export const CELL_WIN = 'border-felt bg-felt text-ground shadow-[0_0_18px_-4px_rgba(79,174,132,0.8)]'
export const CELL_LOSS = 'border-loss bg-loss-tint text-loss'
export const CELL_GOLD = 'border-gold bg-gold-tint text-gold'
export const CELL_CURRENT = 'border-felt bg-felt-tint text-ink shadow-[0_0_14px_-4px_rgba(79,174,132,0.7)]'

/** Text tones for figures on the board. */
export const TONE_WIN = 'text-felt glow-felt'
export const TONE_LOSS = 'text-loss glow-loss'
export const TONE_GOLD = 'text-gold glow-gold'
