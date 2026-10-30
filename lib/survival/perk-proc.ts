/** Base per-bet activation chance at level 1 for proc perks. */
export const PROC_PERK_BASE_CHANCES: Record<string, number> = {
  perk_case_xray: 0.30,
  perk_mines_safe: 0.30,
  perk_dragon_blindspot: 0.30,
  perk_chicken_road_lane: 0.30,
  perk_chicken_scout: 0.30,
  perk_street_cups_truth: 0.30,
  perk_roulette_tracker: 0.30,
  perk_keno_heat: 0.30,
  perk_plinko_golden_ball: 0.30,
  perk_poker_hold_bias: 0.30,
  perk_over_under_shield: 0.30,
  perk_wheel_scout: 0.30,
  perk_slots_shield: 0.30,
  perk_run_dice_insight: 0.30,
  perk_deck_burn: 0.30,
  perk_tower_net: 0.30,
  perk_baccarat_peek: 0.30,
}

const PROC_LEVEL_BONUS = 0.1125
const PROC_MAX_CHANCE = 0.75

export function perkRequiresProcRoll(effectKey: string): boolean {
  return effectKey in PROC_PERK_BASE_CHANCES
}

export function getPerkProcChance(effectKey: string, level = 1): number {
  const base = PROC_PERK_BASE_CHANCES[effectKey]
  if (base == null) return 1
  const lv = Math.max(1, Math.min(5, level))
  return Math.min(PROC_MAX_CHANCE, base + (lv - 1) * PROC_LEVEL_BONUS)
}

export function rollPerkProc(effectKey: string, level = 1): boolean {
  const chance = getPerkProcChance(effectKey, level)
  if (!perkRequiresProcRoll(effectKey)) return true
  return Math.random() < chance
}

export function perkProcChancePercent(effectKey: string, level = 1): number | null {
  if (!perkRequiresProcRoll(effectKey)) return null
  return Math.round(getPerkProcChance(effectKey, level) * 100)
}

/** @deprecated Use PROC_PERK_BASE_CHANCES */
export const PROC_PERK_CHANCES = PROC_PERK_BASE_CHANCES
